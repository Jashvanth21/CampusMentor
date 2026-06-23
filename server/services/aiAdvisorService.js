const Student = require("../models/Student");
const { getStudentAnalytics } = require("./studentService");
const { getCareerRecommendations } = require("./recommendationService");
const { buildAIPrompt } = require("../engine/aiAdvisorEngine");
const { generateAIFeedback } = require("./llmService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAIAdvisorReport = async (userId) => {
  const studentProfile = await Student.findOne({ userId });
  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const analytics = await getStudentAnalytics(userId);
  const recommendationResult = await getCareerRecommendations(userId);
  const recommendations = recommendationResult.recommendations;

  const prompt = buildAIPrompt(studentProfile, analytics, recommendations);

  let content;
  let error = null;

  try {
    content = await generateAIFeedback({
      prompt,
      analytics: analytics.performance,
      sincerity: analytics.sincerity,
      recommendations,
      cgpa: studentProfile.cgpa ?? 0,
      skills: studentProfile.skills || []
    });
  } catch (llmError) {
    error = llmError.message;
    content =
      "AI mentor response is currently unavailable. Review analytics and recommendations, then retry.";
  }

  return {
    success: true,
    aiReport: content,
    performance: analytics.performance,
    sincerity: analytics.sincerity,
    recommendations,
    ...(error ? { error, partial: true } : {})
  };
};

module.exports = {
  getAIAdvisorReport
};
