const User = require("../models/User");
const Student = require("../models/Student");
const MockTest = require("../models/MockTest");
const { analyzeStudentPerformance } = require("../engine/performanceEngine");
const { calculateSincerityScore } = require("../engine/sincerityEngine");
const { getLatestCGPARequestForStudent } = require("./cgpaRequestService");
const {
  buildAnalyticsInput,
  loadStudentWithTestData,
  TestAttempt,
  normalizeAttemptScore,
  syncFirstAttemptFlags,
  updateStudentSincerity
} = require("./studentTestDataService");
const { buildTopicStatsFromAttempts: buildStoredTopicStatsFromAttempts, getTopics } = require("../utils/topicStats");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ALL_SUBJECTS = ["Technical", "Aptitude", "Coding"];
const normalizeSubject = (subject) => (subject === "DSA" ? "Technical" : subject);
const UNTITLED_TEST_LABEL = "Untitled Test";
const ARCHIVED_TEST_LABEL = "Archived Test";

const ensureStudentRole = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw createError("User account not found.", 404);
  }

  if (user.role !== "student") {
    throw createError("Only users with student role can manage student profiles.", 403);
  }
};

const toDashboardPayload = (profile) => ({
  id: profile._id,
  userId: profile.userId,
  mentorId: profile.mentorId,
  branch: profile.branch,
  year: profile.year,
  cgpa: profile.cgpa,
  skills: profile.skills,
  mockTestScores: profile.mockTestScores,
  sincerityScore: profile.sincerityScore,
  careerRecommendations: profile.careerRecommendations,
  mentorFeedback: profile.mentorFeedback,
  performanceHistory: [],
  aiReports: [],
  interests: [],
  careerGoal: String(profile.careerGoal || "").trim(),
  weakTopics: [],
  resume: {
    fileName: "",
    fileUrl: "",
    uploadedAt: null
  },
  testActivityLog: profile.testActivityLog,
  createdAt: profile.createdAt
});

const getDefaultAnalyticsResponse = () => {
  const defaultSincerity = calculateSincerityScore({
    mockTestScores: [],
    testActivityLog: []
  });
  const missingSubjectMessages = ALL_SUBJECTS.map(
    (subject) =>
      `You have not attempted any ${subject} tests. Start practicing to build balanced preparation.`
  );

  const subjectBreakdown = ALL_SUBJECTS.reduce((acc, subject) => {
    acc[subject] = {
      averageScorePerSubject: 0,
      totalTestsPerSubject: 0
    };
    return acc;
  }, {});

  return {
    success: true,
    overallAverage: 0,
    codingAverage: 0,
    aptitudeAverage: 0,
    technicalAverage: 0,
    totalTests: 0,
    avgTimePerTest: 0,
    subjectBreakdown: ALL_SUBJECTS.map((subject) => ({
      name: subject,
      subject,
      score: 0,
      averageScore: 0,
      totalTests: 0
    })),
    subjectPerformance: ALL_SUBJECTS.map((subject) => ({
      subject,
      averageScore: 0,
      totalTests: 0
    })),
    trendData: [],
    latestAttempt: null,
    codingVsAptitude: [
      { label: "Coding", score: 0 },
      { label: "Aptitude", score: 0 }
    ],
    quickRecommendations: missingSubjectMessages,
    improvementInsights: missingSubjectMessages,
    weakSubjects: [],
    missingSubjects: ALL_SUBJECTS,
    strongSubjects: [],
    weakTopics: [],
    strongTopics: [],
    performance: {
      overallAverage: 0,
      subjectBreakdown,
      topicBreakdown: {},
      codingAverage: 0,
      mcqAverage: 0,
      weakestTopics: [],
      strongestTopics: [],
      totalTests: 0
    },
    sincerity: {
      sincerityScore: Number(defaultSincerity?.sincerityScore) || 0,
      breakdown: defaultSincerity?.breakdown || {}
    }
  };
};

const buildAnalyticsResponse = (performance, sincerity) => {
  const safePerformance = performance || {};
  const safeSincerity = sincerity || {};
  const subjectBreakdown = safePerformance.subjectBreakdown || {};

  return {
    success: true,
    overallAverage: Number(safePerformance.overallAverage) || 0,
    codingAverage: Number(safePerformance.codingAverage) || 0,
    aptitudeAverage: Number(subjectBreakdown?.Aptitude?.averageScorePerSubject) || 0,
    technicalAverage: Number(subjectBreakdown?.Technical?.averageScorePerSubject) || 0,
    totalTests: Number(safePerformance.totalTests) || 0,
    subjectPerformance: ALL_SUBJECTS.map((subject) => ({
      subject,
      averageScore: Number(subjectBreakdown?.[subject]?.averageScorePerSubject) || 0,
      totalTests: Number(subjectBreakdown?.[subject]?.totalTestsPerSubject) || 0
    })),
    weakTopics: Array.isArray(safePerformance.weakestTopics) ? safePerformance.weakestTopics : [],
    performance: safePerformance,
    sincerity: safeSincerity
  };
};

const getTopicInsights = (topicBreakdown) => {
  const entries = Object.entries(topicBreakdown || {}).map(([topic, stats]) => ({
    topic,
    accuracy: Number(stats?.accuracy) || 0,
    misses: Number(stats?.incorrectAnswers) || 0,
    totalQuestions: Number(stats?.totalQuestions) || 0
  }));

  const weakTopics = entries
    .filter((item) => item.totalQuestions > 0 && item.accuracy < 50)
    .sort((a, b) => a.accuracy - b.accuracy || b.misses - a.misses)
    .slice(0, 5);

  const strongTopics = entries
    .filter((item) => item.totalQuestions > 0 && item.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  return {
    weakTopics,
    strongTopics
  };
};

const getQuickRecommendations = ({ performance, sincerity, weakTopics, missingSubjects, weakSubjects, strongSubjects }) => {
  const output = [];
  const sincerityScore = Number(sincerity?.sincerityScore) || 0;
  const codingAverage = Number(performance?.codingAverage) || 0;
  const overallAverage = Number(performance?.overallAverage) || 0;

  if (missingSubjects.length > 0) {
    missingSubjects.forEach((subject) => {
      output.push(
        `You have not attempted any ${subject} tests. Start practicing to build balanced preparation.`
      );
    });
  }

  if (weakSubjects.length > 0) {
    output.push(`Weak subjects to prioritize: ${weakSubjects.join(", ")}.`);
  }

  if (weakTopics.length > 0) {
    output.push(`Focus on weak topics: ${weakTopics.slice(0, 2).map((t) => t.topic).join(", ")}.`);
  }
  if (codingAverage < 60) {
    output.push("Increase coding consistency with daily timed problem-solving.");
  }
  if (sincerityScore < 50) {
    output.push("Attempt tests more regularly to improve sincerity score.");
  }
  if (overallAverage >= 70) {
    output.push("Strong progress. Start mixed mock sets to sustain momentum.");
  }
  if (strongSubjects.length > 0) {
    output.push(`Strong subjects: ${strongSubjects.join(", ")}. Maintain consistency here.`);
  }
  if (output.length === 0) {
    output.push("Attempt at least one mock test this week to build baseline analytics.");
  }

  return output;
};

const deriveAttemptDurationSeconds = (attempt) => {
  const rawTimeTaken = Number(attempt?.timeTaken);
  if (Number.isFinite(rawTimeTaken) && rawTimeTaken > 0) {
    // Handle legacy records that may have stored milliseconds instead of seconds.
    if (rawTimeTaken > 60 * 60 * 12) {
      return Math.floor(rawTimeTaken / 1000);
    }
    return Math.floor(rawTimeTaken);
  }

  const startMs = new Date(attempt?.startTime || 0).getTime();
  const endMs = new Date(attempt?.takenAt || attempt?.endTime || 0).getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > 0 && endMs > startMs) {
    return Math.floor((endMs - startMs) / 1000);
  }

  return null;
};

const deriveAttemptDurationMinutes = (attempt) => {
  const durationSeconds = deriveAttemptDurationSeconds(attempt);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return Number((durationSeconds / 60).toFixed(1));
};

const getAttemptTimestamp = (attempt) => {
  const candidates = [
    attempt?.createdAt,
    attempt?.takenAt,
    attempt?.endTime,
    attempt?.startTime
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const getAttemptDisplayName = (attempt, resolvedTest = null) => {
  const title = String(resolvedTest?.title || attempt?.testId?.title || "").trim();
  if (title) {
    return title;
  }

  if (attempt?.testId === null) {
    return ARCHIVED_TEST_LABEL;
  }

  return UNTITLED_TEST_LABEL;
};

const isPopulatedTestReference = (testReference) =>
  Boolean(
    testReference &&
    typeof testReference === "object" &&
    (
      Object.prototype.hasOwnProperty.call(testReference, "title") ||
      Object.prototype.hasOwnProperty.call(testReference, "subject") ||
      Object.prototype.hasOwnProperty.call(testReference, "testType") ||
      Object.prototype.hasOwnProperty.call(testReference, "questions")
    )
  );

const getAttemptQuestionStats = (attempt) => {
  const detailedResult = attempt?.detailedResult || {};

  if (Array.isArray(detailedResult?.answers) && detailedResult.answers.length > 0) {
    const totalQuestions = detailedResult.answers.length;
    const correctAnswers = detailedResult.answers.filter((item) => item?.isCorrect).length;
    return { correctAnswers, totalQuestions };
  }

  if (Array.isArray(detailedResult?.questions) && detailedResult.questions.length > 0) {
    const totals = detailedResult.questions.reduce(
      (acc, item) => {
        acc.correctAnswers += Number(item?.passedTestCases) || 0;
        acc.totalQuestions += Number(item?.totalTestCases) || 0;
        return acc;
      },
      { correctAnswers: 0, totalQuestions: 0 }
    );

    if (totals.totalQuestions > 0) {
      return totals;
    }
  }

  const maxScore = Number(attempt?.maxScore);
  const totalScore = Number(attempt?.totalScore);
  if (Number.isFinite(maxScore) && maxScore > 0 && Number.isFinite(totalScore)) {
    return {
      correctAnswers: Math.max(0, totalScore),
      totalQuestions: maxScore
    };
  }

  return {
    correctAnswers: 0,
    totalQuestions: 0
  };
};

const mapAttemptSummary = (attempt, resolvedTest = null) => {
  const attemptTimestamp = getAttemptTimestamp(attempt);
  const questionStats = getAttemptQuestionStats(attempt);
  const normalizedScore = normalizeAttemptScore(attempt);
  const testDocument =
    resolvedTest ||
    (isPopulatedTestReference(attempt?.testId) ? attempt.testId : null);
  const testId = testDocument
    ? {
        _id: testDocument?._id || null,
        title: String(testDocument?.title || "").trim() || null,
        subject: normalizeSubject(testDocument?.subject) || null,
        testType: testDocument?.testType || null
      }
    : null;

  return {
    attemptId: attempt?.attemptId || "",
    testId,
    testName: getAttemptDisplayName(attempt, resolvedTest),
    score: normalizedScore,
    date: attemptTimestamp ? attemptTimestamp.toISOString() : null,
    type: normalizeAttemptType(attempt),
    subject: normalizeSubject(attempt?.subject || resolvedTest?.subject || attempt?.testId?.subject) || "Unknown",
    timeTaken: normalizeAttemptTimeTaken(attempt),
    isFirstAttempt: attempt?.isFirstAttempt !== false,
    attemptMode: attempt?.isFirstAttempt === false ? "Practice" : "Counted",
    correctAnswers: questionStats.correctAnswers,
    totalQuestions: questionStats.totalQuestions
  };
};

const getLatestCountedAttempt = async (userId) => {
  const latestAttempt = await TestAttempt.findOne({
    studentId: userId,
    isFirstAttempt: true
  })
    .sort({ takenAt: -1, endTime: -1, startTime: -1, _id: -1 })
    .populate("testId", "title")
    .lean();

  if (!latestAttempt) {
    return null;
  }

  return mapAttemptSummary(latestAttempt);
};

const buildExtendedAnalytics = ({ profile, performance, sincerity }) => {
  const safeMockTests = getAnalyticsAttempts(Array.isArray(profile?.mockTestScores) ? [...profile.mockTestScores] : []);
  const attemptsWithTimestamp = safeMockTests
    .map((item) => ({
      ...item,
      attemptTimestamp: getAttemptTimestamp(item)
    }))
    .filter((item) => item.attemptTimestamp);
  const sortedByTimeAsc = [...attemptsWithTimestamp]
    .sort((a, b) => a.attemptTimestamp.getTime() - b.attemptTimestamp.getTime());

  const groupedTrendData = sortedByTimeAsc.reduce((accumulator, item) => {
    const date = item.attemptTimestamp.toISOString().slice(0, 10);
    if (!accumulator[date]) {
      accumulator[date] = {
        date,
        totalScore: 0,
        count: 0
      };
    }

    accumulator[date].totalScore += normalizeAttemptScore(item);
    accumulator[date].count += 1;
    return accumulator;
  }, {});

  const trendData = Object.values(groupedTrendData).map((entry) => {
    const avgScore = entry.count > 0 ? Number((entry.totalScore / entry.count).toFixed(2)) : 0;
    return {
      date: entry.date,
      avgScore,
      score: avgScore
    };
  });

  const validAttemptTimes = sortedByTimeAsc
    .map((item) => deriveAttemptDurationMinutes(item))
    .filter((timeTaken) => Number.isFinite(timeTaken) && timeTaken > 0);

  const totalDurationMinutes = validAttemptTimes.reduce((sum, timeTaken) => sum + timeTaken, 0);
  const avgTimePerTest = validAttemptTimes.length > 0
    ? Number((totalDurationMinutes / validAttemptTimes.length).toFixed(1))
    : 0;

  const subjectBreakdown = performance?.subjectBreakdown || {};
  const subjectBreakdownArray = ALL_SUBJECTS.map((subject) => ({
    name: subject,
    subject,
    score: Number(subjectBreakdown?.[subject]?.averageScorePerSubject) || 0,
    averageScore: Number(subjectBreakdown?.[subject]?.averageScorePerSubject) || 0,
    totalTests: Number(subjectBreakdown?.[subject]?.totalTestsPerSubject) || 0
  }));

  const missingSubjects = subjectBreakdownArray
    .filter((subjectItem) => Number(subjectItem?.totalTests) === 0)
    .map((subjectItem) => subjectItem.subject);

  const weakSubjects = subjectBreakdownArray
    .filter((subjectItem) => Number(subjectItem?.totalTests) > 0 && Number(subjectItem?.averageScore) < 50)
    .map((subjectItem) => subjectItem.subject);

  const strongSubjects = subjectBreakdownArray
    .filter((subjectItem) => Number(subjectItem?.totalTests) > 0 && Number(subjectItem?.averageScore) > 80)
    .map((subjectItem) => subjectItem.subject);

  const topicInsights = getTopicInsights(performance?.topicBreakdown || {});
  const weakTopics = topicInsights.weakTopics.length > 0 ? topicInsights.weakTopics : performance?.weakestTopics || [];
  const strongTopics =
    topicInsights.strongTopics.length > 0 ? topicInsights.strongTopics : performance?.strongestTopics || [];

  const codingVsAptitude = [
    { label: "Coding", score: Number(performance?.codingAverage) || 0 },
    { label: "Aptitude", score: Number(subjectBreakdown?.Aptitude?.averageScorePerSubject) || 0 }
  ];

  const improvementInsights = [];
  if (weakSubjects.length > 0) {
    improvementInsights.push(`Weak subjects (low accuracy): ${weakSubjects.join(", ")}.`);
  }

  if (missingSubjects.length > 0) {
    missingSubjects.forEach((subject) => {
      improvementInsights.push(
        `You have not attempted any ${subject} tests. Start practicing to build balanced preparation.`
      );
    });
  }

  if (strongSubjects.length > 0) {
    improvementInsights.push(`Strong subjects: ${strongSubjects.join(", ")}.`);
  }

  if ((Number(performance?.overallAverage) || 0) < 50) {
    improvementInsights.push("Overall score is below 50%. Prioritize fundamentals and weekly mock cadence.");
  } else if ((Number(performance?.overallAverage) || 0) >= 75) {
    improvementInsights.push("Overall performance is strong. Focus on speed and consistency under time limits.");
  } else {
    improvementInsights.push("Performance is moderate. Target weak sections and tighten test strategy.");
  }

  if ((Number(performance?.codingAverage) || 0) < (Number(subjectBreakdown?.Aptitude?.averageScorePerSubject) || 0)) {
    improvementInsights.push("Coding trails aptitude. Increase implementation practice and debugging drills.");
  } else {
    improvementInsights.push("Coding pace is healthy. Balance with aptitude/theory reinforcement.");
  }

  if ((Number(sincerity?.sincerityScore) || 0) < 50) {
    improvementInsights.push("Sincerity score indicates low consistency. Maintain a fixed weekly attempt schedule.");
  }

  const quickRecommendations = getQuickRecommendations({
    performance,
    sincerity,
    weakTopics,
    missingSubjects,
    weakSubjects,
    strongSubjects
  });

  return {
    avgTimePerTest,
    aptitudeAverage: Number(subjectBreakdown?.Aptitude?.averageScorePerSubject) || 0,
    subjectBreakdown: subjectBreakdownArray,
    technicalAverage: Number(subjectBreakdown?.Technical?.averageScorePerSubject) || 0,
    trendData,
    codingVsAptitude,
    weakSubjects,
    missingSubjects,
    strongSubjects,
    weakTopics,
    strongTopics,
    quickRecommendations,
    improvementInsights: improvementInsights.slice(0, 4)
  };
};

const createStudentProfile = async (userId, data) => {
  await ensureStudentRole(userId);

  const existing = await Student.findOne({ userId });
  if (existing) {
    throw createError("Student profile already exists for this user.", 409);
  }

  const profile = await Student.create({
    userId,
    mentorId: data.mentorId || null,
    branch: data.branch,
    year: data.year,
    cgpa: null,
    skills: data.skills || [],
    careerGoal: String(data.careerGoal || "").trim(),
    sincerityScore: data.sincerityScore ?? 0,
    careerRecommendations: data.careerRecommendations || [],
    mentorFeedback: data.mentorFeedback || []
  });

  return {
    success: true,
    message: "Student profile created successfully.",
    profile: toDashboardPayload(profile)
  };
};

const updateStudentProfile = async (userId, data) => {
  await ensureStudentRole(userId);

  const profile = await Student.findOne({ userId });
  if (!profile) {
    throw createError("Student profile not found.", 404);
  }

  const updatableFields = [
    "skills"
  ];

  for (const field of updatableFields) {
    if (data[field] !== undefined) {
      profile[field] = data[field];
    }
  }

  if (data.careerGoal !== undefined) {
    profile.careerGoal = String(data.careerGoal || "").trim();
  }

  await profile.save();

  return {
    success: true,
    message: "Student profile updated successfully.",
    profile: toDashboardPayload(profile)
  };
};

const getStudentProfile = async (userId) => {
  await ensureStudentRole(userId);

  const [user, profile] = await Promise.all([
    User.findById(userId).select("name email branch year"),
    Student.findOne({ userId }).select("branch year cgpa skills careerGoal createdAt")
  ]);

  if (!user || !profile) {
    throw createError("Student profile not found.", 404);
  }

  const latestCGPARequest = await getLatestCGPARequestForStudent(userId);

  return {
    success: true,
    profile: {
      userId,
      fullName: user.name || "",
      email: user.email || "",
      branch: profile.branch || user.branch || "",
      year: profile.year ?? user.year ?? null,
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      interests: [],
      careerGoal: String(profile.careerGoal || "").trim(),
      weakTopics: [],
      resume: { fileName: "", fileUrl: "", uploadedAt: null },
      cgpa: profile.cgpa ?? null,
      latestCGPARequest
    }
  };
};

const getStudentDashboard = async (userId) => {
  await ensureStudentRole(userId);

  const profile = await loadStudentWithTestData({ userId });
  if (!profile) {
    throw createError("Student profile not found.", 404);
  }

  await ensureFirstAttemptFlags(profile);

  const analyticsInput = buildAnalyticsInput({
    ...profile,
    mockTestScores: getAnalyticsAttempts(profile.mockTestScores || [])
  });

  const performance = analyzeStudentPerformance(analyticsInput);
  const sincerity = await updateStudentSincerity(profile);

  const rawCgpa = profile?.cgpa;
  const hasCgpa = rawCgpa !== null && rawCgpa !== undefined && Number.isFinite(Number(rawCgpa));

  return {
    success: true,
    overallAverage: Number(performance?.overallAverage) || 0,
    codingAverage: Number(performance?.codingAverage) || 0,
    totalTests: Number(performance?.totalTests) || 0,
    sincerityScore: Number(sincerity?.sincerityScore) || 0,
    cgpa: hasCgpa ? Number(rawCgpa) : null,
    dashboard: toDashboardPayload(profile)
  };
};

const getStudentAnalytics = async (userId) => {
  await ensureStudentRole(userId);

  const profile = await loadStudentWithTestData(
    { userId },
    {
      attemptPopulate: "subject title questions"
    }
  );
  if (!profile) {
    return getDefaultAnalyticsResponse();
  }

  await ensureFirstAttemptFlags(profile);

  const analyticsInput = buildAnalyticsInput({
    ...profile,
    mockTestScores: getAnalyticsAttempts(profile.mockTestScores || []).map((item) => ({
      ...item,
      score: normalizeAttemptScore(item),
      subject: normalizeSubject(item?.subject || item?.testId?.subject) || null
    }))
  });

  console.log("Analytics Data:", Array.isArray(profile?.mockTestScores) ? profile.mockTestScores : []);

  const performance = analyzeStudentPerformance(analyticsInput);
  const sincerity = await updateStudentSincerity(profile);
  const derivedTopicStats =
    Array.isArray(profile?.topicStats) && profile.topicStats.length > 0
      ? profile.topicStats
      : buildStoredTopicStatsFromAttempts(getAnalyticsAttempts(profile.mockTestScores || []));
  const topicLists = getTopics(derivedTopicStats);

  const baseResponse = buildAnalyticsResponse(performance, sincerity);
  const extended = buildExtendedAnalytics({ profile, performance, sincerity });
  const latestAttempt = await getLatestCountedAttempt(userId);

  return {
    ...baseResponse,
    ...extended,
    latestAttempt,
    strongTopics: topicLists.strongTopics,
    weakTopics: topicLists.weakTopics,
    aiAnalytics: profile?.aiAnalyticsCache || null
  };
};

const normalizeAttemptType = (attempt) => {
  const subject = String(attempt?.subject || attempt?.testId?.subject || "").trim();
  if (subject === "Aptitude") return "Aptitude";
  if (subject === "Coding") return "Coding";
  if (subject === "DSA" || subject === "Technical") return "Technical";

  return String(attempt?.type || "").toUpperCase() === "CODING" ? "Coding" : "Technical";
};

const resolveAttemptTest = async (attempt) => {
  if (isPopulatedTestReference(attempt?.testId)) {
    return attempt.testId;
  }

  const rawTestId = attempt?.testId?._id || attempt?.testId;
  if (!rawTestId) {
    return null;
  }

  return MockTest.findById(rawTestId).select("title subject testType questions").lean();
};

const normalizeAttemptTimeTaken = (attempt) => {
  const rawTimeTaken = attempt?.timeTaken;
  if (rawTimeTaken === null || rawTimeTaken === undefined || rawTimeTaken === "") {
    return null;
  }

  const numericTimeTaken = Number(rawTimeTaken);
  return Number.isFinite(numericTimeTaken) && numericTimeTaken >= 0 ? numericTimeTaken : null;
};

const sortAttemptsByTime = (attempts) =>
  [...attempts].sort((a, b) => {
    const left = new Date(a?.takenAt || a?.endTime || a?.startTime || 0).getTime();
    const right = new Date(b?.takenAt || b?.endTime || b?.startTime || 0).getTime();
    return left - right;
  });

const ensureFirstAttemptFlags = async (profile) => {
  if (!profile) {
    return profile;
  }

  profile.mockTestScores = await syncFirstAttemptFlags(profile.userId);
  return profile;
};

const getAnalyticsAttempts = (attempts) =>
  (Array.isArray(attempts) ? attempts : []).filter((attempt) => attempt?.isFirstAttempt !== false);

const ensureAttemptIds = async (profile) => {
  return profile;
};

const buildAttemptReviewPayload = async (attempt) => {
  const resolvedTest = await resolveAttemptTest(attempt);
  const resolvedSubject = normalizeSubject(attempt?.subject || resolvedTest?.subject || attempt?.testId?.subject || "");
  const detailedResult = attempt?.detailedResult || {};
  const questionWiseResults = Array.isArray(attempt?.questionWiseResults) && attempt.questionWiseResults.length > 0
    ? attempt.questionWiseResults
      : Array.isArray(detailedResult?.questions)
      ? detailedResult.questions
      : [];
  const totalScore = Number(attempt?.totalScore);
  const maxScore = Number(attempt?.maxScore);
  const percentage = Number(attempt?.score) || 0;
  const isCodingAttempt =
    String(resolvedTest?.testType || "").toUpperCase() === "CODING" ||
    resolvedSubject === "Coding";

  const testQuestions = Array.isArray(resolvedTest?.questions) ? resolvedTest.questions : [];

  const questions = isCodingAttempt
    ? questionWiseResults.map((question, index) => {
      const sourceQuestion = testQuestions[index] || {};
      return {
        questionId: question?.questionId || `${attempt?.attemptId || "attempt"}:${index}`,
        title: question?.questionTitle || `Question ${index + 1}`,
        problemStatement: question?.problemStatement || sourceQuestion?.problemStatement || sourceQuestion?.questionText || "",
        constraints: sourceQuestion?.constraints || "",
        sampleInput: sourceQuestion?.sampleInput || "",
        sampleOutput: sourceQuestion?.sampleOutput || "",
        code: question?.code || "",
        languageId: Number(question?.languageId) || 71,
        language: question?.languageLabel || "Python 3",
        passedTestCases: Number(question?.passedTestCases) || 0,
        totalTestCases: Number(question?.totalTestCases) || 0,
        marksObtained: Number(question?.marksObtained ?? question?.marks) || 0,
        maxMarks: Number(question?.maxMarks) || 0,
        verdict: question?.verdict || "Wrong",
        cases: Array.isArray(question?.cases) ? question.cases.map((caseItem, caseIndex) => ({
          caseIndex,
          input: caseItem?.input || "",
          expectedOutput: caseItem?.expectedOutput || "",
          actualOutput: caseItem?.actualOutput || "",
          stderr: caseItem?.stderr || "",
          compileOutput: caseItem?.compileOutput || "",
          passed: Boolean(caseItem?.passed)
        })) : []
      };
    })
    : questionWiseResults.map((question, index) => {
      const sourceQuestion = testQuestions[index] || {};
      return {
        questionId: `${attempt?.attemptId || "attempt"}:mcq:${index}`,
        title: question?.questionText || sourceQuestion?.questionText || `Question ${index + 1}`,
        problemStatement: "",
        options: Array.isArray(question?.options)
          ? question.options
          : Array.isArray(sourceQuestion?.options)
            ? sourceQuestion.options
            : [],
        code: "",
        languageId: null,
        language: "",
        passedTestCases: question?.isCorrect ? 1 : 0,
        totalTestCases: 1,
        marksObtained: Number(question?.marks) || 0,
        maxMarks: Number(question?.maxMarks) || 0,
        verdict: question?.isCorrect ? "Accepted" : "Wrong",
        userAnswer: question?.submittedAnswer ?? null,
        correctAnswer: question?.correctAnswer ?? null,
        explanation:
          question?.explanation ||
          sourceQuestion?.explanation ||
          (sourceQuestion?.topic
            ? `Review the ${sourceQuestion.topic} concept for this question.`
            : ""),
        cases: []
      };
    });

  return {
    success: true,
    attempt: {
      id: attempt?.attemptId || "",
      testId: resolvedTest
        ? {
            _id: resolvedTest?._id || null,
            title: String(resolvedTest?.title || "").trim() || null,
            subject: normalizeSubject(resolvedTest?.subject) || null,
            testType: resolvedTest?.testType || null,
            duration: resolvedTest?.duration ?? null
          }
        : null,
      testTitle: String(resolvedTest?.title || "").trim() || null,
      testName: String(resolvedTest?.title || "").trim() || ARCHIVED_TEST_LABEL,
      type: resolvedSubject || normalizeAttemptType(attempt),
      difficulty: attempt?.difficulty || resolvedTest?.difficulty || "Standard",
      isFirstAttempt: attempt?.isFirstAttempt !== false,
      attemptMode: attempt?.isFirstAttempt === false ? "Practice" : "Counted",
      submittedAt: attempt?.takenAt || attempt?.endTime || attempt?.startTime || null,
      score: percentage,
      totalScore: Number.isFinite(totalScore) ? totalScore : null,
      maxScore: Number.isFinite(maxScore) ? maxScore : null,
      percentage,
      timeTaken: normalizeAttemptTimeTaken(attempt),
      summary: {
        totalCases: Number(detailedResult?.totalCases) || 0,
        passedCases: Number(detailedResult?.passedCases) || 0,
        failedCases: Number(detailedResult?.failedCases) || 0
      },
      questions
    }
  };
};

const getStudentAttemptHistory = async (userId) => {
  await ensureStudentRole(userId);

  const profile = await loadStudentWithTestData(
    { userId },
    {
      select: "userId"
    }
  );

  await ensureAttemptIds(profile);
  await ensureFirstAttemptFlags(profile);

  const rawAttempts = profile
    ? await TestAttempt.find({ studentId: userId })
        .sort({ takenAt: 1, startTime: 1, _id: 1 })
        .populate("testId", "title subject testType")
        .lean()
    : [];
  const mappedAttempts = rawAttempts
    .map((attempt) => mapAttemptSummary(attempt))
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const countedAttempts = mappedAttempts.filter((attempt) => attempt.isFirstAttempt);
  const totalAttempts = countedAttempts.length;
  const averageScore = totalAttempts
    ? Number((countedAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts).toFixed(2))
    : 0;
  const latestScore = totalAttempts ? Number(countedAttempts[0].score.toFixed(2)) : 0;

  const performanceTrend = [...countedAttempts]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((attempt) => ({
      date: attempt.date.slice(0, 10),
      score: attempt.score
    }));

  return {
    success: true,
    totalAttempts,
    averageScore,
    latestScore,
    performanceTrend,
    practiceAttempts: mappedAttempts.filter((attempt) => !attempt.isFirstAttempt).length,
    attempts: mappedAttempts
  };
};

const getStudentAttemptResult = async (userId, attemptId) => {
  await ensureStudentRole(userId);

  const safeAttemptId = String(attemptId || "").trim();
  if (!safeAttemptId) {
    throw createError("Attempt id is required.", 400);
  }

  const profile = await loadStudentWithTestData(
    { userId },
    {
      select: "userId",
      attemptPopulate: "title subject questions"
    }
  );

  if (!profile) {
    throw createError("Student profile not found.", 404);
  }

  await ensureAttemptIds(profile);
  await ensureFirstAttemptFlags(profile);

  const matchedAttempt = await TestAttempt.findOne({
    studentId: userId,
    attemptId: safeAttemptId
  })
    .populate("testId", "title subject testType duration questions")
    .lean();

  if (!matchedAttempt) {
    throw createError("Attempt not found.", 404);
  }

  return buildAttemptReviewPayload(matchedAttempt);
};

const buildTopicStatsFromAttempts = (attempts) => {
  const topicStats = {};

  attempts.forEach((attempt) => {
    const answers = Array.isArray(attempt?.detailedResult?.answers) ? attempt.detailedResult.answers : [];
    if (answers.length > 0) {
      answers.forEach((answerItem) => {
        const topic = String(answerItem?.topic || "General").trim() || "General";
        if (!topicStats[topic]) {
          topicStats[topic] = {
            totalQuestions: 0,
            correctAnswers: 0
          };
        }
        topicStats[topic].totalQuestions += 1;
        if (answerItem?.isCorrect) {
          topicStats[topic].correctAnswers += 1;
        }
      });
      return;
    }

    const codingQuestions = Array.isArray(attempt?.detailedResult?.questions) ? attempt.detailedResult.questions : [];
    const testQuestions = Array.isArray(attempt?.testId?.questions) ? attempt.testId.questions : [];
    if (codingQuestions.length > 0) {
      codingQuestions.forEach((questionItem) => {
        const questionIndex = Number(questionItem?.questionIndex);
        const topic =
          String(
            questionItem?.topic ||
              (Number.isInteger(questionIndex) ? testQuestions[questionIndex]?.topic : null) ||
              "General"
          ).trim() || "General";
        const totalTestCases = Math.max(1, Number(questionItem?.totalTestCases) || 0);
        const passedTestCases = Math.max(0, Number(questionItem?.passedTestCases) || 0);

        if (!topicStats[topic]) {
          topicStats[topic] = {
            totalQuestions: 0,
            correctAnswers: 0
          };
        }

        topicStats[topic].totalQuestions += totalTestCases;
        topicStats[topic].correctAnswers += passedTestCases;
      });
      return;
    }

    // Backward compatibility for older attempts that stored only misses by topic.
    const weakTopics = Array.isArray(attempt?.detailedResult?.weakTopics) ? attempt.detailedResult.weakTopics : [];
    weakTopics.forEach((item) => {
      const topic = String(item?.topic || "").trim();
      if (!topic) return;
      const misses = Number(item?.misses) || 0;
      if (misses <= 0) return;

      if (!topicStats[topic]) {
        topicStats[topic] = {
          totalQuestions: 0,
          correctAnswers: 0
        };
      }
      topicStats[topic].totalQuestions += misses;
    });
  });

  return Object.entries(topicStats).map(([topic, stats]) => {
    const totalQuestions = Number(stats?.totalQuestions) || 0;
    const correctAnswers = Number(stats?.correctAnswers) || 0;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    return {
      topic,
      totalQuestions,
      correctAnswers,
      accuracy
    };
  });
};

const getStudentTopicAnalytics = async (userId) => {
  await ensureStudentRole(userId);

  const profile = await loadStudentWithTestData(
    { userId },
    {
      select: "userId",
      attemptPopulate: "questions"
    }
  );

  await ensureFirstAttemptFlags(profile);

  const attempts = getAnalyticsAttempts(Array.isArray(profile?.mockTestScores) ? profile.mockTestScores : []);
  const totalAttempts = attempts.length;
  const topicStats =
    Array.isArray(profile?.topicStats) && profile.topicStats.length > 0
      ? profile.topicStats.map((item) => ({
          topic: item?.topic,
          totalQuestions: Number(item?.total) || 0,
          correctAnswers: Number(item?.correct) || 0,
          accuracy:
            Number(item?.total) > 0
              ? (Number(item?.correct) / Number(item?.total)) * 100
              : 0
        }))
      : buildStoredTopicStatsFromAttempts(attempts).map((item) => ({
          topic: item?.topic,
          totalQuestions: Number(item?.total) || 0,
          correctAnswers: Number(item?.correct) || 0,
          accuracy:
            Number(item?.total) > 0
              ? (Number(item?.correct) / Number(item?.total)) * 100
              : 0
        }));

  if (totalAttempts < 3) {
    const preliminaryStrongTopics = topicStats
      .filter((item) => item.totalQuestions > 0 && item.accuracy > 70)
      .sort((a, b) => b.accuracy - a.accuracy || b.totalQuestions - a.totalQuestions)
      .map((item) => item.topic);

    return {
      success: true,
      totalAttempts,
      weakTopics: [],
      strongTopics: [],
      preliminaryStrongTopics,
      dataSufficient: false
    };
  }

  const weakTopics = topicStats
    .filter((item) => item.totalQuestions > 0 && item.accuracy < 50)
    .sort((a, b) => a.accuracy - b.accuracy || b.totalQuestions - a.totalQuestions)
    .map((item) => item.topic);

  const strongTopics = topicStats
    .filter((item) => item.totalQuestions > 0 && item.accuracy >= 70)
    .sort((a, b) => b.accuracy - a.accuracy || b.totalQuestions - a.totalQuestions)
    .map((item) => item.topic);

  return {
    success: true,
    totalAttempts,
    weakTopics,
    strongTopics,
    preliminaryStrongTopics: [],
    dataSufficient: true
  };
};

const getStudentFeedback = async (userId) => {
  await ensureStudentRole(userId);

  const profile = await Student.findOne({ userId })
    .populate("feedback.mentorId", "name email")
    .select("feedback");

  const feedbackEntries = Array.isArray(profile?.feedback) ? profile.feedback : [];
  const feedback = feedbackEntries
    .map((item, index) => ({
      id: `${String(item?.mentorId?._id || item?.mentorId || "mentor")}-${index}-${new Date(item?.createdAt || Date.now()).getTime()}`,
      mentorId: item?.mentorId?._id || item?.mentorId || null,
      mentorName: item?.mentorId?.name || "Mentor",
      mentorEmail: item?.mentorId?.email || "",
      comment: String(item?.comment || "").trim(),
      sincerityScore:
        item?.sincerityScore === null || item?.sincerityScore === undefined
          ? null
          : Number(item.sincerityScore),
      focusArea: String(item?.focusArea || "").trim(),
      weakAreas: Array.isArray(item?.weakAreas) ? item.weakAreas.filter(Boolean) : [],
      createdAt: item?.createdAt || null
    }))
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());

  return {
    success: true,
    feedback
  };
};

module.exports = {
  createStudentProfile,
  updateStudentProfile,
  getStudentProfile,
  getStudentDashboard,
  getStudentAnalytics,
  getStudentAttemptHistory,
  getStudentAttemptResult,
  buildAttemptReviewPayload,
  getStudentTopicAnalytics,
  getStudentFeedback,
  ensureStudentRole,
  ensureFirstAttemptFlags,
  getAnalyticsAttempts
};
