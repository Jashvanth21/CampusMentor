const mongoose = require("mongoose");
const MockTest = require("../models/MockTest");
const Student = require("../models/Student");
const User = require("../models/User");
const { evaluateMCQ, evaluateCoding, evaluateCodingQuestion, evaluateCodingTest } = require("./evaluationService");
const {
  TestActivity,
  TestAttempt,
  attachTestDataToStudents,
  updateStudentSincerity
} = require("./studentTestDataService");
const { updateTopicStats } = require("../utils/topicStats");
const ALLOWED_SUBJECTS = ["Technical", "Aptitude", "Coding"];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeSubject = (rawSubject) => {
  const subject = String(rawSubject || "").trim();
  if (!subject) return "Technical";
  if (subject === "DSA") return "Technical";
  return ALLOWED_SUBJECTS.includes(subject) ? subject : "Technical";
};

const ensureRole = async (userId, allowedRoles) => {
  if (!userId) {
    throw createError("Authentication context missing user id.", 401);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw createError("User account not found.", 404);
  }

  const allowed = allowedRoles.map((role) => String(role || "").toLowerCase());
  const userRole = String(user.role || "").toLowerCase();

  if (!allowed.includes(userRole)) {
    throw createError("Access denied for this role.", 403);
  }

  return user;
};

const buildStudentQuestionId = (testId, questionIndex) => `${String(testId)}:${questionIndex}`;

const sanitizeForStudent = (test) => {
  const safeQuestions = (test.questions || []).map((question, index) => ({
    id: buildStudentQuestionId(test._id, index),
    questionText: question.questionText,
    options: question.options,
    problemStatement: question.problemStatement,
    inputFormat: question.inputFormat,
    outputFormat: question.outputFormat,
    constraints: question.constraints,
    sampleInput: question.sampleInput,
    sampleOutput: question.sampleOutput,
    languageId: question.languageId
  }));

  return {
    id: test._id,
    title: test.title,
    description: test.description || "",
    duration: test.duration ?? null,
    passingCriteria: Number(test.passingCriteria) || 50,
    startDate: test.startDate || null,
    endDate: test.endDate || null,
    isPublished: Boolean(test.isPublished),
    subject: normalizeSubject(test.subject),
    testType: test.testType,
    questions: safeQuestions,
    createdBy: test.createdBy,
    createdAt: test.createdAt
  };
};

const sanitizeForAdmin = (test) => ({
  id: test._id,
  title: test.title,
  description: test.description || "",
  duration: test.duration ?? null,
  passingCriteria: Number(test.passingCriteria) || 50,
  startDate: test.startDate || null,
  endDate: test.endDate || null,
  isPublished: Boolean(test.isPublished),
  subject: normalizeSubject(test.subject),
  testType: test.testType,
  questions: Array.isArray(test.questions)
    ? test.questions.map((question, index) => ({
        id: buildStudentQuestionId(test._id, index),
        questionText: question.questionText || "",
        options: Array.isArray(question.options) ? question.options : [],
        correctAnswer: question.correctAnswer || "",
        problemStatement: question.problemStatement || "",
        inputFormat: question.inputFormat || "",
        outputFormat: question.outputFormat || "",
        constraints: question.constraints || "",
        sampleInput: question.sampleInput || "",
        sampleOutput: question.sampleOutput || "",
        starterCode: {
          javascript: question?.starterCode?.javascript || "",
          python: question?.starterCode?.python || "",
          java: question?.starterCode?.java || "",
          cpp: question?.starterCode?.cpp || ""
        },
        testCases: Array.isArray(question.testCases)
          ? question.testCases.map((testCase) => ({
              input: testCase?.input ?? "",
              expectedOutput: testCase?.expectedOutput ?? ""
            }))
          : [],
        languageId: question.languageId,
        marks: Number(question.marks) || 1,
        topic: question.topic || ""
      }))
    : [],
  createdBy: test.createdBy,
  createdAt: test.createdAt
});

const resolveQuestionReference = async (questionId) => {
  const safeQuestionId = String(questionId || "").trim();
  const parts = safeQuestionId.split(":");

  if (parts.length !== 2 || !mongoose.Types.ObjectId.isValid(parts[0])) {
    throw createError("Invalid questionId.", 400);
  }

  const questionIndex = Number(parts[1]);
  if (!Number.isInteger(questionIndex) || questionIndex < 0) {
    throw createError("Invalid questionId.", 400);
  }

  const test = await MockTest.findById(parts[0]);
  if (!test) {
    throw createError("Mock test not found.", 404);
  }

  const question = Array.isArray(test.questions) ? test.questions[questionIndex] : null;
  if (!question) {
    throw createError("Question not found.", 404);
  }

  return {
    test,
    question,
    questionIndex,
    questionId: safeQuestionId
  };
};

const parseStartTime = (rawStartTime) => {
  if (rawStartTime === undefined || rawStartTime === null || rawStartTime === "") {
    return null;
  }

  const asNumber = Number(rawStartTime);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    const numericDate = new Date(asNumber);
    if (!Number.isNaN(numericDate.getTime())) {
      return numericDate;
    }
  }

  const parsedDate = new Date(rawStartTime);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const toAnalyticsInput = (studentProfile) => ({
  mockTestScores: (studentProfile?.mockTestScores || []).map((item) => ({
    score: item?.score,
    type: item?.type,
    takenAt: item?.takenAt,
    endTime: item?.endTime,
    detailedResult: item?.detailedResult
  })),
  testActivityLog: (studentProfile?.testActivityLog || []).map((item) => ({
    testId: item?.testId,
    status: item?.status,
    startedAt: item?.startedAt,
    submittedAt: item?.submittedAt
  }))
});

const createMockTest = async (adminId, data) => {
  await ensureRole(adminId, ["admin"]);

  const {
    title,
    description,
    duration,
    startDate,
    endDate,
    isPublished,
    publish,
    subject,
    testType,
    questions
  } = data;

  if (!title || !Array.isArray(questions) || questions.length === 0) {
    throw createError("Title and at least one question are required.", 400);
  }

  const resolvedSubject = subject || "Technical";
  const normalizedSubject = normalizeSubject(resolvedSubject);
  const resolvedTestType =
    testType || (questions.some((item) => item?.problemStatement || item?.testCases?.length) ? "CODING" : "MCQ");

  const insertDoc = {
    title,
    description: description || "",
    duration: Number(duration) > 0 ? Number(duration) : 60,
    passingCriteria:
      Number.isFinite(Number(data?.passingCriteria)) && Number(data.passingCriteria) >= 0
        ? Number(data.passingCriteria)
        : 50,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    isPublished: Boolean(isPublished ?? publish),
    subject: normalizedSubject,
    testType: resolvedTestType,
    questions,
    createdBy: adminId,
    createdAt: new Date()
  };

  // Use collection insert so additional fields are persisted without schema changes.
  const insertResult = await MockTest.collection.insertOne(insertDoc);
  const test = await MockTest.findById(insertResult.insertedId);

  return {
    success: true,
    message: "Test created successfully",
    test: {
      id: test._id,
      title: test.title,
      description: test.description || "",
      duration: test.duration ?? null,
      passingCriteria: Number(test.passingCriteria) || 50,
      startDate: test.startDate || null,
      endDate: test.endDate || null,
      isPublished: Boolean(test.isPublished),
      subject: normalizeSubject(test.subject),
      testType: test.testType,
      questionsCount: test.questions.length,
      createdBy: test.createdBy,
      createdAt: test.createdAt
    }
  };
};

const listMockTests = async () => {
  // Use collection-level query so all stored metadata fields are returned even if schema omits them.
  const tests = await MockTest.collection
    .find(
      {},
      {
        projection: {
          title: 1,
          description: 1,
          duration: 1,
          passingCriteria: 1,
          startDate: 1,
          endDate: 1,
          isPublished: 1,
          subject: 1,
          testType: 1,
          questions: 1,
          createdAt: 1
        }
      }
    )
    .sort({ createdAt: -1 })
    .toArray();

  const formattedTests = tests.map((test) => ({
    _id: test._id,
    id: test._id,
    title: test.title,
    description: test.description || "",
    duration: test.duration ?? null,
    passingCriteria: Number(test.passingCriteria) || 50,
    startDate: test.startDate || null,
    endDate: test.endDate || null,
    isPublished: Boolean(test.isPublished),
    subject: normalizeSubject(test.subject),
    testType: test.testType,
    questionsCount: Array.isArray(test.questions) ? test.questions.length : 0,
    createdAt: test.createdAt
  }));
  return {
    success: true,
    tests: formattedTests
  };
};

const getMockTestById = async (testId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(String(testId))) {
    throw createError("Invalid mock test id.", 400);
  }

  // Read from collection directly so metadata fields persisted outside schema
  // (duration/startDate/endDate/isPublished) are always available to the student test engine.
  const test = await MockTest.collection.findOne({ _id: new mongoose.Types.ObjectId(String(testId)) });

  if (!test) {
    throw createError("Mock test not found.", 404);
  }

  return {
    success: true,
    test: options?.includeAnswers ? sanitizeForAdmin(test) : sanitizeForStudent(test)
  };
};

const submitMockTest = async (studentId, testId, payload) => {
  await ensureRole(studentId, ["student"]);

  const test = await MockTest.findById(testId);
  if (!test) {
    throw createError("Mock test not found.", 404);
  }

  // Auto-provision a minimal student profile for first-time test submissions.
  let studentProfile = await Student.findOne({ userId: studentId });
  if (!studentProfile) {
    studentProfile = await Student.create({
      userId: studentId
    });
  }
  await attachTestDataToStudents(studentProfile);

  const hasPriorAttemptForTest = Array.isArray(studentProfile.mockTestScores)
    ? studentProfile.mockTestScores.some((attempt) => String(attempt?.testId) === String(test._id))
    : false;

  let evaluationResult;

  if (test.testType === "MCQ") {
    evaluationResult = await evaluateMCQ(test, payload?.answers);
  } else if (test.testType === "CODING") {
    if (Array.isArray(payload?.answers)) {
      evaluationResult = await evaluateCodingTest(test, payload.answers);
    } else {
      evaluationResult = await evaluateCoding(test, payload?.sourceCode, payload?.languageId);
    }
  } else {
    throw createError("Unsupported test type.", 400);
  }

  const endTime = new Date();
  const requestedStartTime = parseStartTime(payload?.startedAt);
  const startTime = requestedStartTime && requestedStartTime <= endTime ? requestedStartTime : endTime;
  const timeTaken = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

  const scoreRecord = {
    attemptId: new mongoose.Types.ObjectId().toString(),
    isFirstAttempt: !hasPriorAttemptForTest,
    testId: test._id,
    subject: normalizeSubject(test.subject),
    score: evaluationResult.score,
    percentage: evaluationResult.percentage ?? evaluationResult.score ?? 0,
    passingPercentage: evaluationResult.passingPercentage ?? (Number(test?.passingCriteria) || 50),
    status: evaluationResult.status || "Fail",
    type: test.testType,
    startTime,
    endTime,
    timeTaken,
    totalScore: evaluationResult.totalScore ?? null,
    maxScore: evaluationResult.maxScore ?? null,
    questionWiseResults: evaluationResult.questionWiseResults ?? [],
    detailedResult: evaluationResult.detailedResult,
    takenAt: endTime
  };

  const openActivity = Array.isArray(studentProfile.testActivityLog)
    ? [...studentProfile.testActivityLog]
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => String(item?.testId) === String(test._id) && !item?.submittedAt)
        .sort(
          (a, b) =>
            new Date(b.item?.startedAt || 0).getTime() -
            new Date(a.item?.startedAt || 0).getTime()
        )[0]
    : null;

  if (openActivity) {
    await TestActivity.updateOne(
      { _id: openActivity.item._id },
      {
        $set: {
          submittedAt: endTime,
          status: "SUBMITTED"
        }
      }
    );
  } else {
    await TestActivity.create({
      studentId,
      testId: test._id,
      status: "SUBMITTED",
      startedAt: startTime,
      submittedAt: endTime
    });
  }

  await TestAttempt.create({
    studentId,
    ...scoreRecord
  });
  updateTopicStats(studentProfile, {
    ...scoreRecord,
    testQuestions: Array.isArray(test?.questions) ? test.questions : []
  });
  await studentProfile.save();
  await attachTestDataToStudents(studentProfile);
  await updateStudentSincerity(studentProfile);

  return {
    success: true,
    message: "Mock test submitted successfully.",
    attemptId: scoreRecord.attemptId,
    result: scoreRecord
  };
};

const evaluateCodingQuestionSubmission = async (studentId, payload) => {
  await ensureRole(studentId, ["student"]);

  const { question } = await resolveQuestionReference(payload?.questionId);
  const evaluation = await evaluateCodingQuestion(question, payload?.code, payload?.language);

  return {
    success: true,
    ...evaluation
  };
};

const submitCodingTest = async (studentId, payload) => {
  await ensureRole(studentId, ["student"]);

  const testId = payload?.testId;
  if (!mongoose.Types.ObjectId.isValid(String(testId))) {
    throw createError("Invalid mock test id.", 400);
  }

  const test = await MockTest.findById(testId);
  if (!test) {
    throw createError("Mock test not found.", 404);
  }

  if (String(test.testType || "").toUpperCase() !== "CODING") {
    throw createError("Only coding tests can be submitted through this endpoint.", 400);
  }

  const result = await submitMockTest(studentId, testId, {
    answers: Array.isArray(payload?.answers) ? payload.answers : [],
    startedAt: payload?.startedAt
  });

  return {
    success: true,
    attemptId: result?.attemptId || result?.result?.attemptId || null,
    totalScore: result?.result?.totalScore ?? 0,
    maxScore: result?.result?.maxScore ?? 0,
    percentage: result?.result?.percentage ?? result?.result?.score ?? 0,
    status: result?.result?.status || "Fail",
    passingPercentage: result?.result?.passingPercentage ?? 50,
    questionWiseResults: Array.isArray(result?.result?.questionWiseResults)
      ? result.result.questionWiseResults
      : [],
    result: result.result
  };
};

const markMockTestStarted = async (studentId, testId, payload = {}) => {
  await ensureRole(studentId, ["student"]);

  const test = await MockTest.findById(testId).select("_id");
  if (!test) {
    throw createError("Mock test not found.", 404);
  }

  let studentProfile = await Student.findOne({ userId: studentId });
  if (!studentProfile) {
    studentProfile = await Student.create({
      userId: studentId
    });
  }
  await attachTestDataToStudents(studentProfile);

  const startedAt = parseStartTime(payload?.startedAt) || new Date();
  const hasOpenAttempt = (studentProfile.testActivityLog || []).some(
    (entry) =>
      String(entry?.testId) === String(test._id) &&
      !entry?.submittedAt &&
      new Date(entry?.startedAt || 0).getTime() >= startedAt.getTime() - 5 * 60 * 1000
  );

  if (!hasOpenAttempt) {
    await TestActivity.create({
      studentId,
      testId: test._id,
      status: "STARTED",
      startedAt,
      submittedAt: null
    });
  }

  await attachTestDataToStudents(studentProfile);
  await updateStudentSincerity(studentProfile);

  return {
    success: true,
    message: "Mock test start recorded."
  };
};

const deleteMockTest = async (adminId, testId) => {
  await ensureRole(adminId, ["admin"]);

  const test = await MockTest.findById(testId);
  if (!test) {
    throw createError("Test not found.", 404);
  }

  await Promise.all([
    MockTest.findByIdAndDelete(testId),
    TestAttempt.deleteMany({ testId: test._id }),
    TestActivity.deleteMany({ testId: test._id })
  ]);

  return {
    success: true,
    message: "Test deleted successfully."
  };
};

const toggleMockTestPublish = async (adminId, testId) => {
  await ensureRole(adminId, ["admin"]);

  const test = await MockTest.findById(testId);
  if (!test) {
    throw createError("Test not found.", 404);
  }

  const current = Boolean(test.get("isPublished"));
  const updated = await MockTest.findByIdAndUpdate(
    testId,
    { isPublished: !current },
    { new: true, runValidators: false, strict: false }
  );

  return {
    success: true,
    isPublished: Boolean(updated?.isPublished)
  };
};

module.exports = {
  createMockTest,
  listMockTests,
  getMockTestById,
  markMockTestStarted,
  submitMockTest,
  evaluateCodingQuestionSubmission,
  submitCodingTest,
  deleteMockTest,
  toggleMockTestPublish
};
