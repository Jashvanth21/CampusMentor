const express = require("express");
const { getAttemptAnalysis } = require("../services/attemptAnalysisService");
const { hasGroqCredentials, testGroqConnection } = require("../services/llmService");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, allowRoles("student"));

router.get("/test-ai", async (req, res) => {
  const hasGroq = hasGroqCredentials();

  if (!hasGroq) {
    return res.status(200).json({
      success: true,
      source: "ai",
      message: "Groq API key missing"
    });
  }

  try {
    const message = await testGroqConnection();
    return res.status(200).json({
      success: true,
      source: "ai",
      message
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      source: "ai",
      message: error.message,
      error: {
        message: error.message,
        statusCode: error.statusCode || error.status || 500
      }
    });
  }
});

router.get("/:attemptId", async (req, res, next) => {
  try {
    const result = await getAttemptAnalysis(req.user.id, req.params.attemptId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
