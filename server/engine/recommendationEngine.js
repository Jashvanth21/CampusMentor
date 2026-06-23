const toNumber = (value) => Number(value) || 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const generateCareerRecommendations = (studentProfile, analytics) => {
  const performance = analytics?.performance || {};
  const sincerity = analytics?.sincerity || {};
  const subjectBreakdown = performance.subjectBreakdown || {};

  const overallAverage = toNumber(performance.overallAverage);
  const codingAverage = toNumber(performance.codingAverage);
  const mcqAverage = toNumber(performance.mcqAverage);
  const aptitudeAverage = toNumber(subjectBreakdown?.Aptitude?.averageScorePerSubject);
  const technicalAverage = toNumber(subjectBreakdown?.Technical?.averageScorePerSubject);
  const sincerityScore = toNumber(sincerity.sincerityScore);
  const cgpa = toNumber(studentProfile?.cgpa);
  const skills = Array.isArray(studentProfile?.skills) ? studentProfile.skills : [];
  const weakestTopics = Array.isArray(performance.weakestTopics) ? performance.weakestTopics : [];

  const recommendedRoles = [];
  const improvementAreas = [];
  const learningRoadmap = [];

  if (codingAverage > 75 && sincerityScore > 60) {
    recommendedRoles.push("Software Developer", "Competitive Programming");
  }

  if (aptitudeAverage > 70 && sincerityScore > 50) {
    recommendedRoles.push("Consulting", "Analyst");
  }

  if (technicalAverage > 70 && codingAverage < 60) {
    recommendedRoles.push("Core Engineering Roles");
  }

  if (overallAverage < 50) {
    improvementAreas.push("Overall performance needs foundational strengthening.");
    learningRoadmap.push("Focus on skill improvement roadmap before placement applications.");
  }

  if (weakestTopics.length > 0) {
    const weakTopicNames = weakestTopics.map((item) => item.topic).filter(Boolean);
    if (weakTopicNames.length > 0) {
      improvementAreas.push(`Weak topics: ${weakTopicNames.join(", ")}.`);
      learningRoadmap.push(`Revise and practice weak topics: ${weakTopicNames.join(", ")}.`);
    }
  }

  if (codingAverage < mcqAverage) {
    improvementAreas.push("Coding performance is lagging MCQ performance.");
    learningRoadmap.push("Solve 3-5 coding problems daily to improve implementation speed.");
  } else if (mcqAverage < codingAverage) {
    improvementAreas.push("MCQ/theory performance is lagging coding performance.");
    learningRoadmap.push("Increase conceptual revision and timed MCQ practice.");
  }

  if (skills.length < 3) {
    improvementAreas.push("Skill portfolio is limited for diverse placement roles.");
    learningRoadmap.push("Add at least 2 role-aligned skills and build mini projects.");
  }

  if (recommendedRoles.length === 0) {
    recommendedRoles.push("Generalist Entry-Level Roles");
  }

  const uniqueRoles = [...new Set(recommendedRoles)];
  const uniqueImprovementAreas = [...new Set(improvementAreas)];
  const uniqueRoadmap = [...new Set(learningRoadmap)];

  const placementReadinessScore = clamp(
    Math.round(
      overallAverage * 0.4 +
        codingAverage * 0.25 +
        sincerityScore * 0.2 +
        (cgpa * 10) * 0.1 +
        Math.min(skills.length, 5) * 1
    ),
    0,
    100
  );

  return {
    recommendedRoles: uniqueRoles,
    improvementAreas: uniqueImprovementAreas,
    learningRoadmap: uniqueRoadmap,
    placementReadinessScore
  };
};

module.exports = {
  generateCareerRecommendations
};
