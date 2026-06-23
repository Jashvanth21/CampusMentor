const { generateGroqResponse, hasGroqCredentials } = require("../utils/groqService");

const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const DEFAULT_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS) || 1200;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const buildMinimalAnalyticsData = (analyticsData = {}) => ({
  overallAverage: Number(analyticsData?.overallAverage) || 0,
  codingScore: Number(analyticsData?.codingScore) || 0,
  aptitudeScore: Number(analyticsData?.aptitudeScore) || 0,
  technicalScore: Number(analyticsData?.technicalScore) || 0,
  totalAttempts: Number(analyticsData?.totalAttempts) || 0,
  strongTopics: Array.isArray(analyticsData?.strongTopics) ? analyticsData.strongTopics.slice(0, 6) : [],
  weakTopics: Array.isArray(analyticsData?.weakTopics) ? analyticsData.weakTopics.slice(0, 6) : []
});

const buildIncrementalAnalyticsData = (analyticsData = {}) => ({
  previousSummary: String(analyticsData?.previousSummary || "").trim(),
  previousSections: {
    coding: {
      score: Number(analyticsData?.previousSections?.coding?.score) || 0,
      level: String(analyticsData?.previousSections?.coding?.level || "").trim(),
      explanation: String(analyticsData?.previousSections?.coding?.explanation || "").trim()
    },
    aptitude: {
      score: Number(analyticsData?.previousSections?.aptitude?.score) || 0,
      level: String(analyticsData?.previousSections?.aptitude?.level || "").trim(),
      explanation: String(analyticsData?.previousSections?.aptitude?.explanation || "").trim()
    },
    technical: {
      score: Number(analyticsData?.previousSections?.technical?.score) || 0,
      level: String(analyticsData?.previousSections?.technical?.level || "").trim(),
      explanation: String(analyticsData?.previousSections?.technical?.explanation || "").trim()
    }
  },
  previousScores: {
    coding: Number(analyticsData?.previousScores?.coding) || 0,
    aptitude: Number(analyticsData?.previousScores?.aptitude) || 0,
    technical: Number(analyticsData?.previousScores?.technical) || 0
  },
  previousStrengths: Array.isArray(analyticsData?.previousStrengths) ? analyticsData.previousStrengths.slice(0, 6) : [],
  previousWeaknesses: Array.isArray(analyticsData?.previousWeaknesses) ? analyticsData.previousWeaknesses.slice(0, 6) : [],
  newStrengths: Array.isArray(analyticsData?.newStrengths) ? [...new Set(analyticsData.newStrengths.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 6) : [],
  newWeaknesses: Array.isArray(analyticsData?.newWeaknesses) ? [...new Set(analyticsData.newWeaknesses.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 6) : [],
  previousRecommendations: Array.isArray(analyticsData?.previousRecommendations)
    ? analyticsData.previousRecommendations.slice(0, 6)
    : [],
  previousStudyPlan: Array.isArray(analyticsData?.previousStudyPlan) ? analyticsData.previousStudyPlan.slice(0, 6) : [],
  newAttempt: analyticsData?.newAttempt || null
});

const requestGroqJSON = async (label, prompt, options = {}) => {
  const modelName = options?.model || DEFAULT_MODEL;
  const responseText = await generateGroqResponse(prompt, {
    model: modelName,
    maxTokens: DEFAULT_MAX_TOKENS,
    ...options
  });

  if (!responseText) {
    throw createError(`Groq request failed for ${label}.`, 502);
  }

  const text = String(responseText || "");
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  if (!cleaned.endsWith("}")) {
    const recoverableLastBrace = cleaned.lastIndexOf("}");
    if (recoverableLastBrace !== -1) {
      cleaned = cleaned.slice(0, recoverableLastBrace + 1);
    }
  }

  const start = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (start === -1 || lastBrace === -1) {
    throw new Error("Invalid JSON format from Groq");
  }

  cleaned = cleaned.slice(start, lastBrace + 1).trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Invalid AI response format");
  }
};

const generateAIFeedback = async (promptData) => {
  const prompt = [
    "You are a practical AI mentor. Give specific, actionable guidance for students.",
    "Return plain text only.",
    "Context:",
    JSON.stringify(promptData, null, 2)
  ].join("\n\n");

  const responseText = await generateGroqResponse(prompt, {
    maxTokens: 300,
    temperature: 0.4
  });

  if (!responseText) {
    throw createError("Groq request failed for AI feedback.", 502);
  }

  return responseText.trim();
};

const generateText = async (prompt, options = {}) => {
  const modelName = options?.model || DEFAULT_MODEL;

  const responseText = await generateGroqResponse(prompt, {
    model: modelName,
    maxTokens: Number(options?.maxTokens) || 200,
    temperature: options?.temperature ?? 0.3
  });

  if (!responseText) {
    throw createError("Groq request failed for text generation.", 502);
  }

  return String(responseText).trim();
};

const generateAttemptAnalysis = async (attemptData) => {
  const prompt = [
    "You are an expert AI academic performance analyst.",
    "Analyze this student's completed test attempt deeply and return valid JSON only.",
    'Use this exact shape: {"summary":"string","strengths":["string"],"weaknesses":["string"],"mistakeAnalysis":["string"],"timeAnalysis":"string|null","improvementStrategy":["string"],"nextTestFocus":["string"]}.',
    "Rules:",
    "- Do not give generic statements.",
    "- Base the analysis on accuracy, topic performance, mistake patterns, and time efficiency.",
    "- Analyze ONLY this single attempt. Do not infer overall student performance or use other tests.",
    "- Respect attemptData.testType strictly.",
    "- For Technical, discuss only technical concepts, technical mistake patterns, and technical recommendations. Do not mention aptitude or coding.",
    "- For Aptitude, discuss only aptitude weak areas, logical mistakes, quantitative/verbal reasoning, and aptitude recommendations. Do not mention coding or technical MCQ concepts.",
    "- For Coding, discuss only coding quality, problem solving, complexity, optimization, failed test-case patterns, and programming mistakes. Do not mention aptitude or technical MCQ concepts.",
    "- Explain why the student performed that way.",
    "- Identify thinking gaps, not just topic names.",
    "- nextTestFocus is mandatory and must contain at least 2 to 3 actionable points based on weakTopics and mistake patterns.",
    "- If timeTaken is null, do not generate time analysis and return timeAnalysis as null.",
    "- If formattedTimeTaken is present, use that exact value whenever mentioning total attempt duration.",
    "- If formattedTimePerQuestion is present, use that exact value whenever mentioning pace per question.",
    "- Never convert timeTaken into hours or minutes yourself; use formattedTimeTaken for total duration wording.",
    "- If any section cannot be derived from input data, return null instead of generating assumptions.",
    "- Avoid repetition.",
    "- Keep explanations meaningful and specific to the input data.",
    "- Return JSON only with no markdown fences.",
    "Attempt data:",
    JSON.stringify(attemptData, null, 2)
  ].join("\n\n");

  const parsed = await requestGroqJSON("attempt analysis", prompt, {
    maxTokens: 400,
    temperature: 0.3
  });

  return {
    summary: String(parsed?.summary || "").trim() || "Performance analysis is available.",
    strengths: Array.isArray(parsed?.strengths)
      ? parsed.strengths.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [],
    weaknesses: Array.isArray(parsed?.weaknesses)
      ? parsed.weaknesses.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [],
    mistakeAnalysis: Array.isArray(parsed?.mistakeAnalysis)
      ? parsed.mistakeAnalysis.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [],
    timeAnalysis: parsed?.timeAnalysis == null ? null : String(parsed?.timeAnalysis || "").trim(),
    improvementStrategy: Array.isArray(parsed?.improvementStrategy)
      ? parsed.improvementStrategy.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : [],
    nextTestFocus: Array.isArray(parsed?.nextTestFocus)
      ? parsed.nextTestFocus.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
      : []
  };
};

const generateAnalyticsInsights = async (analyticsData) => {
  const minimalData = buildMinimalAnalyticsData(analyticsData);
  const prompt = [
    "You are an AI mentor for placement preparation.",
    "Analyze the student's real performance data and return valid JSON only.",
    "Return ONLY raw JSON. Do NOT use markdown. Do NOT wrap in ```.",
    'Use this exact shape: {"summary":"string","keyInsight":"string","recommendation":"string","sections":{"coding":{"score":0,"level":"Good|Average|Poor","explanation":"string","improvementTips":["string"]},"aptitude":{"score":0,"level":"Good|Average|Poor","explanation":"string","improvementTips":["string"]},"technical":{"score":0,"level":"Good|Average|Poor","explanation":"string","improvementTips":["string"]}}}.',
    "Rules:",
    "- Base the response strictly on overallAverage, codingScore, aptitudeScore, technicalScore, weakTopics, strongTopics, and totalAttempts.",
    "- Generate a concise performance explanation in paragraph form.",
    "- Do NOT list topics explicitly.",
    "- Explain overall performance using overallAverage, codingScore, aptitudeScore, and technicalScore.",
    "- Compare coding performance against MCQ performance and mention if coding is weaker or stronger.",
    "- Mention consistency or imbalance if section scores suggest it.",
    "- Summary must be 2 to 3 natural lines explaining overall performance, section comparison, and trend direction.",
    "- keyInsight must be one short actionable sentence.",
    "- recommendation must be one short natural-language paragraph with 2 to 3 concrete improvement suggestions.",
    "- If codingScore < aptitudeScore, mention that coding needs more structured practice.",
    "- If overallAverage < 60, mention fundamentals revision.",
    "- If overallAverage is between 60 and 75, focus on consistency and structured practice.",
    "- If overallAverage is above 75, mention harder mocks and advanced practice.",
    "- Do not repeat topic names as a list in summary, keyInsight, or recommendation.",
    "- Keep the response concise, practical, and student-friendly.",
    "- Return JSON only with no markdown fences.",
    "Student analytics data:",
    JSON.stringify(minimalData, null, 2)
  ].join("\n\n");

  let parsed;
  try {
    parsed = await requestGroqJSON("analytics insights", prompt, {
      maxTokens: 700,
      temperature: 0.3
    });
  } catch (error) {
    throw error;
  }

  const normalized = {
    summary: String(parsed?.summary || "").trim(),
    keyInsight: String(parsed?.keyInsight || "").trim(),
    recommendation: String(parsed?.recommendation || "").trim(),
    sections: {
      coding: {
        score: Number(parsed?.sections?.coding?.score) || 0,
        level: String(parsed?.sections?.coding?.level || "").trim(),
        explanation: String(parsed?.sections?.coding?.explanation || "").trim(),
        improvementTips: Array.isArray(parsed?.sections?.coding?.improvementTips)
          ? parsed.sections.coding.improvementTips.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : []
      },
      aptitude: {
        score: Number(parsed?.sections?.aptitude?.score) || 0,
        level: String(parsed?.sections?.aptitude?.level || "").trim(),
        explanation: String(parsed?.sections?.aptitude?.explanation || "").trim(),
        improvementTips: Array.isArray(parsed?.sections?.aptitude?.improvementTips)
          ? parsed.sections.aptitude.improvementTips.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : []
      },
      technical: {
        score: Number(parsed?.sections?.technical?.score) || 0,
        level: String(parsed?.sections?.technical?.level || "").trim(),
        explanation: String(parsed?.sections?.technical?.explanation || "").trim(),
        improvementTips: Array.isArray(parsed?.sections?.technical?.improvementTips)
          ? parsed.sections.technical.improvementTips.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : []
      }
    }
  };

  if (
    !normalized.summary ||
    !normalized.keyInsight ||
    !normalized.recommendation
  ) {
    throw createError("Invalid AI response format", 502);
  }

  return normalized;
};

const generateIncrementalAnalyticsInsights = async (analyticsData) => {
  const incrementalData = buildIncrementalAnalyticsData(analyticsData);
  const prompt = [
    "You are an AI mentor for placement preparation.",
    "Update the student's existing analytics using only the previous cache and one newly completed attempt.",
    "Do NOT recompute from scratch and do NOT assume access to the full attempt history.",
    "Treat previousSummary, previousSections, and previousScores as the baseline state.",
    "Use newAttempt to adjust the analysis incrementally while keeping consistency with prior trends.",
    "Use newStrengths and newWeaknesses from the latest attempt as explicit topic signals.",
    "Return ONLY raw JSON. Do NOT use markdown. Do NOT wrap in ```. ",
    'Use this exact shape: {"summary":"string","keyInsight":"string","recommendation":"string","sections":{"coding":{"score":0,"level":"Good|Average|Poor","explanation":"string","improvementTips":["string"]},"aptitude":{"score":0,"level":"Good|Average|Poor","explanation":"string","improvementTips":["string"]},"technical":{"score":0,"level":"Good|Average|Poor","explanation":"string","improvementTips":["string"]}}}.',
    "Rules:",
    "- Update the previous analysis based only on the newAttempt impact.",
    "- Keep the output consistent with earlier trends unless the new attempt clearly changes them.",
    "- Use newStrengths and newWeaknesses to update the previous strengths and weaknesses without ignoring previous context.",
    "- If a topic appears in newStrengths, it may move from weak to strong if the new attempt justifies that shift.",
    "- If a topic appears in newWeaknesses, treat it as weak even if it appeared strong before, unless the latest attempt evidence is too small to matter.",
    "- If the new attempt is coding, primarily adjust coding-related guidance and cross-section balance only where justified.",
    "- If the new attempt is aptitude or technical, adjust only the affected areas and overall direction.",
    "- Generate a holistic explanation instead of explicitly listing strong or weak topics.",
    "- Do NOT list topics explicitly.",
    "- summary must explain overall performance, coding vs MCQ balance, and consistency in paragraph form.",
    "- keyInsight must be one short actionable sentence.",
    "- recommendation must be one short natural-language paragraph with concrete improvement guidance.",
    "- Keep the response concise, practical, and student-friendly.",
    "- Return JSON only with no markdown fences.",
    "Incremental analytics data:",
    JSON.stringify(incrementalData, null, 2)
  ].join("\n\n");

  const parsed = await requestGroqJSON("incremental analytics insights", prompt, {
    maxTokens: 550,
    temperature: 0.2
  });

  const normalized = {
    summary: String(parsed?.summary || "").trim(),
    keyInsight: String(parsed?.keyInsight || "").trim(),
    recommendation: String(parsed?.recommendation || "").trim(),
    sections: {
      coding: {
        score: Number(parsed?.sections?.coding?.score) || 0,
        level: String(parsed?.sections?.coding?.level || "").trim(),
        explanation: String(parsed?.sections?.coding?.explanation || "").trim(),
        improvementTips: Array.isArray(parsed?.sections?.coding?.improvementTips)
          ? parsed.sections.coding.improvementTips.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : []
      },
      aptitude: {
        score: Number(parsed?.sections?.aptitude?.score) || 0,
        level: String(parsed?.sections?.aptitude?.level || "").trim(),
        explanation: String(parsed?.sections?.aptitude?.explanation || "").trim(),
        improvementTips: Array.isArray(parsed?.sections?.aptitude?.improvementTips)
          ? parsed.sections.aptitude.improvementTips.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : []
      },
      technical: {
        score: Number(parsed?.sections?.technical?.score) || 0,
        level: String(parsed?.sections?.technical?.level || "").trim(),
        explanation: String(parsed?.sections?.technical?.explanation || "").trim(),
        improvementTips: Array.isArray(parsed?.sections?.technical?.improvementTips)
          ? parsed.sections.technical.improvementTips.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
          : []
      }
    }
  };

  if (
    !normalized.summary ||
    !normalized.keyInsight ||
    !normalized.recommendation
  ) {
    throw createError("Invalid AI response format", 502);
  }

  return normalized;
};

const generateCareerRoadmap = async (roadmapData) => {
  const prompt = [
    "You are an expert career mentor.",
    "Generate a clean, non-repetitive, phase-based learning roadmap tailored to this student.",
    "Return ONLY raw JSON. Do NOT wrap in ```json or markdown.",
    'Use this exact shape: {"careerPath":"string","whyThisCareerFits":"string","improvementAdvice":["string"],"overallAnalysis":"string","phases":[{"phase":"Phase 1: Foundation & Weak Areas","focus":"string","topics":["string"],"tasks":["string"]},{"phase":"Phase 2: Skill Building","focus":"string","topics":["string"],"tasks":["string"]},{"phase":"Phase 3: Advanced Practice","focus":"string","topics":["string"],"tasks":["string"]},{"phase":"Phase 4: Placement Preparation","focus":"string","topics":["string"],"tasks":["string"]}]}.',
    "Requirements:",
    "- Return only the JSON object with no extra text.",
    "- Each field must have a unique purpose and must not repeat the same idea in another field.",
    "- Do not repeat sentences across sections.",
    "- Do not repeat the same advice item.",
    "- Do not repeat the same task across phases.",
    "- Phase 1 must focus on weak topics.",
    "- Phase 2 must build consistency and core role skills.",
    "- Phase 3 must include strong topics and harder practice.",
    "- Phase 4 must focus on placement readiness, mocks, and interview preparation.",
    "- Every task must be specific, actionable, and measurable.",
    "- Keep explanations short and meaningful.",
    "- Max 3 tasks per phase.",
    "- Max 2 to 3 topics per phase.",
    "- whyThisCareerFits must explain ONLY how the selected career aligns with the student's strengths and scores. Do NOT mention weaknesses or improvement areas.",
    "- overallAnalysis must give a neutral summary of overall performance including strengths and weaknesses. Do NOT repeat career-fit reasoning.",
    "- improvementAdvice must contain ONLY actionable steps to improve. Do NOT explain performance again.",
    "- whyThisCareerFits must be at most 2 short lines.",
    "- overallAnalysis must be at most 2 short lines.",
    "- improvementAdvice must contain at most 3 short points.",
    "- The roadmap MUST change significantly based on careerPath.",
    "- Do NOT generate a generic coding or aptitude plan.",
    "- Focus on the skills required for the selected career path.",
    "- Backend Developer roadmap must emphasize APIs, databases, system design, and scalability.",
    "- Full Stack Developer roadmap must emphasize frontend plus backend skills such as React, Node.js, UI building, state handling, and API integration.",
    "- Data Scientist roadmap must emphasize Python, statistics, machine learning, data analysis, SQL, and experiment interpretation.",
    "- Software Developer roadmap must emphasize DSA, problem solving, coding interviews, debugging, and implementation accuracy.",
    "- AI/ML Engineer roadmap must emphasize ML models, deep learning, data pipelines, model evaluation, and applied Python workflows.",
    "- weakTopics may be used as supporting correction signals, but they must NOT become the main structure of the roadmap.",
    "- strong topics should influence the advanced practice phase and stretch goals.",
    "- Each career path must produce a clearly different roadmap with distinct topics and tasks.",
    "- Avoid generic wording like practice more or improve skills.",
    "- Adjust task difficulty based on the student's scores.",
    "- Ensure the JSON is complete, closed, and valid.",
    "- If summary is present, use it to understand the student's overall performance and momentum.",
    "- If sectionScores are present, use them to infer strengths and weaker sections.",
    "- If recommendations are present, use them to understand immediate improvement areas.",
    "- If studyPlan is present, align the roadmap progression with that direction instead of contradicting it.",
    "- Do NOT contradict existing analytics insights when cache-style fields are present.",
    "- Infer weak areas from summary, recommendations, and studyPlan instead of relying only on weakTopics.",
    "- Infer stronger areas from sectionScores and summary instead of relying only on strongTopics.",
    "- Fallback to raw fields like overallAverage, coding, aptitude, technical, strongTopics, and weakTopics only if cache-style fields are missing.",
    "Student Data:",
    `Career Path: ${roadmapData?.careerPath || "Unknown"}`,
    `Summary: ${roadmapData?.summary || "Not available"}`,
    `Section Scores: ${JSON.stringify(roadmapData?.sectionScores || {}, null, 2)}`,
    `Analytics Recommendations: ${(roadmapData?.recommendations || []).join(" | ") || "None"}`,
    `Analytics Study Plan: ${(roadmapData?.studyPlan || []).join(" | ") || "None"}`,
    `Overall Average: ${roadmapData?.overallAverage ?? 0}`,
    `Coding Score: ${roadmapData?.coding ?? 0}`,
    `Aptitude Score: ${roadmapData?.aptitude ?? 0}`,
    `Technical Score: ${roadmapData?.technical ?? 0}`,
    `Skills From Profile: ${(roadmapData?.skills || []).join(", ") || "None"}`,
    `CGPA: ${roadmapData?.cgpa ?? 0}`,
    `Strong Topics: ${(roadmapData?.strongTopics || []).join(", ") || "None"}`,
    `Weak Topics: ${(roadmapData?.weakTopics || []).join(", ") || "None"}`,
    `Total Attempts: ${roadmapData?.totalTests ?? 0}`,
    `Preferred Language: ${roadmapData?.mostUsedLanguage || "Unknown"}`,
    "Previous roadmap:",
    JSON.stringify(roadmapData?.previousRoadmap || {}, null, 2)
  ].join("\n\n");

  let parsed;
  try {
    parsed = await requestGroqJSON("career roadmap", prompt, {
      maxTokens: 1200,
      temperature: 0.3
    });
  } catch (error) {
    throw error;
  }

  const normalized = {
    careerPath: String(parsed?.careerPath || roadmapData?.careerPath || "").trim(),
    whyThisCareerFits: String(parsed?.whyThisCareerFits || parsed?.summary || "").trim(),
    improvementAdvice: Array.isArray(parsed?.improvementAdvice)
      ? parsed.improvementAdvice.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
      : [],
    overallAnalysis: String(parsed?.overallAnalysis || parsed?.summary || "").trim(),
    phases: Array.isArray(parsed?.phases)
      ? parsed.phases.map((phase) => ({
          phase: String(phase?.phase || "").trim(),
          focus: String(phase?.focus || "").trim(),
          topics: Array.isArray(phase?.topics)
            ? phase.topics.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
            : [],
          tasks: Array.isArray(phase?.tasks)
            ? phase.tasks.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
            : []
        }))
      : []
  };

  const valid =
    Boolean(normalized.careerPath) &&
    Boolean(normalized.whyThisCareerFits) &&
    Array.isArray(normalized.improvementAdvice) &&
    normalized.improvementAdvice.length > 0 &&
    Boolean(normalized.overallAnalysis) &&
    Array.isArray(normalized.phases) &&
    normalized.phases.length === 4 &&
    normalized.phases.every(
      (phase) =>
        phase.phase &&
        phase.focus &&
        Array.isArray(phase.topics) &&
        phase.topics.length > 0 &&
        Array.isArray(phase.tasks) &&
        phase.tasks.length > 0
    );

  return {
    roadmap: normalized,
    valid
  };
};

const generateCareerRecommendationsAI = async (careerData) => {
  const prompt = [
    "Generate a career recommendation for a student and return valid JSON only.",
    'Use this exact shape: {"recommendedCareer":"string","reason":"string","strengthSummary":"string","improvementSummary":"string","strengths":["string"],"improvements":["string"],"confidence":"High|Medium|Low"}.',
    "Base the answer primarily on analytics AI cache inputs when available: summary, section scores, recommendations, studyPlan, CGPA, skills, and totalAttempts.",
    "If summary, recommendations, or studyPlan are present, use them to understand the student's learning direction and do not contradict those analytics insights.",
    "Infer strengths from section scores, summary, recommendations, and studyPlan instead of relying only on strongTopics.",
    "Infer weaknesses from section scores, recommendation guidance, and studyPlan focus areas instead of relying only on weakTopics.",
    "Fallback to overallAverage, codingScore, aptitudeScore, technicalScore, strongTopics, weakTopics, and totalAttempts only if cache-style fields are missing.",
    "Do NOT list more than 2 strengths.",
    "Do NOT list more than 3 improvements.",
    "Group related topics into one explanation whenever possible.",
    "Avoid repeating similar sentences such as recent performance is weaker.",
    "Each item should summarize multiple topics if possible.",
    "Strengths must be 1 to 2 high-level skill explanations.",
    "Improvements must be 2 to 3 grouped actionable areas.",
    "Avoid mentioning individual topics repeatedly.",
    "Prefer grouped phrases like data structures fundamentals, problem-solving consistency, implementation accuracy, and core CS revision.",
    "Keep the reason concise and practical.",
    "Return JSON only.",
    "Student data:",
    JSON.stringify(careerData, null, 2)
  ].join("\n\n");

  const parsed = await requestGroqJSON("career recommendations", prompt, {
    maxTokens: 500,
    temperature: 0.3
  });

  return {
    recommendedCareer: String(parsed?.recommendedCareer || "").trim(),
    reason: String(parsed?.reason || "").trim(),
    strengthSummary: String(parsed?.strengthSummary || "").trim(),
    improvementSummary: String(parsed?.improvementSummary || "").trim(),
    strengths: Array.isArray(parsed?.strengths)
      ? parsed.strengths.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
      : [],
    improvements: Array.isArray(parsed?.improvements)
      ? parsed.improvements.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
      : [],
    confidence: String(parsed?.confidence || "").trim(),
    recommendedPaths: Array.isArray(parsed?.recommendedPaths)
      ? parsed.recommendedPaths
          .map((item) => ({
            role: String(item?.role || "").trim(),
            reason: String(item?.reason || "").trim()
          }))
          .filter((item) => item.role && item.reason)
          .slice(0, 3)
      : [],
    bestPath: String(parsed?.bestPath || parsed?.recommendedCareer || "").trim(),
    whyThisMatchesYou: String(parsed?.whyThisMatchesYou || "").trim(),
    improvementAdvice: String(parsed?.improvementAdvice || "").trim(),
    strongSkills: Array.isArray(parsed?.strongSkills)
      ? parsed.strongSkills
          .map((item) => ({
            topic: String(item?.topic || "").trim(),
            reason: String(item?.reason || "").trim()
          }))
          .filter((item) => item.topic && item.reason)
          .slice(0, 6)
      : [],
    areasToImprove: Array.isArray(parsed?.areasToImprove)
      ? parsed.areasToImprove
          .map((item) => ({
            topic: String(item?.topic || "").trim(),
            reason: String(item?.reason || "").trim()
          }))
          .filter((item) => item.topic && item.reason)
          .slice(0, 8)
      : []
  };
};

const testGroqConnection = async () => {
  const prompt = "Say hello";
  const responseText = await generateGroqResponse(prompt, {
    maxTokens: 80,
    temperature: 0
  });

  if (!responseText) {
    throw createError("Groq request failed.", 502);
  }

  return responseText.trim();
};

module.exports = {
  generateAIFeedback,
  generateText,
  generateAttemptAnalysis,
  generateAnalyticsInsights,
  generateIncrementalAnalyticsInsights,
  generateCareerRoadmap,
  generateCareerRecommendationsAI,
  hasGroqCredentials,
  testGroqConnection
};
