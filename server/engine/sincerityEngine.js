const MS_PER_DAY = 1000 * 60 * 60 * 24;
const UNRESOLVED_START_GRACE_HOURS = 2;
const MIN_SINCERITY_SCORE = 25;
const MAX_SINCERITY_SCORE = 90;

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toValidDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateKey = (date) => {
  const safeDate = toValidDate(date);
  return safeDate ? safeDate.toISOString().slice(0, 10) : null;
};

const getAttemptScore = (attempt) => {
  const directScore = toNumber(attempt?.score);
  if (directScore !== null) {
    return clamp(directScore);
  }

  const percentageScore = toNumber(attempt?.percentage);
  if (percentageScore !== null) {
    return clamp(percentageScore);
  }

  const totalScore = toNumber(attempt?.totalScore);
  const maxScore = toNumber(attempt?.maxScore);
  if (totalScore !== null && maxScore !== null && maxScore > 0) {
    return clamp((totalScore / maxScore) * 100);
  }

  return 0;
};

const getAttemptDate = (attempt) => toValidDate(attempt?.takenAt || attempt?.endTime || attempt?.startTime);

const getActivityDate = (activity) =>
  toValidDate(activity?.submittedAt || activity?.startedAt || activity?.createdAt);

const getSincerityLabel = (score, breakdown = {}) => {
  if (score >= 78) return "Excellent";
  if (score >= 62) return "Consistent";
  if (score >= 45 || (score >= 40 && Number(breakdown?.improvementTrendScore) >= 72)) return "Improving";
  return "Needs Focus";
};

const calculateAverageScore = (scores = []) => {
  if (scores.length === 0) {
    return 0;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

const calculateImprovementTrend = (attempts = []) => {
  const countedAttempts = attempts
    .filter((attempt) => attempt?.isFirstAttempt !== false)
    .map((attempt) => ({
      score: getAttemptScore(attempt),
      date: getAttemptDate(attempt)
    }))
    .filter((attempt) => attempt.date)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (countedAttempts.length === 0) {
    return 0;
  }

  if (countedAttempts.length === 1) {
    return 40;
  }

  const midpoint = Math.ceil(countedAttempts.length / 2);
  const earlyAverage = calculateAverageScore(countedAttempts.slice(0, midpoint).map((attempt) => attempt.score));
  const recentAverage = calculateAverageScore(countedAttempts.slice(midpoint).map((attempt) => attempt.score));
  const delta = recentAverage - earlyAverage;

  return clamp(50 + delta * 1.4, 20, 100);
};

const calculateConsistencyScore = ({ activeDays, completionRate, completedTests, activitySpanDays }) => {
  if (completedTests === 0 && activeDays === 0) {
    return 0;
  }

  const expectedActiveDays = Math.min(12, Math.max(4, Math.ceil(activitySpanDays / 4)));
  const activeDayScore = clamp((activeDays / expectedActiveDays) * 100);
  const completionScore = clamp(completionRate * 100);
  const attemptCadenceScore = clamp((completedTests / Math.max(4, expectedActiveDays * 0.75)) * 100);

  return activeDayScore * 0.45 + completionScore * 0.35 + attemptCadenceScore * 0.2;
};

const calculateRecentActivityScore = (inactivityDays) => {
  if (!Number.isFinite(inactivityDays)) {
    return 0;
  }
  if (inactivityDays <= 1) return 100;
  if (inactivityDays <= 3) return 85;
  if (inactivityDays <= 7) return 65;
  if (inactivityDays <= 14) return 45;
  if (inactivityDays <= 30) return 25;
  return 5;
};

const calculateSincerityScore = (studentProfile = {}) => {
  const attempts = Array.isArray(studentProfile?.mockTestScores) ? [...studentProfile.mockTestScores] : [];
  const activityLog = Array.isArray(studentProfile?.testActivityLog) ? [...studentProfile.testActivityLog] : [];
  const now = new Date();
  const unresolvedThreshold = new Date(now.getTime() - UNRESOLVED_START_GRACE_HOURS * 60 * 60 * 1000);

  const completedAttempts = attempts.filter((attempt) => getAttemptDate(attempt));
  const countedAttempts = completedAttempts.filter((attempt) => attempt?.isFirstAttempt !== false);
  const practiceAttempts = completedAttempts.filter((attempt) => attempt?.isFirstAttempt === false);
  const completedDates = completedAttempts.map(getAttemptDate).filter(Boolean);
  const startedEntries = activityLog.filter((entry) => String(entry?.status || "").toUpperCase() === "STARTED");
  const submittedEntries = activityLog.filter((entry) => String(entry?.status || "").toUpperCase() === "SUBMITTED");
  const unresolvedStartedEntries = startedEntries.filter((entry) => {
    const startedAt = toValidDate(entry?.startedAt || entry?.createdAt);
    const submittedAt = toValidDate(entry?.submittedAt);
    if (!startedAt || submittedAt) return false;
    return startedAt <= unresolvedThreshold;
  });

  const uniqueActiveDays = new Set();
  completedDates.forEach((date) => {
    const key = toDateKey(date);
    if (key) uniqueActiveDays.add(key);
  });
  activityLog.forEach((entry) => {
    const key = toDateKey(entry?.startedAt || entry?.createdAt || entry?.submittedAt);
    if (key) uniqueActiveDays.add(key);
  });

  const activityDates = [
    ...completedDates,
    ...activityLog.map(getActivityDate).filter(Boolean)
  ].sort((left, right) => left.getTime() - right.getTime());
  const firstActivityDate = activityDates[0] || null;
  const latestActivityDate = activityDates[activityDates.length - 1] || null;
  const activitySpanDays =
    firstActivityDate && latestActivityDate
      ? Math.max(1, Math.ceil((latestActivityDate.getTime() - firstActivityDate.getTime()) / MS_PER_DAY) + 1)
      : 1;
  const inactivityDays = latestActivityDate
    ? Math.floor((now.getTime() - latestActivityDate.getTime()) / MS_PER_DAY)
    : Number.POSITIVE_INFINITY;

  const completedTests = completedAttempts.length;
  const countedTests = countedAttempts.length;
  const practiceTests = practiceAttempts.length;
  const activeDays = uniqueActiveDays.size;
  const totalStarts = Math.max(completedTests, startedEntries.length + submittedEntries.length);
  const completionRate = totalStarts > 0 ? clamp(completedTests / totalStarts, 0, 1) : 0;
  const averagePerformance = calculateAverageScore(completedAttempts.map(getAttemptScore));
  const consistencyScore = calculateConsistencyScore({
    activeDays,
    completionRate,
    completedTests,
    activitySpanDays
  });
  const testsAttemptedScore = clamp((completedTests / 10) * 100);
  const averagePerformanceScore = clamp(averagePerformance);
  const recentActivityScore = calculateRecentActivityScore(inactivityDays);
  const improvementTrendScore = calculateImprovementTrend(completedAttempts);
  const practiceFrequencyScore = clamp((practiceTests / Math.max(1, countedTests)) * 100);
  const countedPracticeBalanceScore =
    completedTests > 0 ? clamp(((countedTests / completedTests) * 70) + ((practiceTests / completedTests) * 30)) : 0;

  const weightedScore =
    consistencyScore * 0.3 +
    testsAttemptedScore * 0.2 +
    averagePerformanceScore * 0.25 +
    recentActivityScore * 0.15 +
    improvementTrendScore * 0.1;

  const behaviorAdjustment =
    completionRate < 0.65 ? -8 :
      completionRate < 0.85 ? -3 : 0;
  const practiceAdjustment =
    practiceTests > 0 ? Math.min(4, practiceFrequencyScore * 0.04) : 0;
  const unresolvedPenalty = Math.min(8, unresolvedStartedEntries.length * 2);
  const distributionAdjustment =
    countedPracticeBalanceScore >= 80 && completedTests >= 5 ? 2 :
      averagePerformance < 45 && completedTests < 4 ? -4 :
        0;

  const rawScore =
    weightedScore +
    behaviorAdjustment +
    practiceAdjustment +
    distributionAdjustment -
    unresolvedPenalty;
  const sincerityScore = Math.round(clamp(rawScore, MIN_SINCERITY_SCORE, MAX_SINCERITY_SCORE));
  const breakdown = {
    range: {
      min: MIN_SINCERITY_SCORE,
      max: MAX_SINCERITY_SCORE
    },
    completedTests,
    countedTests,
    practiceTests,
    activeDays,
    activitySpanDays,
    completionRate: Number((completionRate * 100).toFixed(2)),
    averagePerformance: Number(averagePerformance.toFixed(2)),
    inactivityDays: Number.isFinite(inactivityDays) ? inactivityDays : null,
    unresolvedStarts: unresolvedStartedEntries.length,
    consistencyScore: Number(consistencyScore.toFixed(2)),
    testsAttemptedScore: Number(testsAttemptedScore.toFixed(2)),
    averagePerformanceScore: Number(averagePerformanceScore.toFixed(2)),
    recentActivityScore: Number(recentActivityScore.toFixed(2)),
    improvementTrendScore: Number(improvementTrendScore.toFixed(2)),
    practiceFrequencyScore: Number(practiceFrequencyScore.toFixed(2)),
    countedPracticeBalanceScore: Number(countedPracticeBalanceScore.toFixed(2)),
    behaviorAdjustment,
    practiceAdjustment: Number(practiceAdjustment.toFixed(2)),
    distributionAdjustment,
    unresolvedPenalty,
    rawScore: Number(rawScore.toFixed(2)),
    clampedScore: sincerityScore
  };

  return {
    sincerityScore,
    label: getSincerityLabel(sincerityScore, breakdown),
    breakdown
  };
};

module.exports = {
  calculateSincerityScore
};
