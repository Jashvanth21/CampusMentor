const User = require("../models/User");
const Student = require("../models/Student");
const PlacementDrive = require("../models/PlacementDrive");
const PlacementApplication = require("../models/PlacementApplication");
const { analyzeStudentPerformance } = require("../engine/performanceEngine");
const { calculateSincerityScore } = require("../engine/sincerityEngine");
const { generateCareerRecommendations } = require("../engine/recommendationEngine");
const { evaluateEligibility } = require("./placementService");
const calculateRisk = require("../utils/riskCalculator");
const { attachTestDataToStudents, loadStudentWithTestData } = require("./studentTestDataService");
const { getAttemptAnalysis } = require("./attemptAnalysisService");
const { buildAttemptReviewPayload } = require("./studentService");

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
    throw createError("Only mentors can access mentor tools.", 403);
  }
};

const resolveMentorId = (mentorId, fallbackMentorId = null) => mentorId || fallbackMentorId || null;

const buildStudentQuery = (mentorId) => {
  if (!mentorId) {
    return {};
  }

  return { mentorId };
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value) => String(value || "").trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const uniqueTextList = (items, limit = 8) => {
  const seen = new Set();
  const output = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const label = normalizeText(item);
    const key = normalizeKey(label);
    if (!label || seen.has(key)) {
      return;
    }

    seen.add(key);
    output.push(label);
  });

  return output.slice(0, limit);
};

const normalizeSubject = (subject) => {
  if (subject === "DSA") {
    return "Technical";
  }

  return subject;
};

const getAttemptPercent = (attempt) => {
  const totalScore = toNumber(attempt?.totalScore, NaN);
  const maxScore = toNumber(attempt?.maxScore, NaN);

  if (Number.isFinite(totalScore) && Number.isFinite(maxScore) && maxScore > 0) {
    return Number(((totalScore / maxScore) * 100).toFixed(2));
  }

  return toNumber(attempt?.score);
};

const getAttemptTimeTakenSeconds = (attempt) => {
  const rawTimeTaken = Number(attempt?.timeTaken);
  if (Number.isFinite(rawTimeTaken) && rawTimeTaken > 0) {
    return Math.floor(rawTimeTaken);
  }

  const startMs = new Date(attempt?.startTime || 0).getTime();
  const endMs = new Date(attempt?.takenAt || attempt?.endTime || 0).getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > 0 && endMs > startMs) {
    return Math.floor((endMs - startMs) / 1000);
  }

  return null;
};

const buildAttemptTrend = (studentProfile) => {
  const attempts = Array.isArray(studentProfile?.mockTestScores) ? [...studentProfile.mockTestScores] : [];

  return attempts
    .map((attempt) => {
      const attemptedAt = attempt?.takenAt || attempt?.endTime || attempt?.submittedAt || attempt?.startTime || null;
      const date = attemptedAt ? new Date(attemptedAt) : null;
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
      }

      return {
        date: date.toISOString(),
        score: getAttemptPercent(attempt),
        testType: attempt?.type || "MCQ",
        submittedAt: date.toISOString()
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const buildAnalyticsPromptData = (studentProfile) => {
  const attempts = (Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : []).filter(
    (attempt) => attempt?.isFirstAttempt !== false
  );

  return {
    attempts: attempts
      .map((attempt) => {
        const takenAt = attempt?.takenAt || attempt?.endTime || attempt?.submittedAt || attempt?.startTime || null;
        if (!takenAt) {
          return null;
        }

        return {
          attemptId: attempt?.attemptId || "",
          score: getAttemptPercent(attempt),
          takenAt,
          timeTaken: getAttemptTimeTakenSeconds(attempt)
        };
      })
      .filter(Boolean)
  };
};

const getAttemptId = (attempt) => String(attempt?.attemptId || attempt?._id || attempt?.id || "").trim();

const getAttemptPercentLabel = (attempt) => `${getAttemptPercent(attempt).toFixed(1)}%`;

const buildMentorAttemptSummary = (attempt) => {
  const attemptedAt = attempt?.takenAt || attempt?.endTime || attempt?.submittedAt || attempt?.startTime || null;
  const subject = normalizeSubject(attempt?.subject || attempt?.testId?.subject) || "Unknown";

  return {
    id: getAttemptId(attempt),
    attemptId: getAttemptId(attempt),
    testId: attempt?.testId?._id || attempt?.testId || null,
    testName: attempt?.testId?.title || attempt?.testName || "Mock Test",
    title: attempt?.testId?.title || attempt?.testName || "Mock Test",
    subject,
    category: subject,
    type: subject === "Coding" || String(attempt?.type || "").toUpperCase() === "CODING" ? "Coding" : "MCQ",
    status: attempt?.status || "Completed",
    score: getAttemptPercent(attempt),
    scoreLabel: getAttemptPercentLabel(attempt),
    totalScore: Number.isFinite(Number(attempt?.totalScore)) ? Number(attempt.totalScore) : null,
    maxScore: Number.isFinite(Number(attempt?.maxScore)) ? Number(attempt.maxScore) : null,
    attemptedAt,
    date: attemptedAt,
    dateLabel: attemptedAt ? new Date(attemptedAt).toLocaleString() : "Date unavailable",
    timeTaken: getAttemptTimeTakenSeconds(attempt),
    isFirstAttempt: attempt?.isFirstAttempt !== false,
    attemptMode: attempt?.isFirstAttempt === false ? "Practice" : "Counted",
    hasAnalysis: Boolean(attempt?.aiAnalysis?.summary),
    codingScore: subject === "Coding" ? getAttemptPercent(attempt) : null,
    aptitudeScore: subject === "Aptitude" ? getAttemptPercent(attempt) : null,
    technicalScore: subject === "Technical" ? getAttemptPercent(attempt) : null
  };
};

const buildMentorAttemptReviewList = (studentProfile) =>
  (Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : [])
    .map(buildMentorAttemptSummary)
    .filter((attempt) => attempt.attemptId)
    .sort((left, right) => new Date(right.attemptedAt || 0).getTime() - new Date(left.attemptedAt || 0).getTime());

const normalizeInsightList = (items, limit = 6) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      return item?.topic || item?.title || item?.label || item?.text || item?.recommendation || "";
    })
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, limit);
};

const buildMentorAiInsights = (studentProfile, performance, sincerity, careerRecommendations) => {
  const cache = studentProfile?.aiAnalyticsCache && typeof studentProfile.aiAnalyticsCache === "object"
    ? studentProfile.aiAnalyticsCache
    : {};
  const sections = cache?.sections || {};
  const summary =
    normalizeText(cache?.summary) ||
    normalizeText(cache?.performanceSummary) ||
    normalizeText(cache?.insights?.summary) ||
    `${studentProfile?.userId?.name || "This student"} has an overall average of ${toNumber(performance?.overallAverage).toFixed(1)}% across ${toNumber(performance?.totalTests)} test attempts.`;

  return {
    ...cache,
    summary,
    performanceSummary: summary,
    strengths: normalizeInsightList(cache?.strengths || cache?.strongAreas || cache?.insights?.strengths || performance?.strongestTopics),
    weaknesses: normalizeInsightList(cache?.weaknesses || cache?.weakAreas || cache?.insights?.weaknesses || performance?.weakestTopics),
    improvementAreas: normalizeInsightList(cache?.improvementAreas || cache?.areasToImprove || careerRecommendations?.areasToImprove),
    preparationInsights: normalizeInsightList(cache?.preparationInsights || cache?.studyPlan || cache?.recommendations),
    placementReadiness:
      normalizeText(cache?.placementReadiness) ||
      normalizeText(cache?.placement?.readiness) ||
      performance?.placementStatus ||
      "Not Ready",
    careerRecommendations: normalizeInsightList(
      cache?.careerRecommendations ||
        cache?.careerPaths ||
        careerRecommendations?.careerRecommendations ||
        careerRecommendations?.recommendedRoles
    ),
    studyRecommendations: normalizeInsightList(cache?.studyRecommendations || cache?.nextSteps || careerRecommendations?.studyRecommendations),
    sincerityInsights:
      normalizeText(cache?.sincerityInsights) ||
      normalizeText(cache?.engagementInsights) ||
      `Engagement score: ${toNumber(sincerity?.sincerityScore).toFixed(1)}%.`,
    sections,
    generatedAt: cache?.generatedAt || studentProfile?.aiAnalyticsLastUpdated || null,
    promptData: buildAnalyticsPromptData(studentProfile)
  };
};

const getPlacementStatus = (avgScore, codingAvg, mcqAvg, attemptsCount) => {
  if (attemptsCount < 2) {
    return "Not Ready";
  }

  if (avgScore >= 75 && codingAvg >= 60) {
    return "Ready";
  }

  if (avgScore >= 60) {
    return "Likely Eligible";
  }

  return "Not Ready";
};

const buildPerformanceSummary = (studentProfile, basePerformance) => {
  const attempts = Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : [];
  const trend = buildAttemptTrend(studentProfile);
  const mcqAttempts = attempts.filter((attempt) => String(attempt?.type || "").toUpperCase() === "MCQ");
  const codingAttempts = attempts.filter((attempt) => String(attempt?.type || "").toUpperCase() === "CODING");

  const averageFromAttempts = (items) => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    const totalPercent = items.reduce((sum, item) => sum + getAttemptPercent(item), 0);
    return Number((totalPercent / items.length).toFixed(2));
  };

  const overallAverage = averageFromAttempts(attempts);
  const mcqAverage = averageFromAttempts(mcqAttempts);
  const codingAverage = averageFromAttempts(codingAttempts);
  const avgScore = overallAverage;
  const aptitudeAverage = Number(basePerformance?.subjectBreakdown?.Aptitude?.averageScorePerSubject) || 0;
  const placementStatus = getPlacementStatus(avgScore, codingAverage, mcqAverage, attempts.length);
  const riskStatus = calculateRisk({
    averageScore: overallAverage,
    codingAverage,
    aptitudeAverage
  })
    ? "At Risk"
    : "Safe";

  return {
    ...basePerformance,
    overallAverage,
    mcqAverage,
    codingAverage,
    aptitudeAverage,
    totalTests: attempts.length,
    history: trend,
    attempts: trend,
    placementStatus,
    riskStatus
  };
};

const mapAnalyticsInput = (studentProfile) => ({
  mockTestScores: (studentProfile.mockTestScores || []).map((item) => ({
    score: item.score,
    type: item.type,
    takenAt: item.takenAt,
    endTime: item.endTime,
    detailedResult: item.detailedResult,
    subject: normalizeSubject(item?.subject || item?.testId?.subject) || null
  })),
  testActivityLog: (studentProfile.testActivityLog || []).map((item) => ({
    testId: item.testId,
    status: item.status,
    startedAt: item.startedAt,
    submittedAt: item.submittedAt
  }))
});

const extractWeakTopics = (performance) =>
  uniqueTextList(
    (Array.isArray(performance?.weakestTopics) ? performance.weakestTopics : []).map((item) => item?.topic || item),
    6
  );

const extractStrongTopics = (performance) =>
  uniqueTextList(
    (Array.isArray(performance?.strongestTopics) ? performance.strongestTopics : []).map((item) => item?.topic || item),
    6
  );

const getRiskReasons = ({ overallAverage, codingAverage, aptitudeAverage, mentorFeedback = null }) => {
  const reasons = [];

  if (overallAverage < 60) {
    reasons.push("Average score below 60.");
  }
  if (codingAverage < 50) {
    reasons.push("Coding average below 50.");
  }
  if (aptitudeAverage < 50) {
    reasons.push("Aptitude average below 50.");
  }

  const mentorSincerity = toNumber(mentorFeedback?.sincerityScore, NaN);
  if (Number.isFinite(mentorSincerity) && mentorSincerity <= 4) {
    reasons.push("Mentor sincerity score indicates low engagement.");
  }

  if (Array.isArray(mentorFeedback?.weakAreas) && mentorFeedback.weakAreas.length > 0) {
    reasons.push(`Mentor flagged weak areas: ${mentorFeedback.weakAreas.slice(0, 3).join(", ")}.`);
  }

  return reasons;
};

const getMentorFeedbackSnapshot = (studentProfile) => {
  const rawFeedback = studentProfile?.mentorFeedback;
  const feedback = Array.isArray(rawFeedback)
    ? rawFeedback[rawFeedback.length - 1] || {}
    : rawFeedback || {};

  return {
    feedback: normalizeText(feedback?.feedback ?? feedback?.feedbackText),
    sincerityScore: feedback?.sincerityScore === null || feedback?.sincerityScore === undefined
      ? null
      : toNumber(feedback?.sincerityScore, null),
    weakAreas: uniqueTextList(feedback?.weakAreas || feedback?.weak_areas || [], 8),
    reviewed: Boolean(feedback?.reviewed),
    focusArea: normalizeText(feedback?.focusArea ?? feedback?.focus_area),
    updatedAt: feedback?.updatedAt || feedback?.createdAt || null
  };
};

const buildPlacementStatusMap = async (students = []) => {
  const studentIds = (Array.isArray(students) ? students : [])
    .map((student) => String(student?.userId?._id || student?.userId || "").trim())
    .filter(Boolean);

  if (studentIds.length === 0) {
    return new Map();
  }

  const applications = await PlacementApplication.find({
    studentId: { $in: studentIds }
  })
    .populate("driveId", "companyName role package")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const placementByStudentId = new Map();

  applications.forEach((application) => {
    const studentId = String(application?.studentId || "").trim();
    if (!studentId || placementByStudentId.has(studentId)) {
      return;
    }

    const normalizedStatus = String(application?.status || "applied").trim().toLowerCase();
    const drive = application?.driveId || {};

    placementByStudentId.set(studentId, {
      status: normalizedStatus === "placed"
        ? "placed"
        : normalizedStatus === "applied" || normalizedStatus === "shortlisted"
            ? "applied"
            : "not_applied",
      companyName: String(drive?.companyName || "").trim(),
      role: String(drive?.role || "").trim(),
      package:
        Number.isFinite(Number(drive?.package)) && Number(drive?.package) > 0
          ? Number(drive.package)
          : null
    });
  });

  return placementByStudentId;
};

const buildStudentListItem = (student, performance, sincerity, mentorFeedback, placementStatus) => {
  const overallAverage = toNumber(performance?.overallAverage);
  const codingAverage = toNumber(performance?.codingAverage);
  const aptitudeAverage = toNumber(performance?.aptitudeAverage);
  const status = calculateRisk({
    averageScore: overallAverage,
    codingAverage,
    aptitudeAverage
  })
    ? "At Risk"
    : "Safe";

  return {
    id: student.userId?._id || student.userId,
    studentUserId: student.userId?._id || student.userId,
    name: student.userId?.name || null,
    email: student.userId?.email || null,
    branch: student.branch,
    year: student.year,
    cgpa: student.cgpa,
    sincerityScore: toNumber(sincerity?.sincerityScore),
    mentorSincerityScore: mentorFeedback?.sincerityScore,
    mentorFeedback,
    overallAverage,
    codingAverage,
    aptitudeAverage,
    totalTests: toNumber(performance?.totalTests),
    weakAreas: uniqueTextList([
      ...(mentorFeedback?.weakAreas || []),
      ...extractWeakTopics(performance)
    ], 6),
    strongAreas: extractStrongTopics(performance),
    status,
    placementStatus: placementStatus || {
      status: "not_applied",
      companyName: "",
      role: "",
      package: null
    }
  };
};

const applyStudentFilters = (students, filters = {}) => {
  const search = normalizeKey(filters?.search);
  const riskLevel = normalizeKey(filters?.riskLevel);

  return (Array.isArray(students) ? students : []).filter((student) => {
    const matchesSearch = !search || [
      student?.name,
      student?.email,
      student?.branch
    ].some((value) => normalizeKey(value).includes(search));

    const studentRisk = normalizeKey(student?.status);
    const matchesRisk = !riskLevel || riskLevel === "all" || studentRisk === riskLevel;

    return matchesSearch && matchesRisk;
  });
};

const getOwnedStudentProfile = async (mentorId, studentUserId) => {
  const safeMentorId = resolveMentorId(mentorId);
  const query = safeMentorId
    ? { userId: studentUserId, mentorId: safeMentorId }
    : { userId: studentUserId };

  const profile = await Student.findOne(query)
    .populate("userId", "name email")
    .populate({
      path: "appliedDrives",
      select: "companyName role package location driveDate cgpaCriteria minCGPA description"
    });

  if (!profile) {
    throw createError("Student is not assigned to this mentor.", 404);
  }

  console.log("[getOwnedStudentProfile] DEBUG - appliedDrives populated:", {
    studentId: profile.userId?._id,
    appliedDrivesCount: profile.appliedDrives?.length || 0,
    appliedDrives: profile.appliedDrives
  });

  return attachTestDataToStudents(profile, { attemptPopulate: "subject title" });
};

const getPlacementEligibilitySummary = async (studentProfile) => {
  const drives = await PlacementDrive.find({});

  const evaluated = drives.map((drive) => ({
    drive,
    eligibility: evaluateEligibility(studentProfile, drive)
  }));

  const eligibleDrives = evaluated
    .filter((item) => item.eligibility.eligible)
    .map((item) => ({
      driveId: item.drive._id,
      companyName: item.drive.companyName,
      role: item.drive.role
    }));

  return {
    totalDrives: drives.length,
    eligibleCount: eligibleDrives.length,
    ineligibleCount: drives.length - eligibleDrives.length,
    eligibleDrives
  };
};

const computeStudentSnapshot = async (student) => {
  const analyticsInput = mapAnalyticsInput(student);
  const analyzedPerformance = analyzeStudentPerformance(analyticsInput);
  const performance = buildPerformanceSummary(student, analyzedPerformance);
  const sincerity = calculateSincerityScore(analyticsInput);

  student.sincerityScore = sincerity.sincerityScore;
  await student.save();

  return {
    performance,
    sincerity,
    mentorFeedback: getMentorFeedbackSnapshot(student)
  };
};

const getAssignedStudents = async (mentorId, filters = {}) => {
  const safeMentorId = resolveMentorId(mentorId, filters?.mentorId);
  await ensureMentorRole(safeMentorId);

  const students = await Student.find(buildStudentQuery(safeMentorId))
    .populate("userId", "name email")
    .populate({
      path: "appliedDrives",
      select: "companyName role package location driveDate cgpaCriteria minCGPA"
    });
  await attachTestDataToStudents(students, { attemptPopulate: "subject" });

  const placementStatusMap = await buildPlacementStatusMap(students);

  const mappedStudents = [];

  for (const student of students) {
    const snapshot = await computeStudentSnapshot(student);
    const studentId = String(student?.userId?._id || student?.userId || "").trim();
    
    console.log("[getAssignedStudents] DEBUG - Student placement data:", {
      name: student.userId?.name,
      appliedDrivesCount: student.appliedDrives?.length || 0,
      placementStatusMapEntry: placementStatusMap.get(studentId)
    });
    
    mappedStudents.push(
      buildStudentListItem(
        student,
        snapshot.performance,
        snapshot.sincerity,
        snapshot.mentorFeedback,
        placementStatusMap.get(studentId)
      )
    );
  }

  const filteredStudents = applyStudentFilters(mappedStudents, filters);

  return {
    success: true,
    total: mappedStudents.length,
    filtered: filteredStudents.length,
    students: filteredStudents
  };
};

const getStudentDetailedAnalytics = async (mentorId, studentUserId) => {
  const safeMentorId = resolveMentorId(mentorId);
  await ensureMentorRole(safeMentorId);

  const studentProfile = await getOwnedStudentProfile(safeMentorId, studentUserId);
  const { performance, sincerity, mentorFeedback } = await computeStudentSnapshot(studentProfile);
  const recommendations = generateCareerRecommendations(studentProfile, {
    performance,
    sincerity
  });
  const placementEligibilitySummary = await getPlacementEligibilitySummary(studentProfile);
  const riskReasons = getRiskReasons({
    overallAverage: performance.overallAverage,
    codingAverage: performance.codingAverage,
    aptitudeAverage: performance.aptitudeAverage,
    mentorFeedback
  });

  return {
    success: true,
    profile: {
      id: studentProfile._id,
      studentUserId: studentProfile.userId?._id || studentProfile.userId,
      name: studentProfile.userId?.name || null,
      email: studentProfile.userId?.email || null,
      branch: studentProfile.branch,
      year: studentProfile.year,
      cgpa: studentProfile.cgpa,
      skills: studentProfile.skills,
      performanceHistory: performance.history,
      mentorFeedback,
      appliedDrives: Array.isArray(studentProfile.appliedDrives)
        ? studentProfile.appliedDrives.map((drive) => ({
            id: drive._id,
            companyName: drive.companyName,
            role: drive.role,
            package: drive.package,
            location: drive.location,
            driveDate: drive.driveDate,
            cgpaCriteria: drive.cgpaCriteria || drive.minCGPA,
            description: drive.description
          }))
        : []
    },
    performance,
    sincerity,
    aiInsights: buildMentorAiInsights(studentProfile, performance, sincerity, recommendations),
    attemptReviews: buildMentorAttemptReviewList(studentProfile),
    risk: {
      status: performance?.riskStatus || "Safe",
      reasons: riskReasons
    },
    placementEligibilitySummary,
    careerRecommendations: recommendations
  };
};

const getMentorStudentAttemptResult = async (mentorId, studentUserId, attemptId) => {
  const safeMentorId = resolveMentorId(mentorId);
  await ensureMentorRole(safeMentorId);

  const studentProfile = await getOwnedStudentProfile(safeMentorId, studentUserId);
  const safeAttemptId = String(attemptId || "").trim();
  if (!safeAttemptId) {
    throw createError("Attempt id is required.", 400);
  }

  const attempts = Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : [];
  const matchedAttempt = attempts.find((attempt) => getAttemptId(attempt) === safeAttemptId);
  if (!matchedAttempt) {
    throw createError("Attempt not found for this assigned student.", 404);
  }

  return buildAttemptReviewPayload(matchedAttempt);
};

const getMentorStudentAttemptAnalysis = async (mentorId, studentUserId, attemptId) => {
  const safeMentorId = resolveMentorId(mentorId);
  await ensureMentorRole(safeMentorId);

  const studentProfile = await getOwnedStudentProfile(safeMentorId, studentUserId);
  const attempts = Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : [];
  const safeAttemptId = String(attemptId || "").trim();
  const matchedAttempt = attempts.find((attempt) => getAttemptId(attempt) === safeAttemptId);
  if (!matchedAttempt) {
    throw createError("Attempt not found for this assigned student.", 404);
  }

  return getAttemptAnalysis(studentProfile.userId?._id || studentProfile.userId, safeAttemptId);
};

const getMentorFeedback = async (mentorId, studentUserId) => {
  const safeMentorId = resolveMentorId(mentorId);
  await ensureMentorRole(safeMentorId);
  const studentProfile = await getOwnedStudentProfile(safeMentorId, studentUserId);

  return {
    success: true,
    studentUserId,
    mentorFeedback: getMentorFeedbackSnapshot(studentProfile)
  };
};

const saveMentorFeedback = async (mentorId, studentUserId, payload = {}) => {
  const safeMentorId = resolveMentorId(mentorId, payload?.mentorId);
  await ensureMentorRole(safeMentorId);

  const feedback = normalizeText(
    payload?.comment ??
    payload?.mentor_feedback ??
    payload?.feedback ??
    payload?.feedbackText
  );
  const sincerityScoreRaw = payload?.sincerity_score ?? payload?.sincerityScore;
  const sincerityScore =
    sincerityScoreRaw === "" || sincerityScoreRaw === null || sincerityScoreRaw === undefined
      ? null
      : toNumber(sincerityScoreRaw, NaN);
  const weakAreas = uniqueTextList(payload?.weak_areas ?? payload?.weakAreas ?? [], 8);
  const reviewed = payload?.reviewed === undefined ? undefined : Boolean(payload.reviewed);
  const focusArea = normalizeText(payload?.focus_area ?? payload?.focusArea);

  if (!feedback && !Number.isFinite(sincerityScore) && weakAreas.length === 0 && reviewed === undefined && !focusArea) {
    throw createError("At least one mentor feedback field is required.", 400);
  }

  if (Number.isFinite(sincerityScore) && (sincerityScore < 1 || sincerityScore > 10)) {
    throw createError("sincerity_score must be between 1 and 10.", 400);
  }

  const studentProfile = await getOwnedStudentProfile(safeMentorId, studentUserId);
  const existingFeedback = getMentorFeedbackSnapshot(studentProfile);

  studentProfile.mentorFeedback = {
    feedback: feedback || existingFeedback.feedback,
    sincerityScore: Number.isFinite(sincerityScore) ? sincerityScore : existingFeedback.sincerityScore,
    weakAreas: weakAreas.length > 0 ? weakAreas : existingFeedback.weakAreas,
    reviewed: reviewed === undefined ? existingFeedback.reviewed : reviewed,
    focusArea: focusArea || existingFeedback.focusArea,
    updatedAt: new Date()
  };

  if (!Array.isArray(studentProfile.feedback)) {
    studentProfile.feedback = [];
  }

  studentProfile.feedback.push({
    mentorId: safeMentorId,
    comment: feedback || existingFeedback.feedback || "",
    sincerityScore: Number.isFinite(sincerityScore) ? sincerityScore : existingFeedback.sincerityScore,
    focusArea: focusArea || existingFeedback.focusArea || "",
    weakAreas: weakAreas.length > 0 ? weakAreas : existingFeedback.weakAreas || [],
    createdAt: new Date()
  });

  if (weakAreas.length > 0) {
    studentProfile.weakTopics = weakAreas;
  }

  await studentProfile.save();

  return {
    success: true,
    message: "Mentor feedback saved successfully.",
    mentorFeedback: getMentorFeedbackSnapshot(studentProfile)
  };
};

const addMentorFeedback = async (mentorId, studentUserId, feedbackTextOrPayload) =>
  saveMentorFeedback(
    mentorId,
    studentUserId,
    typeof feedbackTextOrPayload === "string"
      ? { feedbackText: feedbackTextOrPayload }
      : feedbackTextOrPayload
  );

module.exports = {
  getAssignedStudents,
  getStudentDetailedAnalytics,
  getMentorStudentAttemptResult,
  getMentorStudentAttemptAnalysis,
  getMentorFeedback,
  saveMentorFeedback,
  addMentorFeedback
};
