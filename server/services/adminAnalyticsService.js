const User = require("../models/User");
const Student = require("../models/Student");
const PlacementDrive = require("../models/PlacementDrive");
const PlacementApplication = require("../models/PlacementApplication");
const { analyzeStudentPerformance } = require("../engine/performanceEngine");
const { calculateSincerityScore } = require("../engine/sincerityEngine");
const { evaluateEligibility } = require("./placementService");
const { attachTestDataToStudents, TestAttempt } = require("./studentTestDataService");
const { normalizeBranch: normalizeSupportedBranch } = require("../constants/branches");

const SUBJECTS = ["Technical", "Aptitude", "Coding"];
const FINAL_YEAR = 4;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toFixedNumber = (value) => Number(value.toFixed(2));
const toRoundedNumber = (value) => Math.round(value * 100) / 100;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const normalizeBranch = (value) => {
  const branch = String(value || "").trim();
  if (!branch || branch.toLowerCase() === "all") {
    return null;
  }
  return normalizeSupportedBranch(branch) || "__unsupported__";
};

const normalizeYear = (value) => {
  if (value === undefined || value === null || value === "" || String(value).toLowerCase() === "all") {
    return null;
  }

  const numericYear = Number(value);
  if (!Number.isFinite(numericYear) || numericYear <= 0) {
    return null;
  }
  return numericYear;
};

const normalizePlacementStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();
  if (status === "selected") {
    return "placed";
  }
  if (["applied", "placed", "rejected"].includes(status)) {
    return status;
  }
  return "applied";
};

const normalizeSubject = (value, type) => {
  const subject = String(value || "").trim();
  if (subject === "DSA") {
    return "Technical";
  }
  if (SUBJECTS.includes(subject)) {
    return subject;
  }
  if (String(type || "").toUpperCase() === "CODING") {
    return "Coding";
  }
  return "Technical";
};

const isExcludedAnalyticsStudent = (student = {}) => {
  const name = String(student?.name || "").trim();
  if (!name) {
    return true;
  }

  return /^(temp student|auth test)$/i.test(name);
};

const isActiveStudentProfile = (profile = {}) =>
  String(profile?.status || "Active").trim().toLowerCase() === "active";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getStudentAnalyticsSource = (student = {}) => {
  const cache = student?.aiAnalyticsCache;
  if (cache && typeof cache === "object" && Object.keys(cache).length > 0) {
    return cache;
  }

  const legacy = student?.analyticsAI?.data || student?.analyticsAI;
  if (legacy && typeof legacy === "object" && Object.keys(legacy).length > 0) {
    return legacy;
  }

  return null;
};

const getStudentAttemptCount = (student = {}, analyticsSource = null, attemptStats = null) => {
  const source = analyticsSource || getStudentAnalyticsSource(student);
  const directAttemptCount =
    toNumber(student?.aiAnalyticsCache?.signature?.attemptCount) ??
    toNumber(student?.analyticsAI?.signature?.attemptCount) ??
    toNumber(source?.signature?.attemptCount) ??
    toNumber(source?.promptData?.overall?.testsAttempted) ??
    toNumber(source?.promptData?.totalAttempts);

  if (directAttemptCount && directAttemptCount > 0) {
    return Math.trunc(directAttemptCount);
  }

  const attemptCount = toNumber(attemptStats?.attempts);
  return attemptCount && attemptCount > 0 ? Math.trunc(attemptCount) : 0;
};

const getStudentSectionScores = (student = {}, attemptStats = null) => {
  const source = getStudentAnalyticsSource(student);
  const sectionScores = source?.sectionScores || {};
  const sections = source?.sections || {};
  const hasCodingScore =
    toNumber(sectionScores?.coding ?? sections?.coding?.score) !== null;
  const hasAptitudeScore =
    toNumber(sectionScores?.aptitude ?? sections?.aptitude?.score) !== null;
  const hasTechnicalScore =
    toNumber(sectionScores?.technical ?? sections?.technical?.score) !== null;

  return {
    coding: toNumber(sectionScores?.coding ?? sections?.coding?.score) ?? toNumber(attemptStats?.sectionScores?.coding) ?? 0,
    aptitude: toNumber(sectionScores?.aptitude ?? sections?.aptitude?.score) ?? toNumber(attemptStats?.sectionScores?.aptitude) ?? 0,
    technical: toNumber(sectionScores?.technical ?? sections?.technical?.score) ?? toNumber(attemptStats?.sectionScores?.technical) ?? 0,
    validSections: {
      coding: hasCodingScore || toNumber(attemptStats?.sectionScores?.coding) !== null,
      aptitude: hasAptitudeScore || toNumber(attemptStats?.sectionScores?.aptitude) !== null,
      technical: hasTechnicalScore || toNumber(attemptStats?.sectionScores?.technical) !== null
    }
  };
};

const getStudentSincerityScore = (student = {}) => {
  const directScore = toNumber(student?.sincerityScore);
  return directScore ?? 0;
};

const getResolvedSincerity = (student = {}, analyticsInput = null) => {
  const storedScore = getStudentSincerityScore(student);
  if (storedScore > 0 || storedScore === 0) {
    return {
      sincerityScore: storedScore
    };
  }

  return calculateSincerityScore(analyticsInput || mapAnalyticsInput(student));
};

const getStudentAccuracy = (source = {}, attemptStats = null, overallAverage = 0) =>
  toNumber(source?.promptData?.overall?.averageScore) ??
  toNumber(source?.promptData?.overallAverage) ??
  toNumber(source?.overall?.averageScore) ??
  toNumber(source?.overallAverage) ??
  toNumber(attemptStats?.accuracy) ??
  overallAverage;

const getCriticalRiskReasons = ({
  overallAverage = 0,
  codingScore = 0,
  aptitudeScore = 0,
  technicalScore = 0
}) => {
  const reasons = [];
  if (Number(overallAverage) < 25) reasons.push("overallScore");
  if (Number(codingScore) < 20) reasons.push("codingScore");
  if (Number(aptitudeScore) < 20) reasons.push("aptitudeScore");
  if (Number(technicalScore) < 20) reasons.push("technicalScore");
  return reasons;
};

const buildAttemptStatsByStudent = (attemptRows = []) => {
  const studentMap = new Map();

  attemptRows.forEach((attempt) => {
    const studentId = String(attempt?.userId || "");
    if (!studentId) {
      return;
    }

    const subject = normalizeSubject(attempt?.subject, attempt?.type);
    const units = getAttemptAccuracyUnits(attempt);
    const score = units.total > 0 ? getAccuracyPercentage(units.correct, units.total) : 0;
    const current = studentMap.get(studentId) || {
      attempts: 0,
      correct: 0,
      total: 0,
      sections: {
        coding: { total: 0, count: 0 },
        aptitude: { total: 0, count: 0 },
        technical: { total: 0, count: 0 }
      }
    };

    current.attempts += 1;
    current.correct += units.correct;
    current.total += units.total;

    const sectionKey = subject === "Coding" ? "coding" : subject === "Aptitude" ? "aptitude" : "technical";
    current.sections[sectionKey].total += score;
    current.sections[sectionKey].count += 1;
    studentMap.set(studentId, current);
  });

  const normalizedMap = new Map();
  studentMap.forEach((stats, studentId) => {
    normalizedMap.set(studentId, {
      attempts: stats.attempts,
      accuracy: getAccuracyPercentage(stats.correct, stats.total),
      sectionScores: {
        coding: stats.sections.coding.count ? toRoundedNumber(stats.sections.coding.total / stats.sections.coding.count) : 0,
        aptitude: stats.sections.aptitude.count ? toRoundedNumber(stats.sections.aptitude.total / stats.sections.aptitude.count) : 0,
        technical: stats.sections.technical.count ? toRoundedNumber(stats.sections.technical.total / stats.sections.technical.count) : 0
      }
    });
  });

  return normalizedMap;
};

const buildCacheDrivenStudentAnalytics = (students = [], options = {}) => {
  const trendMode = options.trendMode === "count" ? "count" : "score";
  const attemptStatsByStudent = buildAttemptStatsByStudent(options.attemptRows || []);
  const normalizedStudents = students
    .filter((student) => String(student?.status || "").trim().toLowerCase() !== "inactive")
    .map((student) => {
      const source = getStudentAnalyticsSource(student);
      const attemptStats = attemptStatsByStudent.get(String(student?.userId || student?._id || "")) || null;
      const attemptCount = getStudentAttemptCount(student, source, attemptStats);
      const scores = getStudentSectionScores(student, attemptStats);

      return {
        ...student,
        analyticsSource: source,
        attemptStats,
        attemptCount,
        sectionScores: scores
      };
    });

  const totalStudentCount = normalizedStudents.length;
  const attemptedStudents = normalizedStudents.filter((student) => student.attemptCount > 0);
  const attemptedStudentCount = attemptedStudents.length;

  if (totalStudentCount === 0) {
    return {
      totalStudents: 0,
      attemptedStudents: [],
      attemptedStudentsCount: 0,
      totalAttempts: 0,
      averageAccuracy: 0,
      attemptedAverage: 0,
      subjectStats: {
        coding: 0,
        aptitude: 0,
        technical: 0
      },
      topStudents: [],
      atRiskStudents: [],
      attemptsTrend: []
    };
  }

  const totals = normalizedStudents.reduce(
    (acc, student) => {
      acc.coding += student.sectionScores.coding;
      acc.aptitude += student.sectionScores.aptitude;
      acc.technical += student.sectionScores.technical;
      acc.attempts += student.attemptCount;
      return acc;
    },
    {
      coding: 0,
      aptitude: 0,
      technical: 0,
      attempts: 0
    }
  );

  const subjectStats = {
    coding: toRoundedNumber(totals.coding / totalStudentCount),
    aptitude: toRoundedNumber(totals.aptitude / totalStudentCount),
    technical: toRoundedNumber(totals.technical / totalStudentCount)
  };

  const averageAccuracy = toRoundedNumber((subjectStats.coding + subjectStats.aptitude + subjectStats.technical) / 3);

  const attemptedAverages = attemptedStudentCount > 0
    ? attemptedStudents.reduce(
        (acc, student) => {
          acc.coding += student.sectionScores.coding;
          acc.aptitude += student.sectionScores.aptitude;
          acc.technical += student.sectionScores.technical;
          return acc;
        },
        {
          coding: 0,
          aptitude: 0,
          technical: 0
        }
      )
    : { coding: 0, aptitude: 0, technical: 0 };

  const attemptedAverage = attemptedStudentCount > 0
    ? toRoundedNumber(
        (
          attemptedAverages.coding / attemptedStudentCount +
          attemptedAverages.aptitude / attemptedStudentCount +
          attemptedAverages.technical / attemptedStudentCount
        ) / 3
      )
    : 0;

  const rankedStudents = normalizedStudents
    .map((student) => {
      const overallAverage =
        toRoundedNumber((student.sectionScores.coding + student.sectionScores.aptitude + student.sectionScores.technical) / 3);
      const codingScore = toRoundedNumber(student.sectionScores.coding);
      const aptitudeScore = toRoundedNumber(student.sectionScores.aptitude);
      const technicalScore = toRoundedNumber(student.sectionScores.technical);
      const accuracy = toRoundedNumber(getStudentAccuracy(student.analyticsSource, student.attemptStats, overallAverage));
      const riskReasons = getCriticalRiskReasons({
        overallAverage,
        codingScore,
        aptitudeScore,
        technicalScore
      });

      return {
        studentId: String(student.userId || student._id || ""),
        name: student.name || "Student",
        branch: student.branch || "-",
        year: student.year || "-",
        overallAverage,
        overallScore: overallAverage,
        accuracy,
        attempts: student.attemptCount,
        testsAttempted: student.attemptCount,
        codingScore,
        aptitudeScore,
        technicalScore,
        riskReasons
      };
    })
    .sort((a, b) => b.overallAverage - a.overallAverage || b.attempts - a.attempts);

  const topStudents = rankedStudents.slice(0, 5);
  const seenCriticalStudentIds = new Set();
  const atRiskStudents = rankedStudents
    .filter((student) => student.riskReasons.length > 0)
    .sort((a, b) => a.overallAverage - b.overallAverage || a.codingScore - b.codingScore || b.attempts - a.attempts)
    .filter((student) => {
      const studentId = String(student.studentId || "").trim();
      if (!studentId || seenCriticalStudentIds.has(studentId)) {
        return false;
      }
      seenCriticalStudentIds.add(studentId);
      return true;
    });

  console.log("[AdminAnalytics] Critical-risk students returned:", atRiskStudents.length);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trendDays = [];
  const trendMap = new Map();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = toLocalDateKey(day);
    const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    trendDays.push({ key, label });
    trendMap.set(
      key,
      trendMode === "count"
        ? { count: 0 }
        : {
            total: 0,
            count: 0
          }
    );
  }

  attemptedStudents.forEach((student) => {
    const candidateDate =
      student?.aiAnalyticsLastUpdated ||
      student?.analyticsSource?.generatedAt ||
      student?.analyticsSource?.signature?.latestAttemptAt ||
      student?.updatedAt ||
      null;
    const parsedDate = candidateDate ? new Date(candidateDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return;
    }

    const key = toLocalDateKey(parsedDate);
    if (!trendMap.has(key)) {
      return;
    }

    const trendEntry = trendMap.get(key);
    if (trendMode === "count") {
      trendEntry.count += 1;
      trendMap.set(key, trendEntry);
      return;
    }

    const studentOverall =
      (student.sectionScores.coding + student.sectionScores.aptitude + student.sectionScores.technical) / 3;
    trendEntry.total += studentOverall;
    trendEntry.count += 1;
    trendMap.set(key, trendEntry);
  });

  const attemptsTrend = trendDays.map((day) => {
    const trendEntry = trendMap.get(day.key) || { total: 0, count: 0 };
    if (trendMode === "count") {
      return {
        date: day.label,
        count: trendEntry.count || 0
      };
    }

    return {
      date: day.label,
      score: trendEntry.count ? toRoundedNumber(trendEntry.total / trendEntry.count) : 0,
      count: trendEntry.count || 0
    };
  });

  return {
    totalStudents: totalStudentCount,
    attemptedStudents,
    attemptedStudentsCount: attemptedStudentCount,
    totalAttempts: totals.attempts,
    averageAccuracy,
    attemptedAverage,
    subjectStats,
    topStudents,
    atRiskStudents,
    attemptsTrend
  };
};

const getAttemptAccuracyUnits = (attempt) => {
  const totalScore = Number(attempt?.totalScore);
  const maxScore = Number(attempt?.maxScore);
  if (Number.isFinite(totalScore) && Number.isFinite(maxScore) && maxScore > 0) {
    return {
      correct: Math.max(0, totalScore),
      total: maxScore
    };
  }

  const percentage = Number(attempt?.percentage);
  if (Number.isFinite(percentage) && percentage >= 0) {
    return {
      correct: Math.min(Math.max(percentage, 0), 100),
      total: 100
    };
  }

  const score = Number(attempt?.score);
  if (Number.isFinite(score) && score >= 0) {
    return {
      correct: Math.min(Math.max(score, 0), 100),
      total: 100
    };
  }

  return {
    correct: 0,
    total: 0
  };
};

const getAccuracyPercentage = (correct, total) =>
  total > 0 ? toRoundedNumber((correct / total) * 100) : 0;

const buildWeightedAccuracySummary = (attemptRows = [], students = [], options = {}) => {
  const trendMode = options.trendMode === "count" ? "count" : "score";
  const requestedDays = Number(options.days);
  const trendWindowDays =
    Number.isFinite(requestedDays) && requestedDays >= 7 ? Math.min(Math.trunc(requestedDays), 14) : 7;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const trendDays = [];
  const trendMap = new Map();

  for (let offset = trendWindowDays - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = toLocalDateKey(day);
    const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    trendDays.push({ key, label });
    trendMap.set(
      key,
      trendMode === "count"
        ? { count: 0 }
        : {
            correct: 0,
            total: 0,
            count: 0
          }
    );
  }

  const totals = { correct: 0, total: 0 };
  const subjectBuckets = {
    Coding: { correct: 0, total: 0 },
    Aptitude: { correct: 0, total: 0 },
    Technical: { correct: 0, total: 0 }
  };
  const studentAccuracyAccumulator = new Map(
    students.map((student) => [
      String(student._id),
      {
        correct: 0,
        total: 0,
        attempts: 0
      }
    ])
  );

  for (const attempt of attemptRows) {
    const studentId = String(attempt?.userId || "");
    const subject = normalizeSubject(attempt?.subject, attempt?.type);
    const units = getAttemptAccuracyUnits(attempt);

    totals.correct += units.correct;
    totals.total += units.total;

    if (subjectBuckets[subject]) {
      subjectBuckets[subject].correct += units.correct;
      subjectBuckets[subject].total += units.total;
    }

    const studentTotals = studentAccuracyAccumulator.get(studentId) || {
      correct: 0,
      total: 0,
      attempts: 0
    };
    studentTotals.correct += units.correct;
    studentTotals.total += units.total;
    studentTotals.attempts += 1;
    studentAccuracyAccumulator.set(studentId, studentTotals);

    if (!attempt?.createdAt) {
      continue;
    }

    const attemptDate = new Date(attempt.createdAt);
    if (Number.isNaN(attemptDate.getTime())) {
      continue;
    }

    const key = toLocalDateKey(attemptDate);
    if (!trendMap.has(key)) {
      continue;
    }

    const currentTrend = trendMap.get(key);
    if (trendMode === "count") {
      currentTrend.count += 1;
      trendMap.set(key, currentTrend);
      continue;
    }

    currentTrend.correct += units.correct;
    currentTrend.total += units.total;
    currentTrend.count += 1;
    trendMap.set(key, currentTrend);
  }

  const subjectStats = {
    coding: getAccuracyPercentage(subjectBuckets.Coding.correct, subjectBuckets.Coding.total),
    aptitude: getAccuracyPercentage(subjectBuckets.Aptitude.correct, subjectBuckets.Aptitude.total),
    technical: getAccuracyPercentage(subjectBuckets.Technical.correct, subjectBuckets.Technical.total)
  };

  const attemptsTrend = trendDays.map((day) => {
    const trendEntry = trendMap.get(day.key);
    if (trendMode === "count") {
      return {
        date: day.label,
        dateKey: day.key,
        count: trendEntry?.count || 0
      };
    }

    return {
      date: day.label,
      dateKey: day.key,
      score: getAccuracyPercentage(trendEntry?.correct || 0, trendEntry?.total || 0),
      count: trendEntry?.count || 0
    };
  });

  return {
    averageAccuracy: getAccuracyPercentage(totals.correct, totals.total),
    subjectStats,
    attemptsTrend,
    studentAccuracyAccumulator
  };
};

const mapAnalyticsInput = (studentProfile) => ({
  mockTestScores: (studentProfile.mockTestScores || []).map((item) => ({
    score: item.score,
    type: item.type,
    takenAt: item.takenAt,
    endTime: item.endTime,
    detailedResult: item.detailedResult,
    subject:
      item?.subject === "DSA"
        ? "Technical"
        : item?.subject || (item?.testId?.subject === "DSA" ? "Technical" : (item?.testId?.subject || null))
  })),
  testActivityLog: (studentProfile.testActivityLog || []).map((item) => ({
    testId: item.testId,
    status: item.status,
    startedAt: item.startedAt,
    submittedAt: item.submittedAt
  }))
});

const getRiskReasons = (performance) => {
  const riskReasons = [];
  const codingAverage = Number(performance?.codingAverage) || 0;
  const aptitudeAverage = Number(performance?.subjectBreakdown?.Aptitude?.averageScorePerSubject) || 0;
  const technicalAverage = Number(performance?.subjectBreakdown?.Technical?.averageScorePerSubject) || 0;

  if (Number(performance?.overallAverage) < 25) {
    riskReasons.push("overallAverage");
  }
  if (codingAverage < 20) {
    riskReasons.push("codingScore");
  }
  if (aptitudeAverage < 20) {
    riskReasons.push("aptitudeScore");
  }
  if (technicalAverage < 20) {
    riskReasons.push("technicalScore");
  }
  return riskReasons;
};

const buildAttemptRowsForStudents = async (studentIds = []) =>
  TestAttempt.aggregate([
    {
      $match: {
        studentId: { $in: studentIds }
      }
    },
    {
      $lookup: {
        from: "mocktests",
        localField: "testId",
        foreignField: "_id",
        as: "test"
      }
    },
    {
      $unwind: {
        path: "$test",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        userId: "$studentId",
        score: 1,
        percentage: 1,
        totalScore: 1,
        maxScore: 1,
        type: 1,
        createdAt: "$takenAt",
        subject: {
          $ifNull: [
            "$subject",
            "$test.subject"
          ]
        }
      }
    }
  ]);

const getSystemAnalytics = async (adminId) => {
  const admin = await User.findById(adminId);
  if (!admin) {
    throw createError("User account not found.", 404);
  }
  if (admin.role !== "admin") {
    throw createError("Access denied for this role.", 403);
  }

  const [students, drives] = await Promise.all([
    Student.find({})
      .populate({
        path: "appliedDrives",
        select: "companyName role package location driveDate"
      }),
    PlacementDrive.find({})
  ]);
  await attachTestDataToStudents(students, { attemptPopulate: "subject" });

  const totalStudents = students.length;
  if (totalStudents === 0) {
    return {
      success: true,
      analytics: {
        totalStudents: 0,
        averageOverallPerformance: 0,
        averageCodingScore: 0,
        averageSincerityScore: 0,
        atRiskPercentage: 0,
        subjectPerformanceDistribution: SUBJECTS.map((subject) => ({
          subject,
          averageScore: 0,
          totalTests: 0
        })),
        placementEligibilityStats: {
          eligible: 0,
          notEligible: 0
        },
        driveWiseEligibilityCounts: drives.map((drive) => ({
          driveId: drive._id,
          companyName: drive.companyName,
          role: drive.role,
          eligibleCount: 0,
          notEligibleCount: 0
        }))
      }
    };
  }

  let totalOverall = 0;
  let totalCoding = 0;
  let totalSincerity = 0;
  let atRiskCount = 0;
  let eligibleStudents = 0;

  const subjectAccumulator = SUBJECTS.reduce((acc, subject) => {
    acc[subject] = {
      totalScore: 0,
      totalTests: 0
    };
    return acc;
  }, {});

  const driveWiseEligibilityCounts = drives.map((drive) => ({
    driveId: drive._id,
    companyName: drive.companyName,
    role: drive.role,
    eligibleCount: 0,
    notEligibleCount: 0
  }));

  for (const student of students) {
    const analyticsInput = mapAnalyticsInput(student);
    const performance = analyzeStudentPerformance(analyticsInput);
    const sincerity = getResolvedSincerity(student, analyticsInput);
    totalOverall += performance.overallAverage;
    totalCoding += performance.codingAverage;
    totalSincerity += sincerity.sincerityScore;

    SUBJECTS.forEach((subject) => {
      const breakdown = performance.subjectBreakdown?.[subject];
      if (!breakdown) {
        return;
      }
      subjectAccumulator[subject].totalScore +=
        breakdown.averageScorePerSubject * breakdown.totalTestsPerSubject;
      subjectAccumulator[subject].totalTests += breakdown.totalTestsPerSubject;
    });

    const riskReasons = getRiskReasons(performance, sincerity);
    if (riskReasons.length > 0) {
      atRiskCount += 1;
    }

    let eligibleForAnyDrive = false;
    drives.forEach((drive, index) => {
      const eligibility = evaluateEligibility(student, drive);
      if (eligibility.eligible) {
        eligibleForAnyDrive = true;
        driveWiseEligibilityCounts[index].eligibleCount += 1;
      } else {
        driveWiseEligibilityCounts[index].notEligibleCount += 1;
      }
    });

    if (eligibleForAnyDrive) {
      eligibleStudents += 1;
    }
  }

  const subjectPerformanceDistribution = SUBJECTS.map((subject) => {
    const bucket = subjectAccumulator[subject];
    return {
      subject,
      averageScore: bucket.totalTests
        ? toFixedNumber(bucket.totalScore / bucket.totalTests)
        : 0,
      totalTests: bucket.totalTests
    };
  });

  const analytics = {
    totalStudents,
    averageOverallPerformance: toFixedNumber(totalOverall / totalStudents),
    averageCodingScore: toFixedNumber(totalCoding / totalStudents),
    averageSincerityScore: toFixedNumber(totalSincerity / totalStudents),
    atRiskPercentage: toFixedNumber((atRiskCount / totalStudents) * 100),
    subjectPerformanceDistribution,
    placementEligibilityStats: {
      eligible: eligibleStudents,
      notEligible: totalStudents - eligibleStudents
    },
    driveWiseEligibilityCounts
  };

  return {
    success: true,
    analytics
  };
};

const buildEmptySystemAnalytics = (branch, year, totalStudents = 0) => ({
  totalStudents,
  totalAttempts: 0,
  averageAccuracy: 0,
  subjectStats: {
    coding: 0,
    aptitude: 0,
    technical: 0
  },
  topStudents: [],
  atRiskStudents: [],
  attemptsTrend: [],
  placementStats: {
    eligibleStudents: 0,
    totalStudents: 0,
    placedStudents: 0,
    placementPercentage: 0,
    totalPlacementSelections: 0,
    totalApplications: 0,
    totalDrives: 0,
    companyWisePlacements: [],
    branchWisePlacement: []
  },
  placementPercentage: 0,
  branchWisePlacement: [],
  companyWisePlacements: [],
  totalPlacedStudents: 0,
  eligibleStudents: 0,
  filters: {
    branch: branch || "All",
    year: year || "All"
  }
});

const buildPlacementAnalytics = async (users = [], profiles = []) => {
  const userById = new Map(users.map((user) => [String(user?._id || ""), user]));
  const profileByUserId = new Map(profiles.map((profile) => [String(profile?.userId || ""), profile]));
  const students = users.map((user) => {
    const profile = profileByUserId.get(String(user?._id || "")) || {};

    return {
      userId: user?._id,
      name: user?.name || "Student",
      branch: user?.branch || profile?.branch || "-",
      year: user?.year ?? profile?.year ?? null,
      batch: profile?.batch ?? user?.batch ?? null,
      cgpa: profile?.cgpa ?? null,
      status: profile?.status || "Active"
    };
  });
  const studentById = new Map(students.map((student) => [String(student.userId || ""), student]));
  const studentIds = students.map((student) => student.userId).filter(Boolean);

  const [drives, applications] = await Promise.all([
    PlacementDrive.find({}).select("_id companyName").lean(),
    PlacementApplication.find({ studentId: { $in: studentIds } })
      .select("_id studentId driveId status updatedAt createdAt")
      .lean()
  ]);

  const driveById = new Map(drives.map((drive) => [String(drive?._id || ""), drive]));
  const branchBuckets = new Map();

  students.forEach((student) => {
    const studentId = String(student.userId || "");
    const branchKey = String(student?.branch || "-").trim() || "-";
    const branchBucket = branchBuckets.get(branchKey) || {
      branch: branchKey,
      studentIds: new Set(),
      placedStudentIds: new Set(),
      placementSelections: 0
    };

    if (studentId) {
      branchBucket.studentIds.add(studentId);
    }

    branchBuckets.set(branchKey, branchBucket);
  });

  const placedStudentIds = new Set();
  const companyBuckets = new Map();

  applications.forEach((application) => {
    if (normalizePlacementStatus(application?.status) !== "placed") {
      return;
    }

    const studentId = String(application?.studentId || "");
    const student = studentById.get(studentId);
    if (!student) {
      return;
    }

    placedStudentIds.add(studentId);

    const branchKey = String(student?.branch || "-").trim() || "-";
    const branchBucket = branchBuckets.get(branchKey) || {
      branch: branchKey,
      studentIds: new Set(),
      placedStudentIds: new Set(),
      placementSelections: 0
    };
    branchBucket.studentIds.add(studentId);
    branchBucket.placedStudentIds.add(studentId);
    branchBucket.placementSelections += 1;
    branchBuckets.set(branchKey, branchBucket);

    const drive = driveById.get(String(application?.driveId || ""));
    const companyName = String(drive?.companyName || "Company").trim() || "Company";
    const companyBucket = companyBuckets.get(companyName) || {
      company: companyName,
      companyName,
      placedStudentIds: new Set(),
      applicationCount: 0,
      driveIds: new Set()
    };
    companyBucket.placedStudentIds.add(studentId);
    companyBucket.applicationCount += 1;
    if (drive?._id) {
      companyBucket.driveIds.add(String(drive._id));
    }
    companyBuckets.set(companyName, companyBucket);
  });

  const filteredStudents = students.length;
  const placedStudents = placedStudentIds.size;
  const totalPlacementSelections = Array.from(companyBuckets.values()).reduce(
    (sum, bucket) => sum + bucket.applicationCount,
    0
  );
  const placementPercentage = filteredStudents
    ? toRoundedNumber((totalPlacementSelections / filteredStudents) * 100)
    : 0;

  const branchWisePlacement = Array.from(branchBuckets.values())
    .map((bucket) => {
      const studentCount = bucket.studentIds.size;
      const placementSelections = bucket.placementSelections || 0;

      return {
        branch: bucket.branch,
        eligibleStudents: studentCount,
        totalStudents: studentCount,
        placedStudents: placementSelections,
        placementSelections,
        uniquePlacedStudents: bucket.placedStudentIds.size,
        percentage: studentCount ? toRoundedNumber((placementSelections / studentCount) * 100) : 0
      };
    })
    .filter((bucket) => bucket.totalStudents > 0 || bucket.placedStudents > 0)
    .sort((left, right) => right.percentage - left.percentage || left.branch.localeCompare(right.branch));

  const companyWisePlacements = Array.from(companyBuckets.values())
    .map((bucket) => ({
      company: bucket.company,
      companyName: bucket.companyName,
      placed: bucket.applicationCount,
      placementSelections: bucket.applicationCount,
      uniquePlacedStudents: bucket.placedStudentIds.size,
      selectedStudents: bucket.placedStudentIds.size,
      selectedApplications: bucket.applicationCount,
      drives: bucket.driveIds.size
    }))
    .sort((left, right) => right.placed - left.placed || left.company.localeCompare(right.company));

  return {
    eligibleStudents: filteredStudents,
    totalStudents: filteredStudents,
    placedStudents,
    placementPercentage,
    totalPlacementSelections,
    totalApplications: applications.length,
    totalDrives: drives.length,
    companyWisePlacements,
    branchWisePlacement
  };
};

const getDashboardSystemAnalytics = async (adminId) => {
  const admin = await User.findById(adminId).select("_id role");
  if (!admin) {
    throw createError("User account not found.", 404);
  }
  if (String(admin.role || "").toLowerCase() !== "admin") {
    throw createError("Access denied for this role.", 403);
  }

  const dashboardUsers = (await User.find({ role: "student" }).select("_id name branch year batch").lean()).filter(
    (student) => !isExcludedAnalyticsStudent(student)
  );
  const dashboardUserIds = dashboardUsers.map((student) => student._id);
  const placementUsers = dashboardUsers.filter((student) => Number(student?.year) === FINAL_YEAR);
  const placementUserIds = placementUsers.map((student) => student._id).filter(Boolean);

  const [studentProfiles, placementProfiles] = await Promise.all([
    dashboardUserIds.length
      ? Student.collection.find({
          userId: { $in: dashboardUserIds }
        }).toArray()
      : [],
    placementUserIds.length
      ? Student.collection.find({
          userId: { $in: placementUserIds }
        }).toArray()
      : []
  ]);

  const profileByUserId = new Map(studentProfiles.map((profile) => [String(profile?.userId || ""), profile]));
  const analyticsStudents = dashboardUsers.map((user) => {
    const profile = profileByUserId.get(String(user?._id || "")) || {};

    return {
      ...profile,
      _id: profile?._id || user?._id,
      userId: profile?.userId || user?._id,
      name: user?.name || "Student",
      branch: user?.branch || profile?.branch || "-",
      year: user?.year ?? profile?.year ?? "-"
    };
  });

  const generalAnalyticsStudents = analyticsStudents.filter(isActiveStudentProfile);
  const generalStudentIds = generalAnalyticsStudents.map((student) => student.userId).filter(Boolean);
  const totalStudents = generalAnalyticsStudents.length;

  const attemptRows = await buildAttemptRowsForStudents(generalStudentIds);
  const cacheSummary = buildCacheDrivenStudentAnalytics(generalAnalyticsStudents, {
    trendMode: "score",
    attemptRows
  });
  const weightedSummary = buildWeightedAccuracySummary(attemptRows, generalAnalyticsStudents, {
    trendMode: "score",
    days: 14
  });
  const placementStats = await buildPlacementAnalytics(placementUsers, placementProfiles);

  return {
    success: true,
    analytics: {
      totalStudents,
      totalAttempts: cacheSummary.totalAttempts,
      attemptedStudents: cacheSummary.attemptedStudentsCount,
      averageAccuracy: cacheSummary.averageAccuracy,
      attemptedAverage: cacheSummary.attemptedAverage,
      subjectStats: cacheSummary.subjectStats,
      topStudents: cacheSummary.topStudents,
      atRiskStudents: cacheSummary.atRiskStudents,
      attemptsTrend: weightedSummary.attemptsTrend,
      placementStats,
      placementPercentage: placementStats.placementPercentage,
      branchWisePlacement: placementStats.branchWisePlacement,
      companyWisePlacements: placementStats.companyWisePlacements,
      totalPlacedStudents: placementStats.totalPlacementSelections,
      eligibleStudents: placementStats.eligibleStudents,
      filters: {
        branch: "All",
        year: "All"
      }
    }
  };
};

const getSystemAnalyticsGlobal = async (adminId, filters = {}) => {
  const admin = await User.findById(adminId).select("_id role");
  if (!admin) {
    throw createError("User account not found.", 404);
  }
  if (String(admin.role || "").toLowerCase() !== "admin") {
    throw createError("Access denied for this role.", 403);
  }

  const branch = normalizeBranch(filters.branch);
  const year = normalizeYear(filters.year);
  const userFilter = { role: "student" };
  if (branch) {
    userFilter.branch = new RegExp(`^${escapeRegex(branch)}$`, "i");
  }
  if (year) {
    userFilter.year = year;
  }

  const users = (await User.find(userFilter).select("_id name branch year batch").lean()).filter(
    (student) => !isExcludedAnalyticsStudent(student)
  );
  const totalStudents = users.length;

  if (totalStudents === 0) {
    return {
      success: true,
      analytics: buildEmptySystemAnalytics(branch, year, 0)
    };
  }

  const studentIds = users.map((student) => student._id);
  const studentProfiles = await Student.collection.find({
    userId: { $in: studentIds }
  }).toArray();
  const profileByUserId = new Map(studentProfiles.map((profile) => [String(profile?.userId || ""), profile]));
  const analyticsStudents = users.map((user) => {
    const profile = profileByUserId.get(String(user?._id || "")) || {};

    return {
      ...profile,
      _id: profile?._id || user?._id,
      userId: profile?.userId || user?._id,
      name: user?.name || "Student",
      branch: user?.branch || profile?.branch || "-",
      year: user?.year ?? profile?.year ?? "-"
    };
  });

  const attemptRows = await buildAttemptRowsForStudents(studentIds);
  const cacheSummary = buildCacheDrivenStudentAnalytics(analyticsStudents, {
    trendMode: "count",
    attemptRows
  });
  const placementStats = await buildPlacementAnalytics(users, studentProfiles);

  return {
    success: true,
    analytics: {
      totalStudents,
      totalAttempts: cacheSummary.totalAttempts,
      attemptedStudents: cacheSummary.attemptedStudentsCount,
      averageAccuracy: cacheSummary.averageAccuracy,
      attemptedAverage: cacheSummary.attemptedAverage,
      subjectStats: cacheSummary.subjectStats,
      topStudents: cacheSummary.topStudents,
      atRiskStudents: cacheSummary.atRiskStudents,
      attemptsTrend: cacheSummary.attemptsTrend,
      placementStats,
      placementPercentage: placementStats.placementPercentage,
      branchWisePlacement: placementStats.branchWisePlacement,
      companyWisePlacements: placementStats.companyWisePlacements,
      totalPlacedStudents: placementStats.totalPlacementSelections,
      eligibleStudents: placementStats.eligibleStudents,
      filters: {
        branch: branch || "All",
        year: year || "All"
      }
    }
  };
};

module.exports = {
  getSystemAnalytics,
  getSystemAnalyticsGlobal,
  getDashboardSystemAnalytics
};
