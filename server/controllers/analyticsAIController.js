const { getAnalyticsAIForUser } = require("../services/analyticsAIService");

const getAnalyticsAI = async (req, res, next) => {
  try {
    const result = await getAnalyticsAIForUser(req.user.id, req.params.userId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAnalyticsAI
};
