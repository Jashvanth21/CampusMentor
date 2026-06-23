const Student = require("../models/Student");
const { getStudentAnalytics } = require("../services/studentService");
const { getAIResponse, sanitizeChatHistory } = require("../services/chatbotService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const postStudentChatMessage = async (req, res, next) => {
  try {
    const requestUserId = String(req.user?.id || "").trim();
    const studentId = String(req.body?.studentId || requestUserId).trim();

    if (!requestUserId) {
      throw createError("Authenticated student is required.", 401);
    }

    if (studentId !== requestUserId) {
      throw createError("Students can only access their own chatbot context.", 403);
    }

    const [studentProfile, analytics] = await Promise.all([
      Student.findOne({ userId: requestUserId }).lean(),
      getStudentAnalytics(requestUserId)
    ]);

    if (!studentProfile) {
      throw createError("Student profile not found.", 404);
    }

    const result = await getAIResponse({
      userMessage: req.body?.message,
      chatHistory: sanitizeChatHistory(req.body?.chatHistory),
      studentContext: {
        cgpa: studentProfile?.cgpa ?? null,
        branch: studentProfile?.branch || "",
        batch: studentProfile?.batch ?? null,
        weakTopics: Array.isArray(studentProfile?.weakTopics) ? studentProfile.weakTopics : [],
        strongTopics: Array.isArray(analytics?.strongTopics) ? analytics.strongTopics : [],
        recentPerformance: Array.isArray(analytics?.trendData) ? [...analytics.trendData].slice(-3).reverse() : [],
        performance: {
          overallAverage: Number(analytics?.overallAverage) || 0,
          codingAverage: Number(analytics?.codingAverage) || 0,
          totalTests: Number(analytics?.totalTests) || 0
        }
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  postStudentChatMessage
};
