const axios = require("axios");

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 10000;
const GEMINI_MODEL = "gemini-1.5-flash";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTopicList = (topics) => {
  if (!Array.isArray(topics) || topics.length === 0) {
    return "None";
  }

  return topics
    .map((topic) => {
      if (typeof topic === "string") {
        return topic;
      }

      return topic?.topic || "";
    })
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");
};

const buildAnalyticsPrompt = (analytics) => {
  const payload = {
    overallAverage: toNumber(analytics?.overallAverage),
    codingAverage: toNumber(analytics?.codingAverage),
    aptitudeAverage: toNumber(analytics?.aptitudeAverage),
    technicalAverage: toNumber(analytics?.technicalAverage),
    testsAttempted: toNumber(analytics?.testsAttempted),
    strongTopics: formatTopicList(analytics?.strongTopics),
    weakTopics: formatTopicList(analytics?.weakTopics)
  };

  return [
    "You are an analytics mentor for placement preparation.",
    "Generate 3 to 5 short practical insights for the student.",
    "Keep every insight concise, actionable, and easy to show in a list.",
    "Do not use markdown, headings, or numbering.",
    "Mention strengths, weak areas, and what to focus on next.",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
};

const generateAIInsights = async (analytics) => {
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return null;
  }

  const prompt = buildAnalyticsPrompt(analytics);

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.4
        }
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: AI_TIMEOUT_MS
      }
    );

    const text = response?.data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("\n")
      .trim();

    return text || null;
  } catch (err) {
    return null;
  }
};

module.exports = {
  buildAnalyticsPrompt,
  generateAIInsights
};
