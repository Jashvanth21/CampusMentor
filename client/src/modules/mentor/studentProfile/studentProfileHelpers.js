export const FEEDBACK_OPTIONS = [
  "DSA",
  "Aptitude",
  "Technical Fundamentals",
  "Problem Solving",
  "Communication",
  "Time Management",
  "Consistency",
  "Projects"
];

export const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const mapTrendData = (detailData) => {
  const rawHistory =
    detailData?.profile?.performanceHistory ||
    detailData?.performance?.history ||
    detailData?.performance?.attempts ||
    [];

  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((entry, index) => {
      const attemptedAt = entry?.takenAt || entry?.date || entry?.submittedAt || null;
      const date = attemptedAt ? new Date(attemptedAt) : null;
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

      return {
        id: entry?._id || entry?.id || `trend-${index}`,
        date,
        score: toNumber(entry?.score)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const buildStudentSummary = (detail) => {
  const performance = detail?.performance || {};
  const averageScore = toNumber(performance?.overallAverage);
  const codingAverage = toNumber(performance?.codingAverage);
  const mcqAverage = toNumber(performance?.mcqAverage);
  const totalAttempts = toNumber(performance?.totalTests);

  const candidateScores = [averageScore, codingAverage, mcqAverage].filter((score) =>
    Number.isFinite(score)
  );
  const lowestScore = candidateScores.length > 0 ? Math.min(...candidateScores) : 0;

  const riskStatus = detail?.performance?.riskStatus || "Safe";
  const risk =
    riskStatus === "At Risk"
      ? { label: "Attention Needed", className: "risk-high" }
      : { label: "Safe", className: "risk-safe" };

  return {
    averageScore,
    codingAverage,
    mcqAverage,
    totalAttempts,
    lowestScore,
    risk
  };
};

export const buildRecommendationMetrics = (detail, summary, trendData) => {
  const trendDirection =
    trendData.length >= 2
      ? trendData[trendData.length - 1].score > trendData[trendData.length - 2].score
        ? "up"
        : trendData[trendData.length - 1].score < trendData[trendData.length - 2].score
          ? "down"
          : "flat"
      : "flat";

  const weakAreas = Array.isArray(detail?.profile?.mentorFeedback?.weakAreas)
    ? detail.profile.mentorFeedback.weakAreas
    : Array.isArray(detail?.careerRecommendations?.areasToImprove)
      ? detail.careerRecommendations.areasToImprove.map((item) => item?.topic).filter(Boolean)
      : [];

  return {
    averageScore: summary.averageScore,
    codingAverage: summary.codingAverage,
    mcqAverage: summary.mcqAverage,
    totalAttempts: summary.totalAttempts,
    riskLevel: summary?.risk?.label || "medium",
    trendDirection,
    weakAreas
  };
};

export const buildAttemptHistory = (detail) => {
  const rawHistory =
    detail?.profile?.performanceHistory ||
    detail?.performance?.history ||
    detail?.performance?.attempts ||
    [];

  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((entry, index) => {
      const attemptedAt = entry?.takenAt || entry?.date || entry?.submittedAt || null;
      const parsedDate = attemptedAt ? new Date(attemptedAt) : null;
      const score = toNumber(entry?.score);
      const isPractice = entry?.isFirstAttempt === false || String(entry?.attemptMode || "").toLowerCase() === "practice";

      return {
        id: entry?._id || entry?.id || `attempt-${index}`,
        title: entry?.testName || entry?.title || "Mock Test",
        scoreLabel: `${score.toFixed(1)}%`,
        dateLabel:
          parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toLocaleString()
            : "Date unavailable",
        status: isPractice ? "Practice" : "Counted",
        statusClassName: isPractice ? "status-practice" : "status-counted",
        sortKey: parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey);
};

export const buildFeedbackFormState = (mentorFeedback = {}) => ({
  mentor_feedback: mentorFeedback?.feedback || "",
  sincerity_score: mentorFeedback?.sincerityScore ?? 5,
  weak_areas: Array.isArray(mentorFeedback?.weakAreas) ? mentorFeedback.weakAreas : [],
  reviewed: Boolean(mentorFeedback?.reviewed),
  focus_area: mentorFeedback?.focusArea || ""
});
