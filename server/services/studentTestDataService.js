const Student = require("../models/Student");
const TestAttempt = require("../models/TestAttempt");
const TestActivity = require("../models/TestActivity");
const { calculateSincerityScore } = require("../engine/sincerityEngine");

const toIdString = (value) => String(value?._id || value || "").trim();

const sortAttempts = (attempts = []) =>
  [...attempts].sort((left, right) => {
    const leftTime = new Date(left?.takenAt || left?.endTime || left?.startTime || 0).getTime();
    const rightTime = new Date(right?.takenAt || right?.endTime || right?.startTime || 0).getTime();
    return leftTime - rightTime;
  });

const normalizeSubject = (subject) => {
  const raw = String(subject || "").trim();
  if (raw === "DSA") {
    return "Technical";
  }
  if (["Technical", "Aptitude", "Coding"].includes(raw)) {
    return raw;
  }
  return null;
};

const normalizeAttemptScore = (attempt) => {
  const directScore = Number(attempt?.score);
  if (Number.isFinite(directScore)) {
    return directScore;
  }

  const percentageScore = Number(attempt?.percentage);
  if (Number.isFinite(percentageScore)) {
    return percentageScore;
  }

  const totalScore = Number(attempt?.totalScore);
  const maxScore = Number(attempt?.maxScore);
  if (Number.isFinite(totalScore) && Number.isFinite(maxScore) && maxScore > 0) {
    return Number(((totalScore / maxScore) * 100).toFixed(2));
  }

  if (Number.isFinite(totalScore)) {
    return totalScore;
  }

  return 0;
};

const normalizeFirstAttemptFlags = (attempts = []) => {
  const firstAttemptByTest = new Set();

  return sortAttempts(attempts).map((attempt) => {
    const testKey = toIdString(attempt?.testId);
    if (!testKey) {
      return attempt;
    }

    const isFirstAttempt = !firstAttemptByTest.has(testKey);
    firstAttemptByTest.add(testKey);

    if (attempt?.isFirstAttempt === isFirstAttempt) {
      return attempt;
    }

    if (typeof attempt?.set === "function") {
      attempt.set("isFirstAttempt", isFirstAttempt);
      return attempt;
    }

    return {
      ...attempt,
      isFirstAttempt
    };
  });
};

const syncFirstAttemptFlags = async (studentId) => {
  const attempts = await TestAttempt.find({ studentId }).sort({ takenAt: 1, startTime: 1, _id: 1 });
  const normalizedAttempts = normalizeFirstAttemptFlags(attempts);
  const bulkOps = [];

  normalizedAttempts.forEach((attempt) => {
    if (attempt?.isModified && attempt.isModified("isFirstAttempt")) {
      bulkOps.push({
        updateOne: {
          filter: { _id: attempt._id },
          update: { $set: { isFirstAttempt: attempt.isFirstAttempt } }
        }
      });
    }
  });

  if (bulkOps.length > 0) {
    await TestAttempt.bulkWrite(bulkOps);
  }

  return normalizedAttempts;
};

const getAttemptsByStudentIds = async (studentIds = [], populate = "") => {
  const safeIds = [...new Set((Array.isArray(studentIds) ? studentIds : []).map(toIdString).filter(Boolean))];
  if (safeIds.length === 0) {
    return new Map();
  }

  let query = TestAttempt.find({ studentId: { $in: safeIds } }).sort({ takenAt: 1, startTime: 1, _id: 1 });
  if (populate) {
    query = query.populate("testId", populate);
  }

  const attempts = await query;
  const grouped = new Map();
  attempts.forEach((attempt) => {
    const studentId = toIdString(attempt?.studentId);
    const current = grouped.get(studentId) || [];
    current.push(attempt);
    grouped.set(studentId, current);
  });

  return grouped;
};

const getActivitiesByStudentIds = async (studentIds = [], populate = "") => {
  const safeIds = [...new Set((Array.isArray(studentIds) ? studentIds : []).map(toIdString).filter(Boolean))];
  if (safeIds.length === 0) {
    return new Map();
  }

  let query = TestActivity.find({ studentId: { $in: safeIds } }).sort({ startedAt: 1, _id: 1 });
  if (populate) {
    query = query.populate("testId", populate);
  }

  const activities = await query;
  const grouped = new Map();
  activities.forEach((activity) => {
    const studentId = toIdString(activity?.studentId);
    const current = grouped.get(studentId) || [];
    current.push(activity);
    grouped.set(studentId, current);
  });

  return grouped;
};

const attachTestDataToStudent = (student, attemptsMap, activitiesMap) => {
  if (!student) {
    return student;
  }

  const studentId = toIdString(student?.userId || student?._id);
  student.mockTestScores = attemptsMap.get(studentId) || [];
  student.testActivityLog = activitiesMap.get(studentId) || [];
  return student;
};

const attachTestDataToStudents = async (students, options = {}) => {
  const list = Array.isArray(students) ? students : [students].filter(Boolean);
  if (list.length === 0) {
    return Array.isArray(students) ? [] : null;
  }

  const studentIds = list.map((student) => student?.userId || student?._id).filter(Boolean);
  const [attemptsMap, activitiesMap] = await Promise.all([
    getAttemptsByStudentIds(studentIds, options.attemptPopulate || ""),
    getActivitiesByStudentIds(studentIds, options.activityPopulate || "")
  ]);

  list.forEach((student) => attachTestDataToStudent(student, attemptsMap, activitiesMap));
  return Array.isArray(students) ? list : list[0];
};

const loadStudentWithTestData = async (query, options = {}) => {
  let studentQuery = Student.findOne(query);
  if (options.select) {
    studentQuery = studentQuery.select(options.select);
  }
  if (options.populate) {
    studentQuery = studentQuery.populate(options.populate);
  }

  const student = await studentQuery;
  if (!student) {
    return null;
  }

  return attachTestDataToStudents(student, options);
};

const buildAnalyticsInput = (studentProfile) => ({
  mockTestScores: (studentProfile?.mockTestScores || []).map((item) => ({
    score: normalizeAttemptScore(item),
    type: item?.type,
    takenAt: item?.takenAt,
    endTime: item?.endTime,
    detailedResult: item?.detailedResult,
    subject: normalizeSubject(item?.subject || item?.testId?.subject) || null,
    testQuestions: Array.isArray(item?.testId?.questions) ? item.testId.questions : [],
    isFirstAttempt: item?.isFirstAttempt
  })),
  testActivityLog: (studentProfile?.testActivityLog || []).map((item) => ({
    testId: item?.testId,
    status: item?.status,
    startedAt: item?.startedAt,
    submittedAt: item?.submittedAt
  }))
});

const updateStudentSincerity = async (studentProfile) => {
  const sincerity = calculateSincerityScore(buildAnalyticsInput(studentProfile));

  if (studentProfile) {
    studentProfile.sincerityScore = sincerity.sincerityScore;
    await studentProfile.save();
  }

  return sincerity;
};

module.exports = {
  TestAttempt,
  TestActivity,
  attachTestDataToStudents,
  buildAnalyticsInput,
  getActivitiesByStudentIds,
  getAttemptsByStudentIds,
  loadStudentWithTestData,
  normalizeAttemptScore,
  normalizeFirstAttemptFlags,
  sortAttempts,
  syncFirstAttemptFlags,
  updateStudentSincerity
};
