const Student = require("../models/Student");
const User = require("../models/User");
const { getStudentAnalytics, getStudentTopicAnalytics, ensureStudentRole, getAnalyticsAttempts } = require("./studentService");
const { generateCareerRecommendationsAI, hasGroqCredentials } = require("./llmService");
const { loadStudentWithTestData } = require("./studentTestDataService");

const CAREER_PATH_OPTIONS = [
  "Software Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "AI/ML Engineer"
];

const REQUIRED_TOPICS_BY_CAREER = {
  "Software Developer": ["DSA", "OS", "DBMS", "CN", "OOP"],
  "Backend Developer": ["APIs", "DBMS", "OOP", "OS", "SQL"],
  "Full Stack Developer": ["JavaScript", "React", "Node.js", "APIs", "DBMS"],
  "Data Scientist": ["Python", "Statistics", "SQL", "Machine Learning", "Data Analysis"],
  "AI/ML Engineer": ["Python", "Machine Learning", "Deep Learning", "Linear Algebra", "Probability"]
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) => String(value || "").trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const hasUsableAnalyticsCache = (cache) =>
  Boolean(cache) &&
  typeof cache === "object" &&
  Boolean(normalizeText(cache?.summary)) &&
  Boolean(cache?.sectionScores || cache?.sections);

const uniqueTextList = (items, limit = 10) => {
  const seen = new Set();
  const output = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const label = normalizeText(item);
    const key = normalizeKey(label);
    if (!label || seen.has(key)) {
      return;
    }

    seen.add(key);
    output.push(label);
  });

  return output.slice(0, limit);
};

const getSubjectAverage = (analytics, subjectName) => {
  const breakdown = Array.isArray(analytics?.subjectBreakdown) ? analytics.subjectBreakdown : [];
  const subjectEntry = breakdown.find((item) => String(item?.subject || "") === subjectName);
  if (subjectEntry) {
    return toNumber(subjectEntry.averageScore);
  }

  const fallback = Array.isArray(analytics?.subjectPerformance) ? analytics.subjectPerformance : [];
  const fallbackEntry = fallback.find((item) => String(item?.subject || "") === subjectName);
  return toNumber(fallbackEntry?.averageScore);
};

const normalizeLanguageName = (value) => {
  const raw = normalizeKey(value);
  if (!raw) return "";
  if (raw.includes("java") && !raw.includes("javascript")) return "Java";
  if (raw.includes("javascript")) return "JavaScript";
  if (raw.includes("python")) return "Python";
  if (raw.includes("cpp") || raw.includes("c++")) return "C++";
  if (raw === "c") return "C";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const buildCareerAIInput = ({ analyticsCache, fallbackContext, cgpa, skills, totalAttempts }) => {
  if (hasUsableAnalyticsCache(analyticsCache)) {
    return {
      overallAverage:
        toNumber(analyticsCache?.sectionScores?.overall) || toNumber(fallbackContext?.overallAverage),
      codingScore:
        toNumber(analyticsCache?.sectionScores?.coding ?? analyticsCache?.sections?.coding?.score),
      aptitudeScore:
        toNumber(analyticsCache?.sectionScores?.aptitude ?? analyticsCache?.sections?.aptitude?.score),
      technicalScore:
        toNumber(analyticsCache?.sectionScores?.technical ?? analyticsCache?.sections?.technical?.score),
      summary: normalizeText(analyticsCache?.summary),
      recommendations: Array.isArray(analyticsCache?.recommendations) ? analyticsCache.recommendations : [],
      studyPlan: Array.isArray(analyticsCache?.studyPlan) ? analyticsCache.studyPlan : [],
      cgpa: toNumber(cgpa),
      skills: Array.isArray(skills) ? skills : [],
      totalAttempts: toNumber(analyticsCache?.signature?.attemptCount) || toNumber(totalAttempts)
    };
  }

  return {
    overallAverage: fallbackContext?.overallAverage,
    codingScore: fallbackContext?.codingAverage,
    aptitudeScore: fallbackContext?.aptitudeAverage,
    technicalScore: fallbackContext?.technicalAverage,
    cgpa: toNumber(cgpa),
    strongTopics: fallbackContext?.strongTopics,
    weakTopics: fallbackContext?.weakTopics,
    totalAttempts: toNumber(totalAttempts)
  };
};

const topicAliases = {
  dsa: ["dsa", "data structures", "data structures and algorithms", "arrays", "strings", "linked list", "trees", "graphs", "hashing", "recursion", "dynamic programming"],
  os: ["os", "operating systems", "operating system"],
  dbms: ["dbms", "database", "databases", "sql", "schema design"],
  cn: ["cn", "computer networks", "networking", "networks"],
  oop: ["oop", "oops", "object oriented programming", "object-oriented programming"],
  apis: ["api", "apis", "rest", "rest api", "rest apis", "http methods"],
  javascript: ["javascript", "js"],
  react: ["react", "reactjs", "react.js", "frontend"],
  "node.js": ["node", "node.js", "express"],
  python: ["python"],
  statistics: ["statistics", "probability"],
  sql: ["sql", "dbms", "database"],
  "machine learning": ["machine learning", "ml", "model evaluation", "supervised learning"],
  "data analysis": ["data analysis", "eda", "pandas", "numpy", "data cleaning"],
  "deep learning": ["deep learning", "neural networks", "cnn", "rnn"],
  "linear algebra": ["linear algebra", "matrices", "vectors"],
  probability: ["probability", "statistics"]
};

const topicMatchesRequiredArea = (topic, requiredTopic) => {
  const left = normalizeKey(topic);
  const right = normalizeKey(requiredTopic);
  if (!left || !right) return false;

  const aliases = topicAliases[right] || [right];
  return aliases.some((alias) => left.includes(alias) || alias.includes(left));
};

const collectAttemptedTopics = (attempts) => {
  const topics = [];

  attempts.forEach((attempt) => {
    const answerTopics = Array.isArray(attempt?.detailedResult?.answers) ? attempt.detailedResult.answers : [];
    answerTopics.forEach((item) => topics.push(item?.topic));

    const codingQuestions = Array.isArray(attempt?.detailedResult?.questions) ? attempt.detailedResult.questions : [];
    codingQuestions.forEach((item) => topics.push(item?.topic));

    const testQuestions = Array.isArray(attempt?.testId?.questions) ? attempt.testId.questions : [];
    testQuestions.forEach((item) => topics.push(item?.topic));
  });

  return uniqueTextList(topics, 20);
};

const deriveLanguageInsights = (attempts) => {
  const languageMap = new Map();

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

      const current = languageMap.get(language) || {
        language,
        submissions: 0,
        successCount: 0,
        totalScore: 0
      };

      current.submissions += 1;
      current.totalScore += toNumber(question?.marksObtained ?? question?.marks);
      if (["accepted", "partial"].includes(normalizeKey(question?.verdict))) {
        current.successCount += 1;
      }

      languageMap.set(language, current);
    });
  });

  const languageStats = Array.from(languageMap.values())
    .map((entry) => ({
      language: entry.language,
      submissions: entry.submissions,
      successRate: entry.submissions > 0 ? Number(((entry.successCount / entry.submissions) * 100).toFixed(1)) : 0,
      averageScore: entry.submissions > 0 ? Number((entry.totalScore / entry.submissions).toFixed(1)) : 0
    }))
    .sort((left, right) => right.submissions - left.submissions || right.successRate - left.successRate);

  return {
    languageStats,
    mostUsedLanguage: languageStats[0]?.language || "",
    bestPerformingLanguage: [...languageStats]
      .sort((left, right) => right.successRate - left.successRate || right.averageScore - left.averageScore)[0]?.language || "",
    weakestLanguage: [...languageStats]
      .filter((item) => item.submissions > 0)
      .sort((left, right) => left.successRate - right.successRate || left.averageScore - right.averageScore)[0]?.language || ""
  };
};

const buildCareerReasons = ({ codingAverage, aptitudeAverage, technicalAverage, mostUsedLanguage }) => {
  const careers = [];

  if (codingAverage >= 70) {
    careers.push({
      role: "Software Developer",
      reason: `Coding at ${codingAverage.toFixed(1)}% shows strong problem-solving potential for software engineering interviews.`
    });
  }

  if ((aptitudeAverage + technicalAverage) / 2 >= 70) {
    careers.push({
      role: "Data Scientist",
      reason: `Aptitude and technical strength support analytical decision-making and data-driven problem solving.`
    });
  }

  const balancedScores =
    codingAverage >= 55 &&
    aptitudeAverage >= 55 &&
    technicalAverage >= 55 &&
    Math.max(codingAverage, aptitudeAverage, technicalAverage) - Math.min(codingAverage, aptitudeAverage, technicalAverage) <= 20;

  if (balancedScores) {
    careers.push({
      role: "Full Stack Developer",
      reason: "Balanced section scores fit roles that require both implementation and cross-layer technical understanding."
    });
  }

  if (mostUsedLanguage === "Java" && codingAverage >= 60) {
    careers.push({
      role: "Backend Developer",
      reason: "Your Java usage and coding performance make backend-oriented development a practical specialization."
    });
  }

  if (mostUsedLanguage === "Python" && technicalAverage >= 60) {
    careers.push({
      role: "AI/ML Engineer",
      reason: "Your Python usage combined with technical strength supports a gradual move toward AI/ML roles."
    });
  }

  if (careers.length === 0) {
    careers.push({
      role: "Software Developer",
      reason: "This remains the broadest path while your scores and topic depth continue to improve."
    });
    careers.push({
      role: "Full Stack Developer",
      reason: "This path stays practical when you need a balanced target across coding and technical sections."
    });
  }

  const seen = new Set();
  return careers.filter((item) => {
    const key = normalizeKey(item.role);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
};

const buildEnhancedWeakTopics = ({ selectedCareerPath, weakTopics, attemptedTopics }) => {
  const chosenPath = CAREER_PATH_OPTIONS.includes(selectedCareerPath) ? selectedCareerPath : "Software Developer";
  const requiredTopics = REQUIRED_TOPICS_BY_CAREER[chosenPath] || REQUIRED_TOPICS_BY_CAREER["Software Developer"];
  const missingTopics = requiredTopics.filter(
    (requiredTopic) => !attemptedTopics.some((attemptedTopic) => topicMatchesRequiredArea(attemptedTopic, requiredTopic))
  );

  return uniqueTextList([...(Array.isArray(weakTopics) ? weakTopics : []), ...missingTopics], 8);
};

const buildStrongSkills = ({ selectedCareerPath, strongTopics, codingAverage, aptitudeAverage, technicalAverage }) => {
  const chosenPath = CAREER_PATH_OPTIONS.includes(selectedCareerPath) ? selectedCareerPath : "Software Developer";
  const primaryScore =
    codingAverage >= aptitudeAverage && codingAverage >= technicalAverage
      ? `High coding consistency supports ${chosenPath.toLowerCase()} preparation`
      : aptitudeAverage >= technicalAverage
        ? `Strong analytical accuracy supports ${chosenPath.toLowerCase()} preparation`
        : `Technical accuracy supports ${chosenPath.toLowerCase()} preparation`;

  return uniqueTextList(strongTopics, 5).map((topic, index) => ({
    topic,
    reason:
      index === 0
        ? `${primaryScore}, and ${topic} is directly useful for this path.`
        : `${topic} is one of your better-performing areas and remains relevant for ${chosenPath.toLowerCase()} interviews.`
  }));
};

const buildAreasToImprove = ({ selectedCareerPath, weakTopics, attemptedTopics }) => {
  const chosenPath = CAREER_PATH_OPTIONS.includes(selectedCareerPath) ? selectedCareerPath : "Software Developer";
  const requiredTopics = REQUIRED_TOPICS_BY_CAREER[chosenPath] || REQUIRED_TOPICS_BY_CAREER["Software Developer"];
  const weakList = uniqueTextList(weakTopics, 8);

  return weakList.map((topic) => {
    const isMissingRequiredTopic = requiredTopics.some((requiredTopic) => normalizeKey(requiredTopic) === normalizeKey(topic))
      && !attemptedTopics.some((attemptedTopic) => topicMatchesRequiredArea(attemptedTopic, topic));

    return {
      topic,
      reason: isMissingRequiredTopic
        ? `Not practiced yet, but it is important for ${chosenPath.toLowerCase()} interview readiness.`
        : `Recent performance is weaker here, so it is now a priority for ${chosenPath.toLowerCase()} preparation.`
    };
  });
};

const buildWhyThisMatchesYou = ({ selectedCareerPath, cgpa, codingAverage, aptitudeAverage, technicalAverage, strongSkills, preferredLanguage }) => {
  const chosenPath = selectedCareerPath || "Software Developer";
  const topTopics = strongSkills.slice(0, 2).map((item) => item.topic).join(" and ") || "your strongest topics";
  const scoreSignals = [];
  if (codingAverage >= 70) scoreSignals.push(`coding at ${codingAverage.toFixed(1)}%`);
  if (aptitudeAverage >= 65) scoreSignals.push(`aptitude at ${aptitudeAverage.toFixed(1)}%`);
  if (technicalAverage >= 65) scoreSignals.push(`technical at ${technicalAverage.toFixed(1)}%`);
  if (cgpa >= 7) scoreSignals.push(`a stable CGPA of ${cgpa.toFixed(1)}`);

  return `Your current fit for ${chosenPath} is supported by stronger performance in ${topTopics}. ${scoreSignals.slice(0, 2).join(" and ") || "Your score mix"} gives you a workable base for this path, and ${preferredLanguage || "your preferred language"} supports the learning direction.`;
};

const buildImprovementAdvice = ({ selectedCareerPath, areasToImprove, codingAverage, aptitudeAverage, technicalAverage }) => {
  const chosenPath = selectedCareerPath || "Software Developer";
  const focusTopics = areasToImprove.slice(0, 3).map((item) => item.topic).join(", ") || "your current weak areas";
  const actions = [];

  if (codingAverage < 60) {
    actions.push(`solve 15 targeted coding questions weekly on ${focusTopics}`);
  }
  if (aptitudeAverage < 60) {
    actions.push("complete 4 timed aptitude sets each week");
  }
  if (technicalAverage < 60) {
    actions.push("revise OS, DBMS, OOPs, and CN with 20 interview-style questions weekly");
  }
  if (actions.length === 0) {
    actions.push(`deepen ${focusTopics} with targeted revision and mock-based review`);
  }

  return `To improve your readiness for ${chosenPath}, focus first on ${focusTopics} and ${actions.slice(0, 2).join(", ")}.`;
};

const buildRuleBasedRecommendationPayload = (context) => {
  const recommendedPaths = buildCareerReasons(context);
  const strongSkills = buildStrongSkills(context);
  const areasToImprove = buildAreasToImprove(context);
  const recommendedCareer = recommendedPaths[0]?.role || "Software Developer";

  return {
    recommendedCareer,
    reason: recommendedPaths[0]?.reason || "This path currently aligns best with your score profile and strengths.",
    strengthSummary: strongSkills.slice(0, 2).map((item) => item.topic).join(", "),
    improvementSummary: areasToImprove.slice(0, 3).map((item) => item.topic).join(", "),
    strengths: strongSkills.map((item) => item.topic),
    improvements: areasToImprove.map((item) => item.topic),
    confidence:
      context.codingAverage >= 70 || context.aptitudeAverage >= 70 || context.technicalAverage >= 70 ? "High" : "Medium",
    recommendedPaths,
    recommendedCareers: recommendedPaths,
    bestPath: recommendedCareer,
    strongSkills,
    areasToImprove,
    strongTopics: strongSkills.map((item) => item.topic),
    weakTopics: areasToImprove.map((item) => item.topic),
    whyThisMatchesYou: buildWhyThisMatchesYou({
      ...context,
      strongSkills
    }),
    improvementAdvice: buildImprovementAdvice({
      ...context,
      areasToImprove
    }),
    source: "rule-based"
  };
};

const normalizeSkillItems = (items, fallbackItems = [], limit = 6) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item) => ({
      topic: normalizeText(item?.topic),
      reason: normalizeText(item?.reason)
    }))
    .filter((item) => item.topic && item.reason)
    .slice(0, limit);

  return normalized.length > 0 ? normalized : fallbackItems.slice(0, limit);
};

const getCareerRecommendationsForStudent = async (userId) => {
  await ensureStudentRole(userId);

  const analytics = await getStudentAnalytics(userId);
  const totalTests = toNumber(analytics?.totalTests);
  if (totalTests < 3) {
    return {
      success: true,
      message:
        "Insufficient data for reliable career recommendation. Attempt at least 3 mock tests to unlock personalized guidance."
    };
  }

  const [topicAnalytics, studentProfile, user] = await Promise.all([
    getStudentTopicAnalytics(userId),
    loadStudentWithTestData(
      { userId },
      {
        select: "userId cgpa skills aiAnalyticsCache careerRecommendations",
        attemptPopulate: "questions"
      }
    ),
    User.findById(userId).select("careerPath")
  ]);

  const attempts = getAnalyticsAttempts(Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : []);
  const attemptedTopics = collectAttemptedTopics(attempts);
  const languageInsights = deriveLanguageInsights(attempts);
  const currentWeakTopics = uniqueTextList(topicAnalytics?.weakTopics || [], 8);
  const strongTopics = uniqueTextList(topicAnalytics?.strongTopics || [], 5);
  const cachedRecommendation = Array.isArray(studentProfile?.careerRecommendations) ? studentProfile.careerRecommendations[0] : null;
  const selectedCareerPath = String(user?.careerPath || "").trim();
  const context = {
    selectedCareerPath: selectedCareerPath || "Software Developer",
    overallAverage: toNumber(analytics?.overallAverage),
    cgpa: toNumber(studentProfile?.cgpa),
    codingAverage: toNumber(analytics?.codingAverage),
    aptitudeAverage: getSubjectAverage(analytics, "Aptitude"),
    technicalAverage: getSubjectAverage(analytics, "Technical"),
    strongTopics,
    weakTopics: buildEnhancedWeakTopics({
      selectedCareerPath,
      weakTopics: currentWeakTopics,
      attemptedTopics
    }),
    attemptedTopics,
    preferredLanguage: languageInsights.mostUsedLanguage || ""
  };

  if (cachedRecommendation && Number(cachedRecommendation?.testCount) === totalTests) {
    const cachedCareers = Array.isArray(cachedRecommendation?.recommendedCareers)
      ? cachedRecommendation.recommendedCareers
      : Array.isArray(cachedRecommendation?.recommendedPaths)
        ? cachedRecommendation.recommendedPaths
        : [];
    const cachedStrongSkills = normalizeSkillItems(cachedRecommendation?.strongSkills);
    const cachedAreasToImprove = normalizeSkillItems(cachedRecommendation?.areasToImprove);

    return {
      success: true,
      totalTests,
      previousTestCount: Number(cachedRecommendation?.previousTestCount) || totalTests,
      aptitudeAverage: context.aptitudeAverage,
      technicalAverage: context.technicalAverage,
      codingAverage: context.codingAverage,
      cgpa: context.cgpa,
      attemptedTopics,
      strongSkills: cachedStrongSkills,
      areasToImprove: cachedAreasToImprove,
      strongTopics: cachedStrongSkills.map((item) => item.topic),
      weakTopics: cachedAreasToImprove.map((item) => item.topic),
      recommendedCareers: cachedCareers,
      recommendedPaths: cachedCareers,
      bestPath: String(cachedRecommendation?.bestPath || cachedCareers[0]?.role || "").trim(),
      selectedCareerPath: String(cachedRecommendation?.selectedCareerPath || selectedCareerPath || "").trim(),
      whyThisMatchesYou: String(cachedRecommendation?.whyThisMatchesYou || "").trim(),
      improvementAdvice: String(cachedRecommendation?.improvementAdvice || "").trim(),
      source: String(cachedRecommendation?.source || "rule-based").trim()
      ,
      recommendedCareer: String(cachedRecommendation?.recommendedCareer || cachedRecommendation?.bestPath || cachedCareers[0]?.role || "").trim(),
      reason: String(cachedRecommendation?.reason || cachedCareers[0]?.reason || "").trim(),
      strengthSummary: String(cachedRecommendation?.strengthSummary || "").trim(),
      improvementSummary: String(cachedRecommendation?.improvementSummary || "").trim(),
      strengths: cachedStrongSkills.map((item) => item.topic),
      improvements: cachedAreasToImprove.map((item) => item.topic),
      confidence: String(cachedRecommendation?.confidence || "Medium").trim()
    };
  }

  const fallbackRecommendation = buildRuleBasedRecommendationPayload(context);
  let recommendation = fallbackRecommendation;

  if (hasGroqCredentials()) {
    try {
      const aiRecommendation = await generateCareerRecommendationsAI(
        buildCareerAIInput({
          analyticsCache: studentProfile?.aiAnalyticsCache,
          fallbackContext: context,
          cgpa: studentProfile?.cgpa,
          skills: studentProfile?.skills,
          totalAttempts: totalTests
        })
      );

      if (normalizeText(aiRecommendation?.recommendedCareer)) {
        const aiRole = normalizeText(aiRecommendation.recommendedCareer);
        const aiReason = normalizeText(aiRecommendation.reason) || fallbackRecommendation.reason;
        const aiStrengths = uniqueTextList(aiRecommendation?.strengths, 6);
        const aiImprovements = uniqueTextList(aiRecommendation?.improvements, 8);
        const aiStrongSkills = normalizeSkillItems(aiRecommendation?.strongSkills, fallbackRecommendation.strongSkills);
        const aiAreasToImprove = normalizeSkillItems(aiRecommendation?.areasToImprove, fallbackRecommendation.areasToImprove);
        const mergedStrongSkills =
          aiStrongSkills.length > 0
            ? aiStrongSkills
            : aiStrengths.map((topic) => ({
                topic,
                reason: `${topic} is supporting your current fit for ${aiRole.toLowerCase()}.`
              }));
        const mergedAreasToImprove =
          aiAreasToImprove.length > 0
            ? aiAreasToImprove
            : aiImprovements.map((topic) => ({
                topic,
                reason: `${topic} needs attention to improve readiness for ${aiRole.toLowerCase()}.`
              }));
        recommendation = {
          recommendedCareer: aiRole,
          reason: aiReason,
          strengthSummary:
            normalizeText(aiRecommendation?.strengthSummary) ||
            (aiStrengths.length > 0
              ? aiStrengths.slice(0, 2).join(", ")
              : mergedStrongSkills.slice(0, 2).map((item) => item.topic).join(", ")),
          improvementSummary:
            normalizeText(aiRecommendation?.improvementSummary) ||
            (aiImprovements.length > 0
              ? aiImprovements.slice(0, 3).join(", ")
              : mergedAreasToImprove.slice(0, 3).map((item) => item.topic).join(", ")),
          strengths: aiStrengths.length > 0 ? aiStrengths : mergedStrongSkills.map((item) => item.topic),
          improvements: aiImprovements.length > 0 ? aiImprovements : mergedAreasToImprove.map((item) => item.topic),
          confidence: normalizeText(aiRecommendation?.confidence) || fallbackRecommendation.confidence,
          recommendedPaths: [{ role: aiRole, reason: aiReason }],
          recommendedCareers: [{ role: aiRole, reason: aiReason }],
          bestPath: aiRecommendation.bestPath || aiRole || fallbackRecommendation.bestPath,
          strongSkills: mergedStrongSkills,
          areasToImprove: mergedAreasToImprove,
          strongTopics: mergedStrongSkills.map((item) => item.topic),
          weakTopics: uniqueTextList([...mergedAreasToImprove.map((item) => item.topic), ...context.weakTopics], 8),
          whyThisMatchesYou: normalizeText(aiRecommendation?.reason) || fallbackRecommendation.whyThisMatchesYou,
          improvementAdvice:
            normalizeText(aiRecommendation?.improvementAdvice) ||
            (aiImprovements.length > 0
              ? `Focus next on ${aiImprovements.slice(0, 3).join(", ")} to improve role readiness.`
              : fallbackRecommendation.improvementAdvice),
          source: "groq"
        };
      }
    } catch {
      // Fall back to the existing rule-based recommendation payload.
    }
  }

  studentProfile.careerRecommendations = [
    {
      generatedAt: new Date(),
      previousTestCount: Number(cachedRecommendation?.testCount) || totalTests,
      testCount: totalTests,
      selectedCareerPath: context.selectedCareerPath,
      recommendedCareer: recommendation.recommendedCareer,
      reason: recommendation.reason,
      strengthSummary: recommendation.strengthSummary || "",
      improvementSummary: recommendation.improvementSummary || "",
      confidence: recommendation.confidence,
      bestPath: recommendation.bestPath,
      recommendedCareers: recommendation.recommendedCareers,
      strongSkills: recommendation.strongSkills,
      areasToImprove: recommendation.areasToImprove,
      strongTopics: recommendation.strongTopics,
      weakTopics: recommendation.weakTopics,
      whyThisMatchesYou: recommendation.whyThisMatchesYou,
      improvementAdvice: recommendation.improvementAdvice,
      source: recommendation.source
    }
  ];
  await studentProfile.save();

  return {
    success: true,
    totalTests,
    previousTestCount: Number(cachedRecommendation?.testCount) || totalTests,
    aptitudeAverage: context.aptitudeAverage,
    technicalAverage: context.technicalAverage,
    codingAverage: context.codingAverage,
    overallAverage: context.overallAverage,
    cgpa: context.cgpa,
    attemptedTopics,
    strongSkills: recommendation.strongSkills,
    areasToImprove: recommendation.areasToImprove,
    strongTopics: recommendation.strongTopics,
    weakTopics: recommendation.weakTopics,
    recommendedCareers: recommendation.recommendedCareers,
    recommendedPaths: recommendation.recommendedPaths,
    recommendedCareer: recommendation.recommendedCareer,
    reason: recommendation.reason,
    strengthSummary: recommendation.strengthSummary || "",
    improvementSummary: recommendation.improvementSummary || "",
    strengths: recommendation.strengths,
    improvements: recommendation.improvements,
    confidence: recommendation.confidence,
    bestPath: recommendation.bestPath,
    selectedCareerPath: context.selectedCareerPath,
    whyThisMatchesYou: recommendation.whyThisMatchesYou,
    improvementAdvice: recommendation.improvementAdvice,
    source: recommendation.source
  };
};

module.exports = {
  getCareerRecommendationsForStudent,
  deriveLanguageInsights
};
