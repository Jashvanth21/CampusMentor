const express = require("express");
const { testGroqConnection, hasGroqCredentials } = require("../services/llmService");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  const hasGroq = hasGroqCredentials();
  console.log("Groq:", hasGroq ? "Configured" : "Missing API key");

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
    console.log("Groq failed -> using internal analytics response");
    console.log(error.message);
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

module.exports = router;
