const Student = require("../models/Student");
const User = require("../models/User");
const { ensureStudentRole, ensureFirstAttemptFlags, getAnalyticsAttempts } = require("./studentService");
const {
  generateAnalyticsInsights,
  generateIncrementalAnalyticsInsights,
  generateCareerRecommendationsAI,
  generateCareerRoadmap,
  hasGroqCredentials
} = require("./llmService");
const { loadStudentWithTestData } = require("./studentTestDataService");
const { buildTopicStatsFromAttempts, getTopics } = require("../utils/topicStats");

const SECTION_KEYS = ["coding", "aptitude", "technical"];
const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEBUG_FORCE_AI_REFRESH = process.env.DEBUG_FORCE_AI_ANALYTICS === "true";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundToOne = (value) => Number(toNumber(value).toFixed(1));

const normalizeAttemptTimeTakenMinutes = (attempt) => {
  const rawTimeTaken = Number(attempt?.timeTaken);
  if (Number.isFinite(rawTimeTaken) && rawTimeTaken > 0) {
    // Most stored attempts use seconds; keep compatibility with older minute-based records.
    if (rawTimeTaken >= 60) {
      return roundToOne(rawTimeTaken / 60);
    }
    return roundToOne(rawTimeTaken);
  }

  const startMs = new Date(attempt?.startTime || 0).getTime();
  const endMs = new Date(attempt?.takenAt || attempt?.endTime || 0).getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > 0 && endMs > startMs) {
    return roundToOne((endMs - startMs) / 60000);
  }

  return null;
};

const normalizeSectionKey = (attempt) => {
  const subject = String(attempt?.subject || attempt?.testId?.subject || "").trim().toLowerCase();
  if (subject === "coding") return "coding";
  if (subject === "aptitude") return "aptitude";
  if (subject === "technical" || subject === "dsa") return "technical";

  return String(attempt?.type || "").toUpperCase() === "CODING" ? "coding" : "technical";
};

const getSectionLabel = (sectionKey) => {
  if (sectionKey === "coding") return "Coding";
  if (sectionKey === "aptitude") return "Aptitude";
  return "Technical";
};

const getPerformanceLevel = (score) => {
  if (score >= 70) return "Good";
  if (score >= 40) return "Average";
  return "Poor";
};

const getSectionExplanation = (sectionKey, score, attemptsCount) => {
  const label = getSectionLabel(sectionKey);
  const level = getPerformanceLevel(score);

  if (attemptsCount === 0) {
    return `No counted ${label.toLowerCase()} attempts are available yet. Start with one focused test to build a reliable baseline.`;
  }

  if (level === "Good") {
    return `${label} performance is strong at ${score}%. Maintain this level with timed revision and mixed practice sets.`;
  }

  if (level === "Average") {
    return `${label} performance is moderate at ${score}%. A few targeted practice rounds can convert this section into a strength.`;
  }

  return `${label} performance is currently weak at ${score}%. Prioritize fundamentals, slower review, and short practice loops in this section.`;
};

const getSectionImprovementTips = (sectionKey, score) => {
  const level = getPerformanceLevel(score);

  if (sectionKey === "coding") {
    if (level === "Good") {
      return [
        "Practice medium and hard DSA problems.",
        "Focus on optimizing time complexity.",
        "Participate in timed coding contests."
      ];
    }
    if (level === "Average") {
      return [
        "Solve one timed coding set every two days.",
        "Revise common patterns like arrays, strings, and recursion.",
        "Review wrong submissions before starting new problems."
      ];
    }
    return [
      "Rebuild logic with easy array and string problems.",
      "Practice one topic at a time before mixing questions.",
      "Review editorial solutions and re-code them yourself."
    ];
  }

  if (sectionKey === "aptitude") {
    if (level === "Good") {
      return [
        "Improve speed in quantitative problems.",
        "Practice time-bound assessments.",
        "Focus on weak topics like Time and Work."
      ];
    }
    if (level === "Average") {
      return [
        "Revise arithmetic shortcuts and formulas daily.",
        "Use short timed drills for reasoning sets.",
        "Track the question types where time is lost."
      ];
    }
    return [
      "Revisit arithmetic basics and percentage formulas.",
      "Practice small reasoning sets with a timer.",
      "Keep a mistake log for repeated aptitude errors."
    ];
  }

  if (level === "Good") {
    return [
      "Revise advanced interview-oriented technical questions.",
      "Link concepts across DBMS, OS, and CN.",
      "Teach one concept aloud after every revision session."
    ];
  }
  if (level === "Average") {
    return [
      "Revise DBMS, OS, and CN in short focused blocks.",
      "Solve concept-based interview questions after revision.",
      "Create short notes for last-minute recall."
    ];
  }
  return [
    "Revise DBMS, OS, and CN fundamentals from scratch.",
    "Use short notes and concept maps for revision.",
    "Practice interview-style technical questions daily."
  ];
};

const sanitizeTextList = (items, limit = 6) =>
  (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);

const dedupeTextList = (items, seen = new Set(), limit = 6) => {
  const output = [];

  sanitizeTextList(items, limit * 3).forEach((item) => {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    output.push(item);
  });

  return output.slice(0, limit);
};

const normalizeAnalyticsSource = (source, fallback = "ai") => {
  const normalized = String(source || "").trim().toLowerCase();
  if (normalized === "ai" || normalized === "groq" || normalized === "cache") {
    return "ai";
  }
  return fallback;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hasValidAIAnalytics = (payload) =>
  Boolean(payload) &&
  typeof payload === "object" &&
  Boolean(String(payload.summary || "").trim()) &&
  Boolean(String(payload.keyInsight || "").trim()) &&
  Boolean(String(payload.recommendation || "").trim()) &&
  payload.sections &&
  SECTION_KEYS.every((sectionKey) => {
    const section = payload.sections?.[sectionKey];
    return (
      section &&
      Number.isFinite(Number(section?.score)) &&
      Boolean(String(section?.level || "").trim()) &&
      Boolean(String(section?.explanation || "").trim()) &&
      Array.isArray(section?.improvementTips) &&
      section.improvementTips.length > 0
    );
  });

const callAnalyticsAIWithRetry = async (promptData, retries = 2) => {
  try {
    return await generateAnalyticsInsights(promptData);
  } catch (error) {
    const status =
      Number(error?.status) ||
      Number(error?.statusCode) ||
      Number(error?.response?.status) ||
      0;

    if (status === 429 && retries > 0) {
      await delay(1500);
      return callAnalyticsAIWithRetry(promptData, retries - 1);
    }

    throw error;
  }
};

const callIncrementalAnalyticsAIWithRetry = async (promptData, retries = 2) => {
  try {
    return await generateIncrementalAnalyticsInsights(promptData);
  } catch (error) {
    const status =
      Number(error?.status) ||
      Number(error?.statusCode) ||
      Number(error?.response?.status) ||
      0;

    if (status === 429 && retries > 0) {
      await delay(1500);
      return callIncrementalAnalyticsAIWithRetry(promptData, retries - 1);
    }

    throw error;
  }
};

const buildTopicEntries = (attempts) => {
  const topicStats = new Map();

  attempts.forEach((attempt) => {
    const answers = Array.isArray(attempt?.detailedResult?.answers) ? attempt.detailedResult.answers : [];
    if (answers.length > 0) {
      answers.forEach((answer) => {
        const topic = String(answer?.topic || "General").trim() || "General";
        const existing = topicStats.get(topic) || {
          name: topic,
          section: normalizeSectionKey(attempt),
          totalUnits: 0,
          earnedUnits: 0,
          attempts: 0
        };
        existing.totalUnits += 1;
        existing.earnedUnits += answer?.isCorrect ? 1 : 0;
        existing.attempts += 1;
        topicStats.set(topic, existing);
      });
      return;
    }

    const codingQuestions = Array.isArray(attempt?.questionWiseResults)
      ? attempt.questionWiseResults
      : Array.isArray(attempt?.detailedResult?.questions)
        ? attempt.detailedResult.questions
        : [];
    const testQuestions = Array.isArray(attempt?.testId?.questions) ? attempt.testId.questions : [];

    codingQuestions.forEach((question, index) => {
      const topic =
        String(question?.topic || testQuestions[index]?.topic || question?.questionTitle || "General").trim() ||
        "General";
      const totalUnits = Math.max(1, toNumber(question?.totalTestCases));
      const earnedUnits = Math.max(0, Math.min(totalUnits, toNumber(question?.passedTestCases)));
      const existing = topicStats.get(topic) || {
        name: topic,
        section: normalizeSectionKey(attempt),
        totalUnits: 0,
        earnedUnits: 0,
        attempts: 0
      };
      existing.totalUnits += totalUnits;
      existing.earnedUnits += earnedUnits;
      existing.attempts += 1;
      topicStats.set(topic, existing);
    });
  });

  return Array.from(topicStats.values())
    .map((topic) => ({
      name: topic.name,
      section: topic.section,
      attempts: topic.attempts,
      accuracy: topic.totalUnits > 0 ? roundToOne((topic.earnedUnits / topic.totalUnits) * 100) : 0
    }))
    .sort(
      (left, right) =>
        right.accuracy - left.accuracy || right.attempts - left.attempts || left.name.localeCompare(right.name)
    );
};

const buildPromptData = (attempts) => {
  const testsAttempted = attempts.length;
  const averageScore = testsAttempted
    ? roundToOne(attempts.reduce((sum, attempt) => sum + toNumber(attempt?.score), 0) / testsAttempted)
    : 0;

  const sectionBuckets = {
    coding: [],
    aptitude: [],
    technical: []
  };

  attempts.forEach((attempt) => {
    sectionBuckets[normalizeSectionKey(attempt)].push(toNumber(attempt?.score));
  });

  const sections = SECTION_KEYS.reduce((accumulator, sectionKey) => {
    const scores = sectionBuckets[sectionKey];
    accumulator[sectionKey] = scores.length
      ? roundToOne(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : 0;
    return accumulator;
  }, {});

  const topics = buildTopicEntries(attempts);
  const strongTopics = topics.filter((topic) => topic.accuracy >= 70).map((topic) => topic.name).slice(0, 6);
  const weakTopics = [...topics]
    .filter((topic) => topic.accuracy < 50)
    .sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts)
    .map((topic) => topic.name)
    .slice(0, 6);

  return {
    overallAverage: averageScore,
    codingScore: sections.coding,
    aptitudeScore: sections.aptitude,
    technicalScore: sections.technical,
    totalAttempts: testsAttempted,
    strongTopics,
    weakTopics,
    overall: {
      testsAttempted,
      averageScore
    },
    sections,
    topics,
    attempts: attempts.map((attempt) => ({
      attemptId: attempt?.attemptId || "",
      testName: attempt?.testId?.title || "Assessment",
      section: normalizeSectionKey(attempt),
      score: roundToOne(attempt?.score),
      percentage: roundToOne(attempt?.percentage ?? attempt?.score),
      takenAt: attempt?.takenAt || attempt?.endTime || attempt?.startTime || null,
      timeTaken: normalizeAttemptTimeTakenMinutes(attempt),
      questions: Array.isArray(attempt?.questionWiseResults)
        ? attempt.questionWiseResults.map((question, index) => ({
            topic:
              String(
                question?.topic ||
                  attempt?.testId?.questions?.[index]?.topic ||
                  question?.questionTitle ||
                  "General"
              ).trim() || "General",
            passedTestcases:
              question?.isCorrect === true
                ? 1
                : question?.isCorrect === false
                  ? 0
                  : Math.max(0, toNumber(question?.passedTestCases)),
            totalTestcases:
              question?.isCorrect === true || question?.isCorrect === false
                ? 1
                : Math.max(1, toNumber(question?.totalTestCases)),
            correctAnswer: question?.correctAnswer ?? null,
            userAnswer:
              question?.submittedAnswer ?? question?.userAnswer ?? question?.selectedAnswer ?? question?.answer ?? null
          }))
        : []
    }))
  };
};

const buildAnalyticsSignature = (attempts) => {
  const latestAttemptAt = [...attempts]
    .map((attempt) => new Date(attempt?.takenAt || attempt?.endTime || attempt?.startTime || 0).getTime())
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left)[0];

  return {
    attemptCount: attempts.length,
    latestAttemptAt: latestAttemptAt ? new Date(latestAttemptAt).toISOString() : null
  };
};

const buildAttemptQuestionSnapshot = (attempt) => {
  const questionWiseResults = Array.isArray(attempt?.questionWiseResults) ? attempt.questionWiseResults : [];
  return questionWiseResults.slice(0, 12).map((question, index) => ({
    topic:
      String(
        question?.topic ||
          attempt?.testId?.questions?.[index]?.topic ||
          question?.questionTitle ||
          question?.questionText ||
          "General"
      ).trim() || "General",
    isCorrect: question?.isCorrect === undefined ? null : Boolean(question?.isCorrect),
    passedTestcases:
      question?.isCorrect === true
        ? 1
        : question?.isCorrect === false
          ? 0
          : Math.max(0, toNumber(question?.passedTestCases)),
    totalTestcases:
      question?.isCorrect === true || question?.isCorrect === false
        ? 1
        : Math.max(1, toNumber(question?.totalTestCases)),
    marks: toNumber(question?.marksObtained ?? question?.marks),
    maxMarks: toNumber(question?.maxMarks)
  }));
};

const getAttemptTopicSignals = (questions = []) => {
  const topicPerformance = new Map();

  (Array.isArray(questions) ? questions : []).forEach((question) => {
    const topic = String(question?.topic || "").trim();
    if (!topic) {
      return;
    }

    const totalTestcases = toNumber(question?.totalTestcases);
    const passedTestcases = toNumber(question?.passedTestcases);
    const maxMarks = toNumber(question?.maxMarks);
    const marks = toNumber(question?.marks);

    let accuracy = 0;
    if (totalTestcases > 0) {
      accuracy = (passedTestcases / totalTestcases) * 100;
    } else if (maxMarks > 0) {
      accuracy = (marks / maxMarks) * 100;
    }

    const currentScores = topicPerformance.get(topic) || [];
    currentScores.push(roundToOne(accuracy));
    topicPerformance.set(topic, currentScores);
  });

  const newStrengths = [];
  const newWeaknesses = [];

  topicPerformance.forEach((scores, topic) => {
    const averageAccuracy = scores.length
      ? scores.reduce((sum, score) => sum + toNumber(score), 0) / scores.length
      : 0;

    if (averageAccuracy >= 70) {
      newStrengths.push(topic);
      return;
    }

    if (averageAccuracy < 40) {
      newWeaknesses.push(topic);
    }
  });

  return {
    newStrengths: dedupeTextList(newStrengths, new Set(), 6),
    newWeaknesses: dedupeTextList(newWeaknesses, new Set(), 6)
  };
};

const buildIncrementalPromptData = (latestAttempt, previousCache) => {
  const questionSnapshot = latestAttempt ? buildAttemptQuestionSnapshot(latestAttempt) : [];
  const { newStrengths, newWeaknesses } = getAttemptTopicSignals(questionSnapshot);

  console.log("New Strengths:", newStrengths);
  console.log("New Weaknesses:", newWeaknesses);

  return {
    previousSummary: String(previousCache?.summary || "").trim(),
    previousSections: previousCache?.sections || {
      coding: { score: 0, level: "Average", explanation: "" },
      aptitude: { score: 0, level: "Average", explanation: "" },
      technical: { score: 0, level: "Average", explanation: "" }
    },
    previousScores: previousCache?.sectionScores || {
      coding: 0,
      aptitude: 0,
      technical: 0
    },
    previousStrengths: Array.isArray(previousCache?.strengths) ? previousCache.strengths : previousCache?.strongTopics || [],
    previousWeaknesses: Array.isArray(previousCache?.weaknesses) ? previousCache.weaknesses : previousCache?.weakTopics || [],
    previousRecommendations: Array.isArray(previousCache?.recommendations) ? previousCache.recommendations : [],
    previousStudyPlan: Array.isArray(previousCache?.studyPlan) ? previousCache.studyPlan : [],
    newStrengths,
    newWeaknesses,
    newAttempt: latestAttempt
      ? {
          type: getSectionLabel(normalizeSectionKey(latestAttempt)),
          score: roundToOne(latestAttempt?.score),
          percentage: roundToOne(latestAttempt?.percentage ?? latestAttempt?.score),
          takenAt: latestAttempt?.takenAt || latestAttempt?.endTime || latestAttempt?.startTime || null,
          topics: questionSnapshot
            .map((question) => question.topic)
            .filter(Boolean)
            .slice(0, 8),
          questions: questionSnapshot
        }
      : null
  };
};

const signaturesMatch = (left, right) =>
  left?.attemptCount === right?.attemptCount &&
  left?.latestAttemptAt === right?.latestAttemptAt;

const isFreshEnough = (updatedAt) => {
  const timestamp = new Date(updatedAt || 0).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 && Date.now() - timestamp < AI_CACHE_TTL_MS;
};

const canReuseDbCache = (profile, signature) => {
  const cachePayload = profile?.aiAnalyticsCache;
  const cacheUpdatedAt = profile?.aiAnalyticsLastUpdated;
  if (!cachePayload || !cacheUpdatedAt) {
    return false;
  }

  if (!isFreshEnough(cacheUpdatedAt)) {
    return false;
  }

  const latestAttemptAt = signature?.latestAttemptAt ? new Date(signature.latestAttemptAt).getTime() : 0;
  const lastUpdatedAt = new Date(cacheUpdatedAt).getTime();
  if (latestAttemptAt && lastUpdatedAt < latestAttemptAt) {
    return false;
  }

  if (normalizeAnalyticsSource(cachePayload?.source, "ai") !== "ai") {
    return false;
  }

  return true;
};

const canUseIncrementalUpdate = (cacheSignature, currentSignature) => {
  const previousCount = Number(cacheSignature?.attemptCount) || 0;
  const currentCount = Number(currentSignature?.attemptCount) || 0;
  const previousLatest = String(cacheSignature?.latestAttemptAt || "").trim();
  const currentLatest = String(currentSignature?.latestAttemptAt || "").trim();

  return previousCount > 0 && currentCount === previousCount + 1 && Boolean(currentLatest) && currentLatest !== previousLatest;
};

const getLatestAttempt = (attempts = []) =>
  [...attempts]
    .sort((left, right) => {
      const leftTime = new Date(left?.takenAt || left?.endTime || left?.startTime || 0).getTime();
      const rightTime = new Date(right?.takenAt || right?.endTime || right?.startTime || 0).getTime();
      return rightTime - leftTime;
    })[0] || null;

const getAttemptsCountBySection = (attempts = []) =>
  SECTION_KEYS.reduce((accumulator, sectionKey) => {
    accumulator[sectionKey] = attempts.filter((attempt) => normalizeSectionKey(attempt) === sectionKey).length;
    return accumulator;
  }, {});

const buildSummary = (promptData, weakTopics, strongTopics) => {
  const overallScore = toNumber(promptData?.overall?.averageScore);

  if (promptData?.overall?.testsAttempted === 0) {
    return "No counted attempts are available yet. Complete an assessment to unlock analytics insights and a study plan.";
  }

  if (overallScore >= 75) {
    return `Your counted assessment performance is strong at ${overallScore}%. Keep sharpening weak spots while preserving your strongest areas such as ${strongTopics[0] || "your best topics"}.`;
  }

  if (overallScore >= 50) {
    return `Your overall average is ${overallScore}%, which shows a workable base. The biggest lift will come from improving ${weakTopics[0] || "your weakest topics"} and tightening section consistency.`;
  }

  return `Your overall average is ${overallScore}%, so fundamentals need attention before speed. Focus first on ${weakTopics[0] || "core weak topics"} and rebuild confidence with short, targeted practice.`;
};

const buildStrengthStatements = (strongTopics, sectionScores) => {
  const statements = [];

  if (strongTopics.length > 0) {
    strongTopics.slice(0, 2).forEach((topic) => {
      statements.push(`${topic} is a current strength and can be used for advanced practice and confidence-building.`);
    });
  }

  const rankedSections = [...SECTION_KEYS].sort(
    (left, right) => toNumber(sectionScores?.[right]) - toNumber(sectionScores?.[left])
  );
  const bestSection = rankedSections[0];
  if (bestSection && toNumber(sectionScores?.[bestSection]) >= 60) {
    statements.push(`${getSectionLabel(bestSection)} is relatively stronger, so keep it active with timed mixed revision.`);
  }

  return dedupeTextList(statements, new Set(), 6);
};

const buildWeaknessStatements = (weakTopics, sectionScores) => {
  const statements = [];

  if (weakTopics.length > 0) {
    weakTopics.slice(0, 2).forEach((topic) => {
      statements.push(`${topic} needs focused revision because it is one of the biggest score blockers right now.`);
    });
  }

  const rankedSections = [...SECTION_KEYS].sort(
    (left, right) => toNumber(sectionScores?.[left]) - toNumber(sectionScores?.[right])
  );
  const weakestSection = rankedSections[0];
  if (weakestSection && toNumber(sectionScores?.[weakestSection]) < 60) {
    statements.push(`${getSectionLabel(weakestSection)} needs more structured practice to improve consistency and reduce careless errors.`);
  }

  return dedupeTextList(statements, new Set(), 6);
};

const buildRecommendations = ({ promptData, weakTopics, strongTopics, lowestSection, highestSection }) => {
  const recommendations = [];
  const codingScore = toNumber(promptData?.codingScore);
  const aptitudeScore = toNumber(promptData?.aptitudeScore);
  const technicalScore = toNumber(promptData?.technicalScore);
  const overallAverage = toNumber(promptData?.overallAverage);

  if (weakTopics.length > 0) {
    recommendations.push(
      `Prioritize ${weakTopics.slice(0, 3).join(", ")} first because those weak topics are reducing your overall consistency across counted tests.`
    );
  }

  if (codingScore < aptitudeScore) {
    recommendations.push(
      `Your coding score is ${codingScore}% versus ${aptitudeScore}% in aptitude, so add extra coding practice to convert logic strength into implementation accuracy.`
    );
  }

  if (overallAverage < 60) {
    recommendations.push(
      `Your overall average is ${overallAverage}%, so focus on fundamentals revision before increasing speed or moving to harder mixed tests.`
    );
  }

  if (lowestSection && lowestSection === "technical") {
    recommendations.push(
      `Technical is one of your weaker sections at ${technicalScore}%, so consistent revision of DBMS, OS, CN, and OOPs should be part of your weekly plan.`
    );
  }

  if (highestSection || strongTopics.length > 0) {
    recommendations.push(
      `Use strong topics like ${strongTopics.slice(0, 2).join(", ") || getSectionLabel(highestSection).toLowerCase()} for advanced practice so you keep momentum while fixing weaker areas.`
    );
  }

  if (promptData?.overall?.testsAttempted < 4) {
    recommendations.push(
      `You have only ${promptData?.overall?.testsAttempted || 0} counted tests so far, so attempt more full assessments to make your trend and weak-topic signals more reliable.`
    );
  }

  recommendations.push(
    "Review every counted attempt after submission and note the exact mistakes you want to avoid before starting your next practice session."
  );

  return dedupeTextList(recommendations, new Set(), 5);
};

const buildStudyPlan = ({ promptData, weakTopics, strongTopics }) => {
  const codingScore = toNumber(promptData?.codingScore);
  const aptitudeScore = toNumber(promptData?.aptitudeScore);
  const technicalScore = toNumber(promptData?.technicalScore);
  const firstWeakTopic = weakTopics[0] || "Arrays";
  const secondWeakTopic = weakTopics[1] || "Loops";
  const strongestTopic = strongTopics[0] || "your strongest topic";

  return dedupeTextList([
    `Day 1-3: Focus on weak topics like ${firstWeakTopic} and ${secondWeakTopic} with 10 targeted coding questions and pattern review on LeetCode or HackerRank.`,
    `Day 4-5: Practice aptitude with 5 timed questions daily and revise formulas for percentages, ratios, and reasoning shortcuts.`,
    `Day 6-7: Revise technical topics through one DBMS, OS, CN, or OOPs block each day and solve 20 follow-up MCQs after revision.`,
    `Week 2: Take one full assessment and review all mistakes before the next practice cycle.`,
    `Advanced practice: Use ${strongestTopic} for one higher-difficulty problem set so your strong areas continue to improve.`
  ], new Set(), 5);
};

const buildAnalyticsRecommendationList = (recommendationData, fallbackRecommendations = []) => {
  if (!recommendationData || typeof recommendationData !== "object") {
    return dedupeTextList(fallbackRecommendations, new Set(), 6);
  }

  const list = [
    recommendationData?.reason,
    recommendationData?.whyThisMatchesYou,
    recommendationData?.improvementAdvice,
    ...(Array.isArray(recommendationData?.improvements)
      ? recommendationData.improvements.map((item) => String(item || "").trim()).filter(Boolean)
      : [])
  ];

  return dedupeTextList(list, new Set(), 6);
};

const buildAnalyticsStudyPlanList = (roadmapData, fallbackStudyPlan = []) => {
  const phases = Array.isArray(roadmapData?.roadmap?.phases)
    ? roadmapData.roadmap.phases
    : Array.isArray(roadmapData?.phases)
      ? roadmapData.phases
      : [];

  if (phases.length === 0) {
    return dedupeTextList(fallbackStudyPlan, new Set(), 6);
  }

  const phaseLines = phases.map((phase) => {
    const phaseName = String(phase?.phase || "").trim();
    const focus = String(phase?.focus || "").trim();
    const tasks = Array.isArray(phase?.tasks)
      ? phase.tasks.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
      : [];

    return [phaseName, focus, tasks.length > 0 ? `Tasks: ${tasks.join(", ")}` : ""]
      .filter(Boolean)
      .join(" - ");
  });

  return dedupeTextList(phaseLines, new Set(), 6);
};

const getRankedSections = (sections = {}) =>
  [...SECTION_KEYS].sort((left, right) => toNumber(sections?.[right]) - toNumber(sections?.[left]));

const enrichAnalyticsWithSupplementaryAI = async ({
  userId,
  promptData,
  analysis,
  strongTopics,
  weakTopics,
  hasGroq
}) => {
  const rankedSections = getRankedSections(promptData?.sections);
  const highestSection = rankedSections[0];
  const lowestSection = rankedSections[rankedSections.length - 1];
  const fallbackRecommendations = dedupeTextList(
    Array.isArray(analysis?.recommendations) && analysis.recommendations.length > 0
      ? analysis.recommendations
      : buildRecommendations({
          promptData,
          weakTopics,
          strongTopics,
          lowestSection,
          highestSection
        }),
    new Set(),
    6
  );
  const fallbackStudyPlan = dedupeTextList(
    Array.isArray(analysis?.studyPlan) && analysis.studyPlan.length > 0
      ? analysis.studyPlan
      : buildStudyPlan({ promptData, weakTopics, strongTopics }),
    new Set(),
    6
  );

  if (!hasGroq) {
    return {
      recommendations: fallbackRecommendations,
      studyPlan: fallbackStudyPlan
    };
  }

  const user = await User.findById(userId).select("careerPath");
  let recommendations = fallbackRecommendations;
  let studyPlan = fallbackStudyPlan;

  try {
    const recommendationsData = await generateCareerRecommendationsAI({
      overallAverage: promptData?.overallAverage,
      codingScore: promptData?.codingScore,
      aptitudeScore: promptData?.aptitudeScore,
      technicalScore: promptData?.technicalScore,
      strongTopics,
      weakTopics,
      totalAttempts: promptData?.totalAttempts
    });
    recommendations = buildAnalyticsRecommendationList(recommendationsData, fallbackRecommendations);
    console.log("Recommendations:", recommendations);
  } catch {
    recommendations = fallbackRecommendations;
  }

  try {
    const roadmapData = await generateCareerRoadmap({
      careerPath: String(user?.careerPath || "").trim(),
      overallAverage: promptData?.overallAverage,
      coding: promptData?.codingScore,
      aptitude: promptData?.aptitudeScore,
      technical: promptData?.technicalScore,
      strongTopics,
      weakTopics,
      totalTests: promptData?.totalAttempts
    });
    studyPlan = buildAnalyticsStudyPlanList(roadmapData, fallbackStudyPlan);
    console.log("StudyPlan:", studyPlan);
  } catch {
    studyPlan = fallbackStudyPlan;
  }

  return {
    recommendations,
    studyPlan
  };
};

const getConfidenceLabel = (promptData = {}, sectionScores = {}) => {
  const attempts = toNumber(promptData?.overall?.testsAttempted ?? promptData?.totalAttempts);
  const averageScore =
    (toNumber(sectionScores?.coding) + toNumber(sectionScores?.aptitude) + toNumber(sectionScores?.technical)) / 3;

  if (attempts >= 5 && averageScore >= 65) {
    return "High";
  }
  if (attempts >= 2 || averageScore >= 45) {
    return "Medium";
  }
  return "Improving";
};

const normalizeAnalyticsResponse = (analysis, promptData, defaultSource = "ai") => {
  const normalizedSource = normalizeAnalyticsSource(analysis?.source, defaultSource);
  const seenStatements = new Set();
  const strongTopics = dedupeTextList(analysis?.strengths || analysis?.strongTopics, seenStatements, 6);
  const weakTopics = dedupeTextList(analysis?.weaknesses || analysis?.weakTopics, seenStatements, 6);
  const sectionScores = SECTION_KEYS.reduce((accumulator, sectionKey) => {
    accumulator[sectionKey] = roundToOne(
      analysis?.sectionScores?.[sectionKey] ?? analysis?.sections?.[sectionKey]?.score ?? promptData?.sections?.[sectionKey]
    );
    return accumulator;
  }, {});
  const attemptsCountBySection = getAttemptsCountBySection(promptData?.attempts || []);
  const sections = SECTION_KEYS.reduce((accumulator, sectionKey) => {
    const attemptsCount = attemptsCountBySection[sectionKey] || 0;
    const fallbackScore = sectionScores[sectionKey];
    const fallbackLevel = getPerformanceLevel(fallbackScore);
    const fallbackExplanation = getSectionExplanation(sectionKey, fallbackScore, attemptsCount);
    const rawSection = analysis?.sections?.[sectionKey] || {};

    accumulator[sectionKey] = {
      score: roundToOne(rawSection?.score || fallbackScore),
      level: String(rawSection?.level || fallbackLevel).trim() || fallbackLevel,
      explanation: String(rawSection?.explanation || fallbackExplanation).trim() || fallbackExplanation,
      improvementTips: sanitizeTextList(
        rawSection?.improvementTips,
        3
      ).length > 0
        ? sanitizeTextList(rawSection?.improvementTips, 3)
        : getSectionImprovementTips(sectionKey, fallbackScore)
    };
    return accumulator;
  }, {});

  const generatedAt = analysis?.generatedAt || new Date();
  const strengths = buildStrengthStatements(strongTopics, sectionScores);
  const weaknesses = buildWeaknessStatements(weakTopics, sectionScores);

  return {
    source: normalizedSource,
    summary:
      String(analysis?.summary || "").trim() ||
      buildSummary(promptData, weakTopics, strongTopics),
    keyInsight:
      String(analysis?.keyInsight || "").trim() ||
      buildWeaknessStatements(weakTopics, sectionScores)[0] ||
      "Stay consistent with targeted practice to improve your weakest section.",
    recommendation:
      String(analysis?.recommendation || "").trim() ||
      buildRecommendations({ promptData, weakTopics, strongTopics })[0] ||
      "Use a structured weekly routine with section-wise revision, timed practice, and review after each counted test.",
    sections,
    sectionScores,
    strengths,
    weaknesses,
    strongTopics: dedupeTextList(
      analysis?.strongTopics,
      new Set(strongTopics.map((item) => item.toLowerCase())),
      6
    ).length > 0
      ? dedupeTextList(analysis?.strongTopics, new Set(strongTopics.map((item) => item.toLowerCase())), 6)
      : strongTopics,
    weakTopics: dedupeTextList(
      analysis?.weakTopics,
      new Set(weakTopics.map((item) => item.toLowerCase())),
      6
    ).length > 0
      ? dedupeTextList(analysis?.weakTopics, new Set(weakTopics.map((item) => item.toLowerCase())), 6)
      : weakTopics,
    promptData,
    recommendations: dedupeTextList(analysis?.recommendations, seenStatements, 6),
    studyPlan: dedupeTextList(analysis?.studyPlan, seenStatements, 6),
    confidence: getConfidenceLabel(promptData, sectionScores),
    generatedAt
  };
};

const ruleBasedAnalysis = (promptData, source = "rule-based") => {
  const topics = Array.isArray(promptData?.topics) ? promptData.topics : [];
  const strongTopics = topics.filter((topic) => topic.accuracy > 70).map((topic) => topic.name).slice(0, 6);
  const weakTopics = [...topics]
    .filter((topic) => topic.accuracy < 40)
    .sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts)
    .map((topic) => topic.name)
    .slice(0, 6);
  const rankedSections = [...SECTION_KEYS].sort(
    (left, right) => toNumber(promptData?.sections?.[right]) - toNumber(promptData?.sections?.[left])
  );
  const highestSection = rankedSections[0];
  const lowestSection = rankedSections[rankedSections.length - 1];

  return normalizeAnalyticsResponse(
    {
      source,
      summary: buildSummary(promptData, weakTopics, strongTopics),
      sections: SECTION_KEYS.reduce((accumulator, sectionKey) => {
        const score = toNumber(promptData?.sections?.[sectionKey]);
        const attemptsCount =
          promptData?.attempts?.filter((attempt) => attempt?.section === sectionKey).length || 0;
        accumulator[sectionKey] = {
          score: roundToOne(score),
          level: getPerformanceLevel(score),
          explanation: getSectionExplanation(sectionKey, score, attemptsCount),
          improvementTips: getSectionImprovementTips(sectionKey, score)
        };
        return accumulator;
      }, {}),
      strongTopics,
      weakTopics,
      recommendations: buildRecommendations({
        promptData,
        weakTopics,
        strongTopics,
        lowestSection,
        highestSection
      }),
      studyPlan: buildStudyPlan({
        promptData,
        weakTopics,
        strongTopics
      })
    },
    promptData,
    source
  );
};

const formatAnalyticsResponse = (data = {}) => ({
    summary: String(data?.summary || "").trim(),
    keyInsight: String(data?.keyInsight || "").trim(),
    recommendation: String(data?.recommendation || "").trim(),
    sections: {
      coding: {
        score: roundToOne(data?.sections?.coding?.score),
        level: String(data?.sections?.coding?.level || "Average").trim(),
        explanation: String(data?.sections?.coding?.explanation || "").trim(),
        improvementTips: sanitizeTextList(data?.sections?.coding?.improvementTips, 3)
      },
      aptitude: {
        score: roundToOne(data?.sections?.aptitude?.score),
        level: String(data?.sections?.aptitude?.level || "Average").trim(),
        explanation: String(data?.sections?.aptitude?.explanation || "").trim(),
        improvementTips: sanitizeTextList(data?.sections?.aptitude?.improvementTips, 3)
      },
      technical: {
        score: roundToOne(data?.sections?.technical?.score),
        level: String(data?.sections?.technical?.level || "Average").trim(),
        explanation: String(data?.sections?.technical?.explanation || "").trim(),
        improvementTips: sanitizeTextList(data?.sections?.technical?.improvementTips, 3)
      }
    },
    sectionScores: {
      coding: roundToOne(data?.sections?.coding?.score ?? data?.sectionScores?.coding),
      aptitude: roundToOne(data?.sections?.aptitude?.score ?? data?.sectionScores?.aptitude),
      technical: roundToOne(data?.sections?.technical?.score ?? data?.sectionScores?.technical)
    },
    promptData: data?.promptData && typeof data.promptData === "object"
      ? {
          ...data.promptData,
          attempts: Array.isArray(data?.promptData?.attempts) ? data.promptData.attempts : []
        }
      : {
          attempts: []
        },
    insights: String(data?.summary || "").trim(),
    strengths: sanitizeTextList(data?.strengths, 6),
    weaknesses: sanitizeTextList(data?.weaknesses, 6),
    strongTopics: sanitizeTextList(data?.strongTopics, 6),
    weakTopics: sanitizeTextList(data?.weakTopics, 6),
    recommendations: dedupeTextList(data?.recommendations, new Set(), 6),
    studyPlan: dedupeTextList(data?.studyPlan, new Set(), 6),
    confidence: String(data?.confidence || "Improving").trim() || "Improving",
    generatedAt: data?.generatedAt || new Date()
});

const buildAnalyticsEnvelope = (success, source, data) => ({
  success: true,
  source: normalizeAnalyticsSource(source, "ai"),
  data: formatAnalyticsResponse(data)
});

const sanitizeStoredAnalyticsCache = (cache = {}) => {
  if (!cache || typeof cache !== "object") {
    return null;
  }

  return {
    source: normalizeAnalyticsSource(cache?.source, "ai"),
    summary: String(cache?.summary || "").trim(),
    keyInsight: String(cache?.keyInsight || "").trim(),
    recommendation: String(cache?.recommendation || "").trim(),
    sections: {
      coding: {
        score: roundToOne(cache?.sections?.coding?.score),
        level: String(cache?.sections?.coding?.level || "Average").trim(),
        explanation: String(cache?.sections?.coding?.explanation || "").trim(),
        improvementTips: sanitizeTextList(cache?.sections?.coding?.improvementTips, 3)
      },
      aptitude: {
        score: roundToOne(cache?.sections?.aptitude?.score),
        level: String(cache?.sections?.aptitude?.level || "Average").trim(),
        explanation: String(cache?.sections?.aptitude?.explanation || "").trim(),
        improvementTips: sanitizeTextList(cache?.sections?.aptitude?.improvementTips, 3)
      },
      technical: {
        score: roundToOne(cache?.sections?.technical?.score),
        level: String(cache?.sections?.technical?.level || "Average").trim(),
        explanation: String(cache?.sections?.technical?.explanation || "").trim(),
        improvementTips: sanitizeTextList(cache?.sections?.technical?.improvementTips, 3)
      }
    },
    sectionScores: {
      coding: roundToOne(cache?.sectionScores?.coding ?? cache?.sections?.coding?.score),
      aptitude: roundToOne(cache?.sectionScores?.aptitude ?? cache?.sections?.aptitude?.score),
      technical: roundToOne(cache?.sectionScores?.technical ?? cache?.sections?.technical?.score)
    },
    promptData: cache?.promptData && typeof cache.promptData === "object"
      ? {
          ...cache.promptData,
          attempts: Array.isArray(cache?.promptData?.attempts) ? cache.promptData.attempts : []
        }
      : {
          attempts: []
        },
    strengths: sanitizeTextList(cache?.strengths, 6),
    weaknesses: sanitizeTextList(cache?.weaknesses, 6),
    strongTopics: sanitizeTextList(cache?.strongTopics, 6),
    weakTopics: sanitizeTextList(cache?.weakTopics, 6),
    recommendations: dedupeTextList(cache?.recommendations, new Set(), 6),
    studyPlan: dedupeTextList(cache?.studyPlan, new Set(), 6),
    confidence: String(cache?.confidence || "Improving").trim() || "Improving",
    signature: cache?.signature || null,
    generatedAt: cache?.generatedAt || null
  };
};

const resolveRequestedUserId = (requestUserId, userIdParam) => {
  const requested = String(userIdParam || "").trim();
  if (!requested || requested.toLowerCase() === "me") {
    return String(requestUserId);
  }

  if (requested !== String(requestUserId)) {
    throw createError("You can only access analytics for your own account.", 403);
  }

  return requested;
};

const getAnalyticsAIForUser = async (requestUserId, userIdParam) => {
  const resolvedUserId = resolveRequestedUserId(requestUserId, userIdParam);
  await ensureStudentRole(resolvedUserId);

  const profile = await loadStudentWithTestData(
    { userId: resolvedUserId },
    {
      select: "userId aiAnalyticsCache aiAnalyticsLastUpdated",
      attemptPopulate: "subject title questions"
    }
  );

  if (!profile) {
    const emptyAnalysis = ruleBasedAnalysis(
      {
        overall: { testsAttempted: 0, averageScore: 0 },
        sections: { coding: 0, aptitude: 0, technical: 0 },
        topics: [],
        attempts: []
      },
      "ai"
    );
    return buildAnalyticsEnvelope(false, "ai", emptyAnalysis);
  }

  await ensureFirstAttemptFlags(profile);

  const attempts = getAnalyticsAttempts(Array.isArray(profile?.mockTestScores) ? profile.mockTestScores : []);
  const topicStats =
    Array.isArray(profile?.topicStats) && profile.topicStats.length > 0
      ? profile.topicStats
      : buildTopicStatsFromAttempts(attempts);
  const computedTopics = getTopics(topicStats);
  const signature = buildAnalyticsSignature(attempts);
  const hasGroq = hasGroqCredentials();
  const previousCache = sanitizeStoredAnalyticsCache(profile.aiAnalyticsCache);

  if (!DEBUG_FORCE_AI_REFRESH && canReuseDbCache(profile, signature)) {
    return {
      ...buildAnalyticsEnvelope(true, "cache", previousCache),
      strongTopics: computedTopics.strongTopics,
      weakTopics: computedTopics.weakTopics
    };
  }

  const promptData = buildPromptData(attempts);
  const latestAttempt = getLatestAttempt(attempts);
  const incrementalPromptData = buildIncrementalPromptData(latestAttempt, previousCache);
  const shouldUseIncrementalAI = canUseIncrementalUpdate(previousCache?.signature, signature) && latestAttempt;
  let analysis;
  let envelope;

  if (!hasGroq) {
    analysis = ruleBasedAnalysis(promptData, "ai");
    analysis.strongTopics = computedTopics.strongTopics;
    analysis.weakTopics = computedTopics.weakTopics;
    envelope = buildAnalyticsEnvelope(false, "ai", analysis);
  } else {
    try {
      const aiAnalysis = shouldUseIncrementalAI
        ? await callIncrementalAnalyticsAIWithRetry(incrementalPromptData)
        : await callAnalyticsAIWithRetry(promptData);
      if (
        !aiAnalysis ||
        !String(aiAnalysis?.summary || "").trim() ||
        !String(aiAnalysis?.keyInsight || "").trim() ||
        !String(aiAnalysis?.recommendation || "").trim()
      ) {
        throw new Error("Invalid AI response format");
      }
      if (!hasValidAIAnalytics(aiAnalysis)) {
        throw new Error("Invalid AI response format");
      }
      delete aiAnalysis.strongTopics;
      delete aiAnalysis.weakTopics;
      analysis = normalizeAnalyticsResponse(
        {
          ...aiAnalysis,
          source: "ai"
        },
        promptData,
        "ai"
      );
      const supplementaryContent = await enrichAnalyticsWithSupplementaryAI({
        userId: resolvedUserId,
        promptData,
        analysis,
        strongTopics: computedTopics.strongTopics,
        weakTopics: computedTopics.weakTopics,
        hasGroq
      });
      analysis.recommendations = supplementaryContent.recommendations;
      analysis.studyPlan = supplementaryContent.studyPlan;
      analysis.strongTopics = computedTopics.strongTopics;
      analysis.weakTopics = computedTopics.weakTopics;
      envelope = buildAnalyticsEnvelope(true, "ai", analysis);
    } catch (error) {
      if (
        Number(error?.status) === 429 ||
        Number(error?.statusCode) === 429 ||
        Number(error?.response?.status) === 429
      ) {
      }
      analysis = ruleBasedAnalysis(promptData, "ai");
      const supplementaryContent = await enrichAnalyticsWithSupplementaryAI({
        userId: resolvedUserId,
        promptData,
        analysis,
        strongTopics: computedTopics.strongTopics,
        weakTopics: computedTopics.weakTopics,
        hasGroq: false
      });
      analysis.recommendations = supplementaryContent.recommendations;
      analysis.studyPlan = supplementaryContent.studyPlan;
      analysis.strongTopics = computedTopics.strongTopics;
      analysis.weakTopics = computedTopics.weakTopics;
      envelope = buildAnalyticsEnvelope(false, "ai", analysis);
    }
  }

  const generatedAt = new Date();
  profile.aiAnalyticsCache = sanitizeStoredAnalyticsCache({
    ...analysis,
    promptData,
    signature,
    generatedAt
  });
  profile.aiAnalyticsLastUpdated = generatedAt;
  await profile.save();

  return {
    ...envelope,
    strongTopics: computedTopics.strongTopics,
    weakTopics: computedTopics.weakTopics
  };
};

module.exports = {
  getAnalyticsAIForUser,
  ruleBasedAnalysis
};
