const Student = require("../models/Student");
const { getStudentAnalytics } = require("./studentService");
const { generateCareerRecommendations } = require("../engine/recommendationEngine");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getCareerRecommendations = async (userId) => {
  const studentProfile = await Student.findOne({ userId });
  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const analytics = await getStudentAnalytics(userId);
  const recommendation = generateCareerRecommendations(studentProfile, analytics);

  studentProfile.careerRecommendations = [
    {
      generatedAt: new Date(),
      ...recommendation
    }
  ];
  await studentProfile.save();

  return {
    success: true,
    recommendations: recommendation,
    analytics: {
      performance: analytics.performance,
      sincerity: analytics.sincerity
    }
  };
};

module.exports = {
  getCareerRecommendations
};
