const CareerRoadmap = require("../models/CareerRoadmap");
const Student = require("../models/Student");
const User = require("../models/User");
const { getStudentAnalytics, getStudentTopicAnalytics, ensureStudentRole, getAnalyticsAttempts } = require("./studentService");
const { generateCareerRoadmap, hasGroqCredentials } = require("./llmService");
const { loadStudentWithTestData } = require("./studentTestDataService");

const CAREER_PATHS = [
  "Software Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "AI/ML Engineer"
];

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) => String(value || "").trim();

const hasUsableAnalyticsCache = (cache) =>
  Boolean(cache) &&
  typeof cache === "object" &&
  Boolean(normalizeText(cache?.summary)) &&
  (cache?.sectionScores || cache?.sections);

const normalizeLanguageName = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("java") && !raw.includes("javascript")) return "Java";
  if (raw.includes("javascript")) return "JavaScript";
  if (raw.includes("python")) return "Python";
  if (raw.includes("cpp") || raw.includes("c++")) return "C++";
  if (raw === "c") return "C";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const deriveMostUsedLanguage = (attempts) => {
  const counts = new Map();

  attempts.forEach((attempt) => {
    if (String(attempt?.type || "").toUpperCase() !== "CODING") {
      return;
    }

    const questions = Array.isArray(attempt?.questionWiseResults) ? attempt.questionWiseResults : [];
    questions.forEach((question) => {
      const language = normalizeLanguageName(question?.languageLabel || question?.language || question?.programmingLanguage);
      if (!language) {
        return;
      }

      counts.set(language, (counts.get(language) || 0) + 1);
    });
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
};

const buildRoadmapContext = async (userId, options = {}) => {
  const [user, studentProfile, analytics, topicAnalytics] = await Promise.all([
    User.findById(userId).select("careerPath role"),
    loadStudentWithTestData(
      { userId },
      {
        select: "userId cgpa skills aiAnalyticsCache"
      }
    ),
    getStudentAnalytics(userId),
    getStudentTopicAnalytics(userId)
  ]);

  if (!user) {
    throw createError("User account not found.", 404);
  }

  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const attempts = getAnalyticsAttempts(Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : []);

  const requestedCareerPath = String(options?.careerPath || "").trim();
  return {
    careerPath: requestedCareerPath || user.careerPath || null,
    overallAverage: toNumber(analytics?.overallAverage),
    cgpa: toNumber(studentProfile?.cgpa),
    skills: Array.isArray(studentProfile?.skills) ? studentProfile.skills : [],
    aiAnalyticsCache: studentProfile?.aiAnalyticsCache || null,
    coding: toNumber(analytics?.codingAverage),
    aptitude: toNumber(
      (Array.isArray(analytics?.subjectBreakdown) ? analytics.subjectBreakdown : []).find((item) => item?.subject === "Aptitude")
        ?.averageScore
    ),
    technical: toNumber(
      (Array.isArray(analytics?.subjectBreakdown) ? analytics.subjectBreakdown : []).find((item) => item?.subject === "Technical")
        ?.averageScore
    ),
    totalTests: toNumber(analytics?.totalTests),
    strongTopics: Array.isArray(topicAnalytics?.strongTopics) ? topicAnalytics.strongTopics : [],
    weakTopics: Array.isArray(topicAnalytics?.weakTopics) ? topicAnalytics.weakTopics : [],
    mostUsedLanguage: deriveMostUsedLanguage(attempts),
    dataSufficient: topicAnalytics?.dataSufficient !== false
  };
};

const buildRoadmapAIInput = (context, previousRoadmap = null) => {
  const analyticsCache = context?.aiAnalyticsCache;

  if (hasUsableAnalyticsCache(analyticsCache)) {
    return {
      careerPath: context?.careerPath,
      summary: normalizeText(analyticsCache?.summary),
      sectionScores: analyticsCache?.sections || analyticsCache?.sectionScores || {},
      recommendations: Array.isArray(analyticsCache?.recommendations) ? analyticsCache.recommendations : [],
      studyPlan: Array.isArray(analyticsCache?.studyPlan) ? analyticsCache.studyPlan : [],
      cgpa: toNumber(context?.cgpa),
      skills: Array.isArray(context?.skills) ? context.skills : [],
      totalTests: toNumber(analyticsCache?.signature?.attemptCount) || toNumber(context?.totalTests),
      mostUsedLanguage: context?.mostUsedLanguage || "",
      previousRoadmap
    };
  }

  return {
    ...context,
    previousRoadmap
  };
};

const normalizeList = (items, fallbackItems = [], limit = 6) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);

  return normalized.length > 0 ? normalized : fallbackItems.slice(0, limit);
};

const normalizePhase = (phase, fallbackPhase = {}) => ({
  phase: String(phase?.phase || phase?.phaseTitle || fallbackPhase?.phase || fallbackPhase?.phaseTitle || "").trim(),
  focus: String(phase?.focus || phase?.goal || fallbackPhase?.focus || fallbackPhase?.goal || "").trim(),
  topics: normalizeList(phase?.topics || phase?.focusAreas, fallbackPhase?.topics || fallbackPhase?.focusAreas || [], 3),
  tasks: normalizeList(phase?.tasks, fallbackPhase?.tasks || [], 3)
});

const getCareerTools = (careerPath, language) => {
  const preferredLanguage = language || "your preferred language";

  switch (careerPath) {
    case "Backend Developer":
      return [`${preferredLanguage} backend development`, "REST APIs", "database design", "authentication"];
    case "Full Stack Developer":
      return ["React", "Node.js", "API integration", "state management"];
    case "Data Scientist":
      return ["Python", "pandas", "SQL", "machine learning basics"];
    case "AI/ML Engineer":
      return ["Python", "ML algorithms", "model evaluation", "deep learning basics"];
    default:
      return [preferredLanguage, "DSA", "core CS subjects", "project implementation"];
  }
};

const createWhyThisCareerFits = (careerPath, context) => {
  const strongLine = context.strongTopics.length ? context.strongTopics.slice(0, 2).join(", ") : "your current strengths";
  const weakLine = context.weakTopics.length ? context.weakTopics.slice(0, 2).join(", ") : "core fundamentals";
  const languageLine = context.mostUsedLanguage ? ` Your preferred language trend in ${context.mostUsedLanguage} supports this direction.` : "";
  return `${careerPath} is a sensible target because the roadmap can build on ${strongLine} while correcting ${weakLine}. Coding ${context.coding.toFixed(1)}%, aptitude ${context.aptitude.toFixed(1)}%, technical ${context.technical.toFixed(1)}%, and CGPA ${context.cgpa.toFixed(1)} shape the difficulty and focus.${languageLine}`;
};

const createOverallAnalysis = (context) => {
  const strengths = context.strongTopics.length ? context.strongTopics.slice(0, 2).join(", ") : "steady core performance";
  const weaknesses = context.weakTopics.length ? context.weakTopics.slice(0, 2).join(", ") : "a few fundamentals that still need reinforcement";
  return `You are showing promising ability in ${strengths}, but ${weaknesses} still need deliberate revision. Your current coding, aptitude, technical scores, and CGPA suggest you can handle a structured roadmap that starts with correction and then moves into role-focused preparation.`;
};

const createImprovementAdvice = (context) => {
  const advice = [];

  if (context.weakTopics.length > 0) {
    advice.push(`Spend your first revision block each week on ${context.weakTopics.slice(0, 2).join(" and ")} before moving to mixed practice.`);
  }
  if (context.coding < context.aptitude) {
    advice.push("Add two timed coding sessions every week so implementation skill catches up with your aptitude strength.");
  }
  if (context.technical < 60) {
    advice.push("Reserve one focused session for DBMS, OS, OOPs, or networks revision with short notes and topic-wise MCQs.");
  }
  if (advice.length < 3 && context.skills.length > 0) {
    advice.push(`Use your profile skills in ${context.skills.slice(0, 2).join(" and ")} to build one measurable mini-project milestone each week.`);
  }
  if (advice.length < 3) {
    advice.push("Track mistakes after every mock test and convert them into a short revision checklist before the next attempt.");
  }

  return advice.slice(0, 3);
};

const getTaskVariants = (careerPath, context) => {
  const weakTopics = context.weakTopics.slice(0, 3);
  const strongTopics = context.strongTopics.slice(0, 2);
  const primaryLanguage = context.mostUsedLanguage || (careerPath.includes("Data") || careerPath.includes("AI") ? "Python" : "JavaScript");

  const genericCodingLow = context.coding < 50
    ? [
        "Solve 20 easy and 10 medium problems focused on weak logic patterns.",
        "Do 3 timed debugging sessions on previously failed coding questions."
      ]
    : [];
  const aptitudeLow = context.aptitude < 50
    ? [
        "Complete 5 daily sets on percentages, ratios, and logical reasoning under time limits.",
        "Track shortcut mistakes in a one-page aptitude notebook."
      ]
    : [];
  const technicalLow = context.technical < 50
    ? [
        "Revise DBMS, OS, CN, and OOPs with 25 targeted MCQs after each topic.",
        "Create short-answer notes for frequently asked technical interview questions."
      ]
    : [];
  const cgpaLow = context.cgpa > 0 && context.cgpa < 7
    ? ["Allocate two extra revision blocks each week for fundamentals and academic core subjects."]
    : [];
  const advancedCoding = context.coding >= 70
    ? [
        "Solve 12 advanced medium-to-hard DSA problems with written tradeoff analysis.",
        "Discuss one system design or scalability scenario each week."
      ]
    : [];

  switch (careerPath) {
    case "Backend Developer":
      return {
        foundation: [
          `Rebuild backend fundamentals in ${primaryLanguage} by implementing request handlers, async flows, and validation.`,
          `Revise weak topics: ${weakTopics.join(", ") || "arrays, strings, and fundamentals"}.`,
          "Implement 3 API endpoints with input validation and proper status codes.",
          ...genericCodingLow,
          ...aptitudeLow,
          ...cgpaLow
        ],
        improvement: [
          "Design MongoDB schemas for users, sessions, and activity records with relationships.",
          "Build CRUD APIs with controllers, services, and error handling separation.",
          "Write Postman or Thunder Client collections to verify API behavior.",
          ...technicalLow
        ],
        advanced: [
          "Implement authentication, authorization, refresh-token flow, and password hashing.",
          "Add caching, logging, and rate-limiting to a mini backend service.",
          `Use strong topics like ${strongTopics.join(", ") || "problem solving"} for deeper backend optimization tasks.`,
          ...advancedCoding
        ],
        placement: [
          "Take 2 backend-focused mocks and document recurring error patterns.",
          "Prepare concise answers on REST design, indexing, transactions, and authentication tradeoffs.",
          "Record a 5-minute explanation of your backend project architecture."
        ]
      };
    case "Full Stack Developer":
      return {
        foundation: [
          "Rebuild React and JavaScript basics through component composition, props, and state updates.",
          `Revise weak topics: ${weakTopics.join(", ") || "frontend basics and DSA fundamentals"}.`,
          "Create a responsive UI with forms, validation states, and clean layout structure.",
          ...genericCodingLow,
          ...aptitudeLow,
          ...cgpaLow
        ],
        improvement: [
          "Connect React screens to Node/Express APIs with loading, error, and empty states.",
          "Implement MongoDB-backed CRUD for one complete workflow.",
          "Practice debugging state flow, API failures, and authentication edge cases.",
          ...technicalLow
        ],
        advanced: [
          "Build protected routes, token persistence, and role-based UI rendering.",
          "Refactor one feature for cleaner data flow and reusable components.",
          `Push strong topics like ${strongTopics.join(", ") || "problem solving"} into more complex integration tasks.`,
          ...advancedCoding
        ],
        placement: [
          "Take 2 full-stack mock rounds with coding plus technical discussion.",
          "Deploy or production-polish one mini project and prepare a project walkthrough.",
          "Prepare interview answers on rendering flow, API lifecycle, and database integration."
        ]
      };
    case "Data Scientist":
      return {
        foundation: [
          "Refresh Python syntax, data structures, and notebook workflow using small analytical exercises.",
          `Revise weak topics: ${weakTopics.join(", ") || "statistics and core Python"}.`,
          "Complete 4 short tasks on descriptive statistics, visualization reading, and data cleaning.",
          ...genericCodingLow,
          ...aptitudeLow,
          ...cgpaLow
        ],
        improvement: [
          "Use pandas and NumPy to clean, transform, and summarize one real dataset.",
          "Write 20 SQL queries covering joins, grouping, filtering, and case-based analysis.",
          "Create an exploratory data analysis report with visual insights and observations.",
          ...technicalLow
        ],
        advanced: [
          "Train baseline ML models, compare metrics, and explain why one performs better.",
          "Work on feature selection, cross-validation, and error analysis on the dataset.",
          `Upgrade strong topics like ${strongTopics.join(", ") || "analysis and coding"} with harder case-based exercises.`,
          ...advancedCoding
        ],
        placement: [
          "Take 2 analytics-heavy mocks with timed aptitude and interpretation sections.",
          "Prepare explanations for bias-variance, preprocessing, metrics, and model selection.",
          "Present one mini data project with business question, method, and findings."
        ]
      };
    case "AI/ML Engineer":
      return {
        foundation: [
          "Refresh Python, linear algebra, probability, and DSA basics through short daily drills.",
          `Revise weak topics: ${weakTopics.join(", ") || "math foundations and coding fundamentals"}.`,
          "Implement 2 core algorithms from scratch to reinforce logic and ML intuition.",
          ...genericCodingLow,
          ...aptitudeLow,
          ...cgpaLow
        ],
        improvement: [
          "Build preprocessing pipelines and compare classic ML models on one dataset.",
          "Track precision, recall, F1-score, and confusion-matrix interpretation clearly.",
          "Document feature engineering decisions and failure cases in a short experiment log.",
          ...technicalLow
        ],
        advanced: [
          "Study neural network training flow and implement one small deep learning experiment.",
          "Optimize an ML pipeline and explain tradeoffs in speed, accuracy, and overfitting control.",
          `Upgrade strong topics like ${strongTopics.join(", ") || "Python and problem solving"} with advanced applied tasks.`,
          ...advancedCoding
        ],
        placement: [
          "Take 2 mixed coding-plus-ML mock rounds.",
          "Prepare interview answers on model evaluation, preprocessing, tuning, and deployment basics.",
          "Present one AI mini-project with architecture choice, metrics, and limitations."
        ]
      };
    default:
      return {
        foundation: [
          `Rebuild coding fundamentals in ${primaryLanguage} and revise weak topics: ${weakTopics.join(", ") || "DSA basics"}.`,
          "Solve 30 structured problems on arrays, strings, hashing, and recursion with written takeaways.",
          "Review core aptitude building blocks and formula recall.",
          ...genericCodingLow,
          ...aptitudeLow,
          ...cgpaLow
        ],
        improvement: [
          "Revise DBMS, OS, CN, and OOPs using topic-wise notes plus MCQ checks.",
          "Implement one project feature with cleaner code structure and edge-case handling.",
          "Practice medium-level DSA sets on linked lists, stacks, queues, and trees.",
          ...technicalLow
        ],
        advanced: [
          "Solve timed medium-to-hard DSA sets and write short complexity explanations.",
          "Study system design basics through API, database, and scalability scenarios.",
          `Use strong topics like ${strongTopics.join(", ") || "logic building"} for tougher interview-style tasks.`,
          ...advancedCoding
        ],
        placement: [
          "Take 2 full mock rounds covering coding, aptitude, and technical sections.",
          "Prepare STAR stories for projects, mistakes fixed, and team contributions.",
          "Revise the top 50 interview questions from your weak and moderate areas."
        ]
      };
  }
};

const createPhaseRoadmap = (careerPath, context) => {
  const tools = getCareerTools(careerPath, context.mostUsedLanguage);
  const variants = getTaskVariants(careerPath, context);

  return [
    {
      phase: "Phase 1: Foundation & Weak Areas",
      focus: "Fix weak topics",
      topics: normalizeList([...context.weakTopics.slice(0, 2), ...tools.slice(0, 1)], ["Core fundamentals"], 3),
      tasks: normalizeList(variants.foundation, [], 3)
    },
    {
      phase: "Phase 2: Skill Building",
      focus: "Build core skills",
      topics: normalizeList([...tools.slice(0, 2), ...context.skills.slice(0, 1)], ["Role-aligned practice"], 3),
      tasks: normalizeList(variants.improvement, [], 3)
    },
    {
      phase: "Phase 3: Advanced Practice",
      focus: "Strengthen strong areas",
      topics: normalizeList([...context.strongTopics.slice(0, 2), ...tools.slice(0, 1)], ["Advanced practice"], 3),
      tasks: normalizeList(variants.advanced, [], 3)
    },
    {
      phase: "Phase 4: Placement Preparation",
      focus: "Interview readiness",
      topics: normalizeList(["Mock tests", "Interview prep", careerPath], [], 3),
      tasks: normalizeList(variants.placement, [], 3)
    }
  ];
};

const buildRuleBasedRoadmap = (careerPath, context, previousRoadmap = null, source = "fallback") => ({
  source,
  careerPath,
  whyThisCareerFits: createWhyThisCareerFits(careerPath, context),
  improvementAdvice: createImprovementAdvice(context),
  overallAnalysis: createOverallAnalysis(context),
  phases: createPhaseRoadmap(careerPath, context),
  note:
    source === "fallback"
      ? "AI roadmap was unavailable, so the built-in roadmap engine was used as fallback."
      : "Generated from your current performance profile using the built-in roadmap engine."
});

const normalizePhases = (phases, fallbackPhases) => {
  const safePhases = Array.isArray(phases) ? phases : [];
  const safeFallback = Array.isArray(fallbackPhases) ? fallbackPhases : [];
  const maxLength = Math.max(safePhases.length, safeFallback.length, 4);
  const output = [];

  for (let index = 0; index < maxLength; index += 1) {
    const normalized = normalizePhase(safePhases[index], safeFallback[index]);
    if (normalized.phase || normalized.focus || normalized.topics.length > 0 || normalized.tasks.length > 0) {
      output.push(normalized);
    }
  }

  return output.slice(0, 4);
};

const normalizeAIRoadmap = (careerPath, aiRoadmap, source = "AI") => ({
  source,
  careerPath,
  whyThisCareerFits: String(aiRoadmap?.whyThisCareerFits || aiRoadmap?.summary || "").trim(),
  improvementAdvice: normalizeList(aiRoadmap?.improvementAdvice, [], 3),
  overallAnalysis: String(aiRoadmap?.overallAnalysis || "").trim(),
  phases: normalizePhases(aiRoadmap?.phases, []),
  note: String(aiRoadmap?.note || "Generated using Groq AI based on your latest performance profile.").trim()
});

const saveCareerPath = async (requestUserId, payload) => {
  await ensureStudentRole(requestUserId);

  const safeCareerPath = String(payload?.careerPath || "").trim();
  if (!CAREER_PATHS.includes(safeCareerPath)) {
    throw createError("Invalid career path selected.", 400);
  }

  const user = await User.findById(requestUserId);
  if (!user) {
    throw createError("User account not found.", 404);
  }

  const previousCareerPath = user.careerPath || null;
  user.careerPath = safeCareerPath;
  await user.save();

  if (previousCareerPath !== safeCareerPath) {
    await CareerRoadmap.deleteOne({ userId: requestUserId });
  }

  return {
    success: true,
    careerPath: safeCareerPath,
    message: "Career path saved successfully."
  };
};

const getCareerRoadmap = async (userId, options = {}) => {
  await ensureStudentRole(userId);

  const context = await buildRoadmapContext(userId, options);
  if (!context.careerPath) {
    throw createError("Career path is not selected yet.", 400);
  }

  const existingRoadmap = await CareerRoadmap.findOne({ userId });

  const previousRoadmap = existingRoadmap
    ? {
        careerPath: existingRoadmap.careerPath,
        whyThisCareerFits: String(existingRoadmap.roadmap?.whyThisCareerFits || "").trim(),
        overallAnalysis: String(existingRoadmap.overallAnalysis || "").trim(),
        phases: normalizePhases(existingRoadmap.phases, [])
      }
    : null;

  let generatedRoadmap = null;
  let aiFailure = null;

  if (hasGroqCredentials()) {
    try {
      const aiRoadmap = await generateCareerRoadmap(buildRoadmapAIInput(context, previousRoadmap));

      if (
        aiRoadmap &&
        aiRoadmap.valid &&
        aiRoadmap.roadmap &&
        Array.isArray(aiRoadmap.roadmap.phases) &&
        aiRoadmap.roadmap.phases.length > 0
      ) {
        generatedRoadmap = normalizeAIRoadmap(context.careerPath, aiRoadmap.roadmap, "AI");
      } else {
        aiFailure = new Error("AI roadmap response was invalid.");
      }
    } catch (error) {
      aiFailure = error;
    }
  } else {
    aiFailure = new Error("Groq credentials missing.");
  }

  if (!generatedRoadmap) {
    generatedRoadmap = buildRuleBasedRoadmap(context.careerPath, context, previousRoadmap, "fallback");
    if (aiFailure) {
      generatedRoadmap.note = "Groq roadmap generation failed, so the built-in roadmap engine was used instead.";
    }
  }

  const savedRoadmap = await CareerRoadmap.findOneAndUpdate(
    { userId },
    {
      userId,
      studentId: userId,
      careerPath: context.careerPath,
      source: generatedRoadmap.source,
      roadmap: {
        careerPath: generatedRoadmap.careerPath || context.careerPath,
        whyThisCareerFits: generatedRoadmap.whyThisCareerFits || "",
        improvementAdvice: generatedRoadmap.improvementAdvice || [],
        overallAnalysis: generatedRoadmap.overallAnalysis || "",
        phases: generatedRoadmap.phases || [],
        note: generatedRoadmap.note || ""
      },
      whyThisCareerFits: generatedRoadmap.whyThisCareerFits || "",
      improvementAdvice: generatedRoadmap.improvementAdvice || [],
      overallAnalysis: generatedRoadmap.overallAnalysis || "",
      phases: generatedRoadmap.phases || [],
      note: generatedRoadmap.note || ""
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return {
    success: true,
    source: savedRoadmap.source,
    careerPath: savedRoadmap.careerPath,
    whyThisCareerFits: String(generatedRoadmap.whyThisCareerFits || savedRoadmap.whyThisCareerFits || savedRoadmap.roadmap?.whyThisCareerFits || "").trim(),
    improvementAdvice: normalizeList(
      generatedRoadmap.improvementAdvice || savedRoadmap.improvementAdvice || savedRoadmap.roadmap?.improvementAdvice,
      [],
      3
    ),
    overallAnalysis: String(savedRoadmap.overallAnalysis || "").trim(),
    phases: normalizePhases(savedRoadmap.phases, []),
    note: savedRoadmap.note || "",
    generatedAt: savedRoadmap.updatedAt || savedRoadmap.createdAt
  };
};

module.exports = {
  CAREER_PATHS,
  saveCareerPath,
  getCareerRoadmap
};
