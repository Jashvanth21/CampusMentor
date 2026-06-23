const { getStudentAnalytics } = require("../services/studentService");
const { generateAIInsights } = require("../services/aiInsightsService");

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSubjectAverage = (analytics, subjectName) => {
  const subjectBreakdown = Array.isArray(analytics?.subjectBreakdown) ? analytics.subjectBreakdown : [];
  const subjectItem = subjectBreakdown.find((item) => item?.subject === subjectName || item?.name === subjectName);
  return toNumber(subjectItem?.averageScore ?? subjectItem?.score);
};

const getRecentScores = (analytics) => {
  const trendData = Array.isArray(analytics?.trendData) ? analytics.trendData : [];
  return trendData.slice(-5).map((entry) => toNumber(entry?.score));
};

const toTopicNames = (topics) =>
  (Array.isArray(topics) ? topics : [])
    .map((topic) => (typeof topic === "string" ? topic : topic?.topic))
    .filter(Boolean);

const createFallbackInsights = ({
  strongTopics,
  weakTopics,
  testsAttempted,
  aptitudeAverage,
  overallAverage
}) => {
  const insights = [];
  const topStrongTopics = toTopicNames(strongTopics).slice(0, 3);
  const topWeakTopics = toTopicNames(weakTopics).slice(0, 3);

  if (topStrongTopics.length > 0) {
    insights.push(`Strong subjects/topics: ${topStrongTopics.join(", ")}.`);
  }

  if (topWeakTopics.length > 0) {
    insights.push(`Focus on weak topics: ${topWeakTopics.join(", ")}.`);
  }

  if (testsAttempted < 5) {
    insights.push("Practice more tests to build stronger analytics and consistency.");
  }

  if (aptitudeAverage < 60) {
    insights.push("Improve aptitude speed with timed drills and repeated shortcut practice.");
  }

  if (overallAverage < 50) {
    insights.push("Prioritize fundamentals first, then increase mock-test frequency each week.");
  }

  if (insights.length === 0) {
    insights.push("Maintain your current progress and keep practicing mixed mock tests regularly.");
  }

  return insights;
};

const normalizeInsightList = (rawInsights) => {
  if (!rawInsights || typeof rawInsights !== "string") {
    return [];
  }

  return rawInsights
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await getStudentAnalytics(req.user.id);
    const overallAverage = toNumber(analytics?.overallAverage ?? analytics?.performance?.overallAverage);
    const codingAverage = toNumber(analytics?.codingAverage ?? analytics?.performance?.codingAverage);
    const aptitudeAverage = getSubjectAverage(analytics, "Aptitude");
    const technicalAverage = getSubjectAverage(analytics, "Technical");
    const strongTopics = Array.isArray(analytics?.strongTopics) ? analytics.strongTopics : [];
    const weakTopics = Array.isArray(analytics?.weakTopics) ? analytics.weakTopics : [];
    const testsAttempted = toNumber(analytics?.totalTests ?? analytics?.performance?.totalTests);
    const recentScores = getRecentScores(analytics);

    console.log("Analytics Summary:", {
      totalTests: testsAttempted,
      overallAverage,
      codingAverage,
      aptitudeAverage,
      technicalAverage
    });

    const aiInsightText = await generateAIInsights({
      overallAverage,
      codingAverage,
      aptitudeAverage,
      technicalAverage,
      strongTopics,
      weakTopics,
      testsAttempted,
      recentScores
    });

    const normalizedAIInsights = normalizeInsightList(aiInsightText);
    const insights =
      normalizedAIInsights.length > 0
        ? normalizedAIInsights
        : createFallbackInsights({
            strongTopics,
            weakTopics,
            testsAttempted,
            aptitudeAverage,
            overallAverage
          });

    res.status(200).json({
      ...analytics,
      overallAverage,
      codingAverage,
      aptitudeAverage,
      technicalAverage,
      strongTopics,
      weakTopics,
      testsAttempted,
      recentScores,
      insights
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics
};
