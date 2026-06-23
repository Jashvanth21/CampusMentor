const Student = require("../models/Student");
const { generateAttemptAnalysis, hasGroqCredentials } = require("./llmService");
const { loadStudentWithTestData, TestAttempt } = require("./studentTestDataService");
const { formatDuration } = require("../utils/timeFormat");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeAttemptType = (attempt) => {
  const subject = String(attempt?.subject || attempt?.testId?.subject || "").trim();
  if (subject === "Aptitude") return "Aptitude";
  if (subject === "Coding") return "Coding";
  if (subject === "DSA" || subject === "Technical") return "Technical";

  return String(attempt?.type || "").toUpperCase() === "CODING" ? "Coding" : "Technical";
};

const sanitizeList = (items, limit = 4) =>
  (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);

const hasTimeTakenValue = (value) => value !== null && value !== undefined && String(value).trim() !== "";

const buildAttemptPromptData = (attempt) => {
  const testType = normalizeAttemptType(attempt);
  const isCodingAttempt = testType === "Coding";
  const questionWiseResults = Array.isArray(attempt?.questionWiseResults) ? attempt.questionWiseResults : [];
  const detailedAnswers = Array.isArray(attempt?.detailedResult?.answers) ? attempt.detailedResult.answers : [];
  const questions = isCodingAttempt
    ? questionWiseResults.map((question, index) => ({
        index: index + 1,
        title: question?.questionTitle || `Question ${index + 1}`,
        topic: question?.topic || null,
        passedTestCases: Number(question?.passedTestCases) || 0,
        totalTestCases: Number(question?.totalTestCases) || 0,
        verdict: question?.verdict || "Wrong",
        marksObtained: Number(question?.marksObtained ?? question?.marks) || 0,
        maxMarks: Number(question?.maxMarks) || 0
      }))
    : questionWiseResults.map((question, index) => ({
        index: index + 1,
        title: question?.questionText || `Question ${index + 1}`,
        topic: question?.topic || null,
        userAnswer: question?.submittedAnswer ?? null,
        correctAnswer: question?.correctAnswer ?? null,
        isCorrect: Boolean(question?.isCorrect),
        marksObtained: Number(question?.marks) || 0,
        maxMarks: Number(question?.maxMarks) || 0
      }));

  const topicSummaryMap = new Map();
  questions.forEach((question, index) => {
    const topicLabel = getQuestionLabel(question, index);
    const existing = topicSummaryMap.get(topicLabel) || {
      topic: topicLabel,
      total: 0,
      correct: 0
    };
    existing.total += 1;
    if (getQuestionAccuracy(question, testType) >= 70) {
      existing.correct += 1;
    }
    topicSummaryMap.set(topicLabel, existing);
  });

  const topicWisePerformance = Array.from(topicSummaryMap.values()).map((topic) => ({
    topic: topic.topic,
    total: topic.total,
    correct: topic.correct,
    accuracy: topic.total > 0 ? Number(((topic.correct / topic.total) * 100).toFixed(1)) : 0
  }));

  const weakTopics = topicWisePerformance
    .filter((topic) => topic.accuracy < 50)
    .sort((left, right) => left.accuracy - right.accuracy)
    .map((topic) => topic.topic)
    .slice(0, 4);

  const strongTopics = topicWisePerformance
    .filter((topic) => topic.accuracy >= 70)
    .sort((left, right) => right.accuracy - left.accuracy)
    .map((topic) => topic.topic)
    .slice(0, 4);

  const attemptedQuestions = questions.length;
  const correctAnswers = questions.filter((question, index) => getQuestionAccuracy(question, testType) >= 70).length;
  const wrongAnswers = Math.max(0, attemptedQuestions - correctAnswers);
  const totalQuestions =
    attemptedQuestions ||
    (Array.isArray(detailedAnswers) ? detailedAnswers.length : 0);
  const timeTakenSeconds = Number(attempt?.timeTaken) || 0;
  const timeTakenMinutes = timeTakenSeconds > 0 ? Number((timeTakenSeconds / 60).toFixed(1)) : null;
  const formattedTimeTaken = timeTakenSeconds > 0 ? formatDuration(timeTakenSeconds) : null;
  const formattedTimePerQuestion =
    timeTakenSeconds > 0 && attemptedQuestions > 0
      ? formatDuration(timeTakenSeconds / attemptedQuestions)
      : null;

  return {
    testName: attempt?.testId?.title || "Assessment",
    testType,
    score: Number(attempt?.totalScore ?? attempt?.score) || 0,
    total: Number(attempt?.maxScore) || totalQuestions || 0,
    percentage: Number(attempt?.percentage ?? attempt?.score) || 0,
    passingPercentage: Number(attempt?.passingPercentage) || 50,
    status: attempt?.status || "Fail",
    attemptMode: attempt?.isFirstAttempt === false ? "Practice" : "Counted",
    attempted: attemptedQuestions,
    correct: correctAnswers,
    wrong: wrongAnswers,
    timeTaken: timeTakenMinutes,
    timeTakenSeconds: timeTakenSeconds > 0 ? timeTakenSeconds : null,
    formattedTimeTaken,
    formattedTimePerQuestion,
    topicsBreakdown: topicWisePerformance,
    weakTopics,
    strongTopics,
    questions
  };
};

const getQuestionAccuracy = (question, testType) => {
  if (testType === "Coding") {
    const total = Number(question?.totalTestCases) || 0;
    const passed = Number(question?.passedTestCases) || 0;
    return total > 0 ? (passed / total) * 100 : 0;
  }

  return question?.isCorrect ? 100 : 0;
};

const getQuestionLabel = (question, index) =>
  String(question?.topic || question?.title || `Question ${index + 1}`).trim() || `Question ${index + 1}`;

const uniqueList = (items, limit = 4) => [...new Set(items.filter(Boolean))].slice(0, limit);

const buildSummary = ({ percentage, passingPercentage, strengths, weaknesses, testType, timeTaken, formattedTimeTaken }) => {
  if (percentage >= Math.max(80, passingPercentage)) {
    return `You performed strongly in this ${testType.toLowerCase()} attempt with ${percentage}% and stayed above the target comfortably. The result suggests your core approach was accurate, and your stronger topics held up without major collapse under pressure${timeTaken > 0 && formattedTimeTaken ? ` during an attempt lasting ${formattedTimeTaken}` : ""}.`;
  }

  if (percentage >= passingPercentage) {
    return `You cleared this ${testType.toLowerCase()} attempt with ${percentage}%, but the score still shows uneven execution across topics. You likely understood enough to pass, yet a few recurring weak areas prevented a more confident and efficient finish.`;
  }

  if (strengths.length > 0 && weaknesses.length > 0) {
    return `This attempt finished below the target at ${percentage}%, but the result is not uniformly weak. You showed usable strength in some areas, while mistakes in a smaller set of weak topics and decision points pulled the overall score down.`;
  }

  return `This attempt needs improvement because both accuracy and solving discipline were inconsistent. The score suggests you need stronger fundamentals, clearer question interpretation, and a more controlled approach before taking harder sets again.`;
};

const ruleBasedAnalysis = (data, source = "rule-based") => {
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  const testType = String(data?.testType || "Test");
  const percentage = Number(data?.percentage) || 0;
  const passingPercentage = Number(data?.passingPercentage) || 50;
  const weakTopics = sanitizeList(data?.weakTopics, 4);
  const strongTopics = sanitizeList(data?.strongTopics, 4);
  const timeTaken =
    hasTimeTakenValue(data?.timeTaken) && Number.isFinite(Number(data?.timeTaken)) && Number(data?.timeTaken) > 0
      ? Number(data.timeTaken)
      : null;
  const formattedTimeTaken = String(data?.formattedTimeTaken || "").trim() || null;
  const attempted = Number(data?.attempted) || questions.length;
  const wrong = Number(data?.wrong) || Math.max(0, attempted - (Number(data?.correct) || 0));
  const timePerQuestion =
    attempted > 0 && timeTaken !== null ? Number((timeTaken / attempted).toFixed(1)) : null;
  const formattedTimePerQuestion =
    timePerQuestion !== null ? formatDuration(timePerQuestion * 60) : null;

  const normalizedStrengths = uniqueList(
    strongTopics.length > 0
      ? strongTopics.map((item) => `Strong in ${item} because your answers there were more accurate and showed better concept recognition than in the rest of the test.`)
      : ["You showed at least a few stable concepts where your accuracy stayed controlled under test conditions."]
  );
  const normalizedWeaknesses = uniqueList(
    weakTopics.length > 0
      ? weakTopics.map((item) => `Struggles in ${item} suggest either concept confusion or an incomplete solving process before finalizing answers.`)
      : ["Your weaker areas were less topic-specific and more related to inconsistent execution across the attempt."]
  );

  const mistakeAnalysis = uniqueList([
    wrong > 0 && weakTopics.length > 0
      ? `A meaningful share of mistakes came from ${weakTopics.slice(0, 2).join(" and ")}, which points to conceptual gaps rather than isolated slips.`
      : "",
    percentage < passingPercentage
      ? "The score pattern suggests accuracy dropped because the solving approach was not stable from question to question, not just because the paper was difficult."
      : "",
    testType === "Coding"
      ? "Coding mistakes likely came from incomplete edge-case checking, rushed debugging, or jumping into implementation before fully validating the logic."
      : "MCQ mistakes likely came from formula confusion, partial elimination, or selecting answers before fully verifying the logic.",
    timeTaken !== null && timePerQuestion < 1
      ? "Your pace looks very aggressive for the number of questions attempted, which may indicate rushed decisions or guessing under pressure."
      : timeTaken !== null && timePerQuestion > 3
        ? "You appear to have spent too long per question, which suggests hesitation, overthinking, or getting stuck on a few problems."
        : timeTaken !== null
          ? "Time distribution looks moderate, so the bigger issue is likely decision quality rather than pure speed."
          : ""
  ]);

  const timeAnalysis =
    timeTaken === null
      ? null
      : timePerQuestion < 1
        ? `You completed the test in ${formattedTimeTaken || `${timeTaken} minutes`} and used about ${formattedTimePerQuestion} per question, which is fast enough to risk shallow checking. This usually means speed came at the cost of verification, especially on weak topics.`
        : timePerQuestion > 3
          ? `You completed the test in ${formattedTimeTaken || `${timeTaken} minutes`} and used about ${formattedTimePerQuestion} per question, which suggests time was not used efficiently. The attempt likely lost marks because too much time was spent resolving confusion on a small set of questions.`
          : `You completed the test in ${formattedTimeTaken || `${timeTaken} minutes`} and used about ${formattedTimePerQuestion} per question, which is broadly reasonable. The main improvement area is not just speed, but making each decision more accurate before moving on.`;

  const improvementStrategy = uniqueList([
    weakTopics.length > 0 ? `Practice 15 questions on ${weakTopics[0]} this week and review every wrong answer to identify the exact reasoning gap.` : "",
    weakTopics.length > 1 ? `Add one separate drill of 10 questions on ${weakTopics[1]} under timed conditions to improve speed with accuracy.` : "",
    testType === "Coding"
      ? "Before submitting any coding solution, spend 5 minutes checking edge cases, constraints, and one dry run on a sample input."
      : "After every assessment, classify each wrong answer as concept error, calculation error, or rushed guess so the same pattern does not repeat.",
    strongTopics.length > 0 ? `Maintain confidence in ${strongTopics[0]} by solving 5 higher-difficulty questions there after each weak-topic practice block.` : ""
  ]);

  const nextTestFocus = uniqueList([
    weakTopics.length > 0 ? `Prioritize ${weakTopics.slice(0, 2).join(" and ")} before your next test because they are currently the biggest score blockers.` : "",
    percentage < passingPercentage
      ? "Aim for controlled accuracy first; do not chase speed until your first-pass answers become more reliable."
      : "Focus on converting medium-difficulty mistakes into correct answers so your next score moves from pass-level to strong performance.",
    timeTaken !== null ? "Use one timed practice set before the next test and compare whether your pace improves without increasing careless errors." : "",
    "Review the same mistake categories from this attempt before starting your next assessment so the weak pattern does not repeat."
  ]);

  return {
    source,
    summary: buildSummary({
      percentage,
      passingPercentage,
      strengths: strongTopics,
      weaknesses: weakTopics,
      testType,
      timeTaken,
      formattedTimeTaken
    }),
    strengths: normalizedStrengths,
    weaknesses: normalizedWeaknesses,
    mistakeAnalysis,
    timeAnalysis,
    improvementStrategy,
    nextTestFocus
  };
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceAttemptDurationText = (value, promptData) => {
  const formattedTimeTaken = String(promptData?.formattedTimeTaken || "").trim();
  const timeTaken = promptData?.timeTaken;
  if (!formattedTimeTaken || !hasTimeTakenValue(timeTaken)) {
    return value;
  }

  const numericTimeTaken = Number(timeTaken);
  if (!Number.isFinite(numericTimeTaken) || numericTimeTaken <= 0) {
    return value;
  }

  const timeToken = escapeRegExp(String(numericTimeTaken));
  const unitPattern = "(?:hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec)";
  const durationPattern = new RegExp(`\\b${timeToken}\\s*-?\\s*${unitPattern}\\b`, "gi");

  if (typeof value === "string") {
    return value.replace(durationPattern, formattedTimeTaken);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceAttemptDurationText(item, promptData));
  }

  return value;
};

const normalizeAnalysisPayload = (analysis, fallbackSource = "ai", promptData = null) => {
  const payload = {
    source: "ai",
    summary: replaceAttemptDurationText(String(analysis?.summary || "").trim(), promptData),
    strengths: sanitizeList(replaceAttemptDurationText(analysis?.strengths, promptData), 4),
    weaknesses: sanitizeList(replaceAttemptDurationText(analysis?.weaknesses, promptData), 4),
    mistakeAnalysis: sanitizeList(replaceAttemptDurationText(analysis?.mistakeAnalysis, promptData), 4),
    improvementStrategy: sanitizeList(replaceAttemptDurationText(analysis?.improvementStrategy, promptData), 4),
    nextTestFocus: sanitizeList(replaceAttemptDurationText(analysis?.nextTestFocus, promptData), 4),
    generatedAt: analysis?.generatedAt || null
  };

  const timeAnalysis = replaceAttemptDurationText(String(analysis?.timeAnalysis || "").trim(), promptData);
  if (timeAnalysis) {
    payload.timeAnalysis = timeAnalysis;
  }

  if (!payload.nextTestFocus || payload.nextTestFocus.length === 0) {
    payload.nextTestFocus = [
      "Focus on weak topics",
      "Practice similar problems",
      "Improve accuracy and speed"
    ];
  }

  if (!payload.timeAnalysis) {
    delete payload.timeAnalysis;
  }

  if (!payload.nextTestFocus || payload.nextTestFocus.length === 0) {
    delete payload.nextTestFocus;
  }

  return payload;
};

const ANALYSIS_SCOPE = "attempt-category-v1";

const oneItemList = (value) => {
  const text = String(value || "").trim();
  return text ? [text] : [];
};

const failedCaseInsights = (promptData) => {
  const failedQuestions = (Array.isArray(promptData?.questions) ? promptData.questions : [])
    .filter((question) => Number(question?.totalTestCases) > 0 && Number(question?.passedTestCases) < Number(question?.totalTestCases))
    .slice(0, 3);

  return failedQuestions.map((question) => {
    const passed = Number(question?.passedTestCases) || 0;
    const total = Number(question?.totalTestCases) || 0;
    return `${question.title || "A coding problem"} passed ${passed}/${total} test cases, so the main review should focus on missed edge cases, incomplete branching, or constraint handling in that solution.`;
  });
};

const buildCategoryCards = (analysis, promptData) => {
  const category = String(promptData?.testType || "Technical");
  const weaknesses = sanitizeList(analysis?.weaknesses, 4);
  const mistakes = sanitizeList(analysis?.mistakeAnalysis, 4);
  const strengths = sanitizeList(analysis?.strengths, 4);
  const recommendations = uniqueList([
    ...sanitizeList(analysis?.improvementStrategy, 4),
    ...sanitizeList(analysis?.nextTestFocus, 4)
  ], 5);

  const byCategory = {
    Technical: [
      { title: "Technical Weak Concepts", items: weaknesses },
      { title: "Technical Mistake Patterns", items: mistakes },
      { title: "Technical Insights", items: strengths },
      { title: "Technical Recommendations", items: recommendations }
    ],
    Aptitude: [
      { title: "Aptitude Weak Areas", items: weaknesses },
      { title: "Aptitude Logical Mistakes", items: mistakes },
      { title: "Quantitative/Verbal Reasoning Insights", items: strengths },
      { title: "Aptitude Recommendations", items: recommendations }
    ],
    Coding: [
      { title: "Coding Quality Insights", items: strengths },
      { title: "Time Complexity Analysis", items: oneItemList(analysis?.timeAnalysis) },
      { title: "Problem-Solving Analysis", items: mistakes },
      { title: "Code Optimization Suggestions", items: recommendations },
      { title: "Failed Test Case Analysis", items: failedCaseInsights(promptData) },
      { title: "Programming Mistakes", items: weaknesses }
    ]
  };

  return (byCategory[category] || byCategory.Technical)
    .map((card) => ({
      ...card,
      items: sanitizeList(card.items, 5)
    }))
    .filter((card) => card.items.length > 0);
};

const buildCategoryAnalysisPayload = (analysis, promptData, fallbackSource = "ai") => {
  const normalized = normalizeAnalysisPayload(analysis, fallbackSource, promptData);
  const category = String(promptData?.testType || "Technical");

  return {
    ...normalized,
    analysisScope: ANALYSIS_SCOPE,
    category,
    testType: category,
    performanceSummary: normalized.summary,
    cards: buildCategoryCards(normalized, promptData)
  };
};

const getAttemptAnalysis = async (userId, attemptId) => {
  const safeAttemptId = String(attemptId || "").trim();
  if (!safeAttemptId) {
    throw createError("Attempt id is required.", 400);
  }

  const studentProfile = await loadStudentWithTestData(
    { userId },
    {
      select: "userId",
      attemptPopulate: "title subject questions"
    }
  );

  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const attempts = Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : [];
  const matchedAttempt = attempts.find((attempt) => String(attempt?.attemptId) === safeAttemptId);

  if (!matchedAttempt) {
    throw createError("Attempt not found.", 404);
  }

  const hasGroq = hasGroqCredentials();
  const promptData = buildAttemptPromptData(matchedAttempt);

  const cachedSource = String(matchedAttempt?.aiAnalysis?.source || "").trim();
  const canReuseCachedAnalysis =
    Boolean(matchedAttempt?.aiAnalysis?.summary) &&
    matchedAttempt?.aiAnalysis?.analysisScope === ANALYSIS_SCOPE &&
    matchedAttempt?.aiAnalysis?.category === promptData.testType &&
    (!hasGroq || cachedSource === "groq" || cachedSource === "ai");

  if (canReuseCachedAnalysis) {
    return {
      success: true,
      cached: true,
      analysis: buildCategoryAnalysisPayload(
        matchedAttempt.aiAnalysis,
        promptData,
        "ai"
      )
    };
  }

  let analysis;

  if (!hasGroq) {
    analysis = buildCategoryAnalysisPayload(ruleBasedAnalysis(promptData, "ai"), promptData, "ai");
  } else {
    try {
      const aiAnalysis = await generateAttemptAnalysis(promptData);
      analysis = buildCategoryAnalysisPayload({
        source: "ai",
        ...aiAnalysis
      }, promptData, "ai");
    } catch (error) {
      analysis = buildCategoryAnalysisPayload(ruleBasedAnalysis(promptData, "ai"), promptData, "ai");
    }
  }

  if (!analysis) {
    analysis = buildCategoryAnalysisPayload(ruleBasedAnalysis(promptData, "ai"), promptData, "ai");
  }

  const aiAnalysis = {
    ...analysis,
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    generatedAt: new Date(),
    promptData
  };
  await TestAttempt.updateOne({ _id: matchedAttempt._id }, { $set: { aiAnalysis } });

  return {
    success: true,
    cached: false,
    analysis: aiAnalysis
  };
};

module.exports = {
  getAttemptAnalysis,
  ruleBasedAnalysis
};
