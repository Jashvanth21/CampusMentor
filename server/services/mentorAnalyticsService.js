const User = require("../models/User");
const Student = require("../models/Student");
const { analyzeStudentPerformance } = require("../engine/performanceEngine");
const { calculateSincerityScore } = require("../engine/sincerityEngine");
const calculateRisk = require("../utils/riskCalculator");
const { attachTestDataToStudents } = require("./studentTestDataService");

const SEVERITY_RANK = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureMentorRole = async (mentorId) => {
  if (!mentorId) {
    return null;
  }

  const mentor = await User.findById(mentorId);
  if (!mentor) {
    throw createError("User account not found.", 404);
  }

  if (mentor.role !== "mentor") {
    throw createError("Only mentors can access mentor dashboard.", 403);
  }
};

const buildStudentQuery = (mentorId) => {
  if (!mentorId) {
    return {};
  }

  return { mentorId };
};

const mapAnalyticsInput = (studentProfile) => ({
  mockTestScores: (studentProfile.mockTestScores || []).map((item) => ({
    score: item.score,
    type: item.type,
    takenAt: item.takenAt,
    endTime: item.endTime,
    detailedResult: item.detailedResult,
    subject: item?.subject || item?.testId?.subject || null
  })),
  testActivityLog: (studentProfile.testActivityLog || []).map((item) => ({
    testId: item.testId,
    status: item.status,
    startedAt: item.startedAt,
    submittedAt: item.submittedAt
  }))
});

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value) => String(value || "").trim();

const getNormalizedMentorFeedback = (value) => {
  const feedback = Array.isArray(value) ? value[value.length - 1] || {} : value || {};
  return {
    feedback: normalizeText(feedback?.feedback ?? feedback?.feedbackText),
    sincerityScore:
      feedback?.sincerityScore === null || feedback?.sincerityScore === undefined
        ? null
        : toNumber(feedback?.sincerityScore, null),
    weakAreas: Array.isArray(feedback?.weakAreas) ? feedback.weakAreas : [],
    reviewed: Boolean(feedback?.reviewed),
    focusArea: normalizeText(feedback?.focusArea ?? feedback?.focus_area),
    updatedAt: feedback?.updatedAt || feedback?.createdAt || null
  };
};

const toReason = (text, code, rank) => ({
  text,
  code,
  rank
});

const buildAlertReasons = ({
  overallAverage,
  codingAverage,
  aptitudeAverage,
  mentorFeedback,
  isAtRisk
}) => {
  const reasons = [];

  if (overallAverage < 60) {
    reasons.push(toReason("Overall score below 60", "overall-low", 100));
  } else if (overallAverage >= 60 && overallAverage <= 70) {
    reasons.push(toReason("Overall score is in the caution range", "overall-caution", 60));
  }

  if (codingAverage < 50) {
    reasons.push(toReason("Coding average below 50", "coding-low", 95));
  }

  if (aptitudeAverage < 50) {
    reasons.push(toReason("Aptitude average below 50", "aptitude-low", 90));
  }

  if (isAtRisk && !mentorFeedback.updatedAt) {
    reasons.push(toReason("No mentor feedback recorded", "feedback-missing-risk", 85));
  } else if (!mentorFeedback.updatedAt) {
    reasons.push(toReason("No mentor feedback recorded yet", "feedback-missing", 30));
  }

  if (mentorFeedback.sincerityScore !== null && mentorFeedback.sincerityScore < 5) {
    reasons.push(toReason("Low mentor engagement", "mentor-engagement-low", 55));
  }

  if (!mentorFeedback.reviewed) {
    reasons.push(toReason("Pending mentor review", "pending-review", 50));
  }

  if (mentorFeedback.focusArea) {
    reasons.push(toReason(`Focus area set: ${mentorFeedback.focusArea}`, "focus-area", 5));
  }

  const deduped = [];
  const seen = new Set();

  reasons
    .sort((left, right) => right.rank - left.rank)
    .forEach((reason) => {
      if (seen.has(reason.code)) {
        return;
      }

      seen.add(reason.code);
      deduped.push(reason);
    });

  return deduped;
};

const getSeverity = ({
  overallAverage,
  codingAverage,
  aptitudeAverage,
  mentorFeedback,
  isAtRisk
}) => {
  if (
    overallAverage < 60 ||
    codingAverage < 50 ||
    aptitudeAverage < 50 ||
    (!mentorFeedback.updatedAt && isAtRisk)
  ) {
    return "HIGH";
  }

  if (
    (overallAverage >= 60 && overallAverage <= 70) ||
    (mentorFeedback.sincerityScore !== null && mentorFeedback.sincerityScore < 5) ||
    !mentorFeedback.reviewed
  ) {
    return "MEDIUM";
  }

  if (!mentorFeedback.updatedAt) {
    return "LOW";
  }

  return null;
};

const buildAlertMessage = (reasons) => {
  const phrases = reasons
    .filter((reason) => !reason.code.startsWith("focus-area"))
    .slice(0, 3)
    .map((reason) => reason.text.toLowerCase());

  if (phrases.length === 0) {
    return "Monitor student progress and maintain mentoring cadence.";
  }

  if (phrases.length === 1) {
    return phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1);
  }

  if (phrases.length === 2) {
    return `${phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1)} and ${phrases[1]}`;
  }

  return `${phrases[0].charAt(0).toUpperCase() + phrases[0].slice(1)}, ${phrases[1]}, and ${phrases[2]}`;
};

const getAlertLabel = (severity, reviewed) => {
  if (severity === "HIGH") {
    return "Needs Immediate Attention";
  }

  if (!reviewed) {
    return "Pending Review";
  }

  return "Monitor Progress";
};

const buildStudentAlert = ({
  student,
  overallAverage,
  codingAverage,
  aptitudeAverage,
  sincerityScore,
  mentorFeedback,
  isAtRisk
}) => {
  const severity = getSeverity({
    overallAverage,
    codingAverage,
    aptitudeAverage,
    mentorFeedback,
    isAtRisk
  });

  if (!severity) {
    return null;
  }

  const reasons = buildAlertReasons({
    overallAverage,
    codingAverage,
    aptitudeAverage,
    mentorFeedback,
    isAtRisk
  });

  const lowestScore = Math.min(overallAverage || 0, codingAverage || 0, aptitudeAverage || 0);

  return {
    studentId: String(student.userId?._id || student.userId || ""),
    name: student.userId?.name || "Student",
    severity,
    label: getAlertLabel(severity, mentorFeedback.reviewed),
    reasons: reasons.map((reason) => reason.text),
    message: buildAlertMessage(reasons),
    needsAttention: severity === "HIGH" || !mentorFeedback.reviewed,
    reviewed: mentorFeedback.reviewed,
    lowestScore,
    studentUserId: student.userId?._id || student.userId,
    lastFeedbackDate: mentorFeedback.updatedAt,
    lastActivity: Array.isArray(student?.mockTestScores) && student.mockTestScores.length > 0
      ? student.mockTestScores
          .map((item) => item?.takenAt || item?.endTime || item?.startTime || null)
          .filter(Boolean)
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null
      : null
  };
};

const sortAlerts = (alerts) =>
  [...alerts].sort((left, right) => {
    const severityDiff = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDiff !== 0) return severityDiff;

    if (left.reviewed !== right.reviewed) {
      return Number(left.reviewed) - Number(right.reviewed);
    }

    if (left.lowestScore !== right.lowestScore) {
      return left.lowestScore - right.lowestScore;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });

const getMentorDashboard = async (mentorId) => {
  await ensureMentorRole(mentorId);

  const students = await Student.find(buildStudentQuery(mentorId))
    .populate("userId", "name email")
    .populate({
      path: "appliedDrives",
      select: "companyName role package location driveDate"
    });
  await attachTestDataToStudents(students, { attemptPopulate: "subject" });

  if (students.length === 0) {
    return {
      summary: {
        totalStudents: 0,
        atRiskCount: 0,
        reviewedCount: 0,
        pendingReviews: 0,
        averageScore: 0
      },
      quickStats: [],
      alerts: [],
      message: "No students assigned yet."
    };
  }

  const overallAverages = [];
  let atRiskCount = 0;
  let reviewedCount = 0;
  const dedupedAlerts = new Map();

  for (const student of students) {
    const analyticsInput = mapAnalyticsInput(student);
    const performance = analyzeStudentPerformance(analyticsInput);
    const sincerity = calculateSincerityScore(analyticsInput);
    const overallAverage = toNumber(performance?.overallAverage);
    const codingAverage = toNumber(performance?.codingAverage);
    const aptitudeAverage = toNumber(performance?.subjectBreakdown?.Aptitude?.averageScorePerSubject);
    const sincerityScore = toNumber(student?.sincerityScore, NaN);
    const resolvedSincerityScore = Number.isFinite(sincerityScore)
      ? sincerityScore
      : toNumber(sincerity?.sincerityScore);

    student.sincerityScore = resolvedSincerityScore;
    await student.save();

    overallAverages.push(overallAverage);
    const mentorFeedback = getNormalizedMentorFeedback(student?.mentorFeedback);
    const isAtRisk = calculateRisk({
      averageScore: overallAverage,
      codingAverage,
      sincerityScore: resolvedSincerityScore
    });

    if (mentorFeedback.reviewed) {
      reviewedCount += 1;
    }

    if (isAtRisk && !mentorFeedback.reviewed) {
      atRiskCount += 1;
    }

    const alert = buildStudentAlert({
      student,
      overallAverage,
      codingAverage,
      aptitudeAverage,
      sincerityScore: resolvedSincerityScore,
      mentorFeedback,
      isAtRisk
    });

    if (alert?.studentId) {
      dedupedAlerts.set(alert.studentId, alert);
    }
  }

  const averageScore =
    overallAverages.length > 0
      ? Number((overallAverages.reduce((sum, value) => sum + value, 0) / overallAverages.length).toFixed(1))
      : 0;
  const pendingReviews = Math.max(0, students.length - reviewedCount);

  return {
    summary: {
      totalStudents: students.length,
      atRiskCount,
      reviewedCount,
      pendingReviews,
      averageScore
    },
    quickStats: [
      { label: "Students Tracked", value: students.length },
      { label: "Reviewed", value: reviewedCount },
      { label: "Pending Reviews", value: pendingReviews },
      { label: "Batch Average", value: averageScore }
    ],
    alerts: sortAlerts(Array.from(dedupedAlerts.values())).slice(0, 6)
  };
};

module.exports = {
  getMentorDashboard
};
