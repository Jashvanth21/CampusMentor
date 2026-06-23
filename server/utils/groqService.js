const axios = require("axios");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const DEFAULT_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS) || 1200;

const hasGroqCredentials = () => Boolean(process.env.GROQ_API_KEY);

const generateGroqResponse = async (prompt, options = {}) => {
  if (!hasGroqCredentials()) {
    const error = new Error("Groq API key missing.");
    error.status = 503;
    throw error;
  }

  const requestPayload = {
    model: options.model || DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.3,
    max_tokens: Number(options.maxTokens) || DEFAULT_MAX_TOKENS
  };

  try {
    const response = await axios.post(GROQ_API_URL, requestPayload, {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: Number(process.env.GROQ_TIMEOUT_MS) || 15000
    });

    const data = response?.data;

    const aiText = data?.choices?.[0]?.message?.content;

    if (!data || !Array.isArray(data.choices) || !aiText) {
      return null;
    }

    return String(aiText).trim() || null;
  } catch (error) {
    const normalizedError = new Error(
      error?.response?.data?.error?.message || error?.message || "Groq request failed."
    );
    normalizedError.status =
      Number(error?.response?.status) ||
      Number(error?.status) ||
      Number(error?.statusCode) ||
      502;
    normalizedError.statusCode = normalizedError.status;
    normalizedError.response = error?.response;
    throw normalizedError;
  }
};

module.exports = {
  generateGroqResponse,
  hasGroqCredentials
};
