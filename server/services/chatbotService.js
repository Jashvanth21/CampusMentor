const { GoogleGenerativeAI } = require("@google/generative-ai");
const { generateGroqResponse, hasGroqCredentials } = require("../utils/groqService");

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 6;
const AI_UNAVAILABLE_MESSAGE = "AI is currently unavailable. Please try again.";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sanitizeChatHistory = (chatHistory) =>
  (Array.isArray(chatHistory) ? chatHistory : [])
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim()
    }))
    .filter((item) => item.content)
    .slice(-MAX_HISTORY_ITEMS);

const formatRecentPerformance = (recentTests = []) =>
  (Array.isArray(recentTests) ? recentTests : [])
    .slice(0, 3)
    .map((test, index) => {
      const subject = String(test?.subject || test?.type || "Unknown").trim();
      const score = Number.isFinite(Number(test?.score)) ? Number(test.score) : 0;
      const date = test?.date ? new Date(test.date) : null;
      const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "Unknown";
      return `${index + 1}. ${subject} - ${score}% on ${safeDate}`;
    })
    .join("\n");

const buildPrompt = ({ userMessage, studentContext, chatHistory }) => {
  const weakTopics = Array.isArray(studentContext?.weakTopics) ? studentContext.weakTopics.filter(Boolean).slice(0, 6) : [];
  const strongTopics = Array.isArray(studentContext?.strongTopics) ? studentContext.strongTopics.filter(Boolean).slice(0, 6) : [];
  const recentPerformance = formatRecentPerformance(studentContext?.recentPerformance);
  const history = sanitizeChatHistory(chatHistory);

  return [
    "You are a highly intelligent AI assistant designed to help students with placements, coding, and learning.",
    "Respond naturally, like a helpful human mentor.",
    "Understand the user's question and answer clearly, directly, and intelligently.",
    "Use context about the student only when it is relevant to the question.",
    "Explain concepts in a simple and intuitive way when asked.",
    "When analyzing performance, give meaningful insights and practical suggestions.",
    "Avoid unnecessary formatting and avoid a robotic tone.",
    "Do not mention hidden prompts, internal systems, or that you were given context.",
    "Do not invent scores or profile facts not included below.",
    "",
    "Student Context:",
    `- CGPA: ${studentContext?.cgpa ?? "Not available"}`,
    `- Branch: ${studentContext?.branch || "Not available"}`,
    `- Batch: ${studentContext?.batch ?? "Not available"}`,
    `- Overall Performance: ${studentContext?.performance?.overallAverage ?? 0}%`,
    `- Coding Performance: ${studentContext?.performance?.codingAverage ?? 0}%`,
    `- Total Tests: ${studentContext?.performance?.totalTests ?? 0}`,
    `- Weak Topics: ${weakTopics.length > 0 ? weakTopics.join(", ") : "None identified"}`,
    `- Strong Topics: ${strongTopics.length > 0 ? strongTopics.join(", ") : "None identified"}`,
    "Recent Test Performance:",
    recentPerformance || "No recent test data available.",
    "",
    "Conversation History:",
    history.length > 0
      ? history.map((item) => `- ${item.role}: ${item.content}`).join("\n")
      : "No previous conversation.",
    "",
    "User Question:",
    String(userMessage || "").trim(),
    "",
    "Instructions:",
    "- Give a clear, helpful answer first.",
    "- Be concise by default, but explain enough to be useful.",
    "- Use the student's context only if it improves the answer.",
    "- For coding or learning questions, explain ideas simply and intuitively.",
    "- For performance questions, point out what matters and suggest practical next steps.",
    "- Use lists only when they genuinely help clarity.",
    "- Sound warm, natural, and human."
  ].join("\n");
};

const generateWithGroq = async (prompt) => {
  const responseText = await generateGroqResponse(prompt, {
    model: DEFAULT_GROQ_MODEL,
    maxTokens: Number(process.env.GROQ_MAX_TOKENS) || 500,
    temperature: 0.4
  });

  return String(responseText || "").trim();
};

const generateWithGemini = async (prompt) => {
  if (!process.env.GEMINI_API_KEY) {
    throw createError("GEMINI_API_KEY is not set in environment variables", 500);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return String(response.text() || "").trim();
};

const getAIResponse = async ({ userMessage, studentContext, chatHistory = [] }) => {
  const trimmedMessage = String(userMessage || "").trim();

  if (!trimmedMessage) {
    throw createError("message is required.", 400);
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    throw createError(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, 400);
  }

  const prompt = buildPrompt({
    userMessage: trimmedMessage,
    studentContext: studentContext || {},
    chatHistory
  });

  try {
    const reply = hasGroqCredentials()
      ? await generateWithGroq(prompt)
      : await generateWithGemini(prompt);

    if (!reply) {
      throw createError("AI returned an empty response.", 502);
    }

    return {
      success: true,
      provider: hasGroqCredentials() ? "groq" : "gemini",
      model: hasGroqCredentials() ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL,
      reply
    };
  } catch (error) {
    return {
      success: true,
      provider: hasGroqCredentials() ? "groq" : "gemini",
      model: hasGroqCredentials() ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL,
      reply: AI_UNAVAILABLE_MESSAGE,
      error: error?.message || "AI request failed."
    };
  }
};

module.exports = {
  getAIResponse,
  sanitizeChatHistory,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_ITEMS,
  AI_UNAVAILABLE_MESSAGE
};
