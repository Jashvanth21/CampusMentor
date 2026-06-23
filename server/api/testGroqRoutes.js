const express = require("express");
const { generateGroqResponse, hasGroqCredentials } = require("../utils/groqService");

const router = express.Router();

router.get("/", async (req, res) => {
  console.log("➡️ Starting AI analysis...");

  if (!hasGroqCredentials()) {
    console.log("📌 Source selected:", "rule-based");
    return res.status(200).json({
      success: true,
      source: "ai",
      result: null,
      message: "Groq API key missing"
    });
  }

  const result = await generateGroqResponse("Say Hello", {
    maxTokens: 80,
    temperature: 0
  });

  console.log("🧠 AI Result:", result);
  console.log("📌 Source selected:", result ? "groq" : "rule-based");

  return res.status(200).json({
    success: true,
    source: "ai",
    result,
    message: result ? "Groq responded successfully." : "Groq returned no response."
  });
});

module.exports = router;
