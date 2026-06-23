const toNumber = (value) => Number(value) || 0;

const buildAIPrompt = (studentProfile, analytics, recommendations) => {
  const performance = analytics?.performance || {};
  const sincerity = analytics?.sincerity || {};
  const subjectBreakdown = performance.subjectBreakdown || {};
  const weakestTopics = Array.isArray(performance.weakestTopics) ? performance.weakestTopics : [];
  const roles = Array.isArray(recommendations?.recommendedRoles)
    ? recommendations.recommendedRoles
    : [];

  const promptPayload = {
    studentProfile: {
      cgpa: toNumber(studentProfile?.cgpa),
      skills: Array.isArray(studentProfile?.skills) ? studentProfile.skills : []
    },
    analytics: {
      overallAverage: toNumber(performance.overallAverage),
      codingAverage: toNumber(performance.codingAverage),
      mcqAverage: toNumber(performance.mcqAverage),
      totalTests: toNumber(performance.totalTests),
      subjectBreakdown,
      weakestTopics,
      sincerityScore: toNumber(sincerity?.sincerityScore)
    },
    recommendations: {
      recommendedRoles: roles,
      improvementAreas: recommendations?.improvementAreas || [],
      learningRoadmap: recommendations?.learningRoadmap || [],
      placementReadinessScore: toNumber(recommendations?.placementReadinessScore)
    }
  };

  return [
    "You are an AI Mentor for CampusMentor.",
    "Use the student context below to provide:",
    "1) strengths summary",
    "2) weaknesses summary",
    "3) most suitable career path",
    "4) clear 30-day improvement plan",
    "5) placement readiness estimate with reasoning.",
    "Keep it practical and concise.",
    "",
    "Student Context (JSON):",
    JSON.stringify(promptPayload, null, 2)
  ].join("\n");
};

module.exports = {
  buildAIPrompt
};
