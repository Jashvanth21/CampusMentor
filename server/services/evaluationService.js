const { submitCode } = require("./judge0Service");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalize = (value) => String(value || "").trim().replace(/\r/g, "");
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const getLanguageLabel = (languageId) => {
  const safeLanguageId = Number(languageId);

  if (safeLanguageId === 54) return "C++17";
  if (safeLanguageId === 62) return "Java";
  if (safeLanguageId === 63) return "JavaScript";
  return "Python 3";
};

const getVerdict = (passedTestCases, totalTestCases) => {
  if (totalTestCases <= 0 || passedTestCases <= 0) {
    return "Wrong";
  }

  if (passedTestCases >= totalTestCases) {
    return "Accepted";
  }

  return "Partial";
};

const getPassingPercentage = (test) => {
  const configured = Number(test?.passingCriteria);
  if (Number.isFinite(configured) && configured >= 0 && configured <= 100) {
    return configured;
  }

  return 50;
};

const buildStatusPayload = ({ earnedScore, totalPossibleScore, totalQuestions, test }) => {
  const safeEarnedScore = Number(earnedScore) || 0;
  const safeTotalPossibleScore = Number(totalPossibleScore) || 0;
  const safeTotalQuestions = Number(totalQuestions) || 0;
  const percentage =
    safeTotalPossibleScore > 0
      ? Number(((safeEarnedScore / safeTotalPossibleScore) * 100).toFixed(2))
      : 0;
  const passingPercentage = getPassingPercentage(test);
  const status = percentage >= passingPercentage ? "Pass" : "Fail";

  return {
    score: percentage,
    percentage,
    totalQuestions: safeTotalQuestions,
    passingPercentage,
    status
  };
};

const getQuestionMaxMarks = (question) => Math.max(0, toNumber(question?.marks, 1) || 1);

const evaluateMCQ = async (test, answers) => {
  if (!Array.isArray(answers)) {
    throw createError("answers must be an array for MCQ submission.", 400);
  }

  const questions = test.questions || [];
  const totalQuestions = questions.length;
  let correctCount = 0;
  let totalScore = 0;
  let maxScore = 0;
  const weakTopicsCount = {};
  const detailed = [];
  const questionWiseResults = [];

  questions.forEach((question, index) => {
    const submitted = answers[index];
    const isCorrect = normalize(submitted) === normalize(question.correctAnswer);
    const topic = question.topic || test.subject || "General";
    const questionMarks = getQuestionMaxMarks(question);

    maxScore += questionMarks;

    if (isCorrect) {
      correctCount += 1;
      totalScore += questionMarks;
    } else {
      weakTopicsCount[topic] = (weakTopicsCount[topic] || 0) + 1;
    }

    detailed.push({
      questionIndex: index,
      topic,
      submittedAnswer: submitted ?? null,
      correctAnswer: question.correctAnswer ?? null,
      isCorrect
    });

    questionWiseResults.push({
      questionIndex: index,
      questionText: question.questionText || "",
      topic,
      marks: isCorrect ? questionMarks : 0,
      maxMarks: questionMarks,
      submittedAnswer: submitted ?? null,
      correctAnswer: question.correctAnswer ?? null,
      isCorrect
    });
  });

  const statusPayload = buildStatusPayload({
    earnedScore: correctCount,
    totalPossibleScore: totalQuestions,
    totalQuestions,
    test
  });
  const weakTopics = Object.entries(weakTopicsCount)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, misses]) => ({ topic, misses }));

  return {
    ...statusPayload,
    totalScore,
    maxScore,
    questionWiseResults,
    detailedResult: {
      totalQuestions,
      correctCount,
      incorrectCount: totalQuestions - correctCount,
      percentage: statusPayload.percentage,
      status: statusPayload.status,
      passingPercentage: statusPayload.passingPercentage,
      totalScore,
      maxScore,
      weakTopics,
      answers: detailed
    }
  };
};

const evaluateCodingQuestion = async (question, submissionCode, overrideLanguageId) => {
  if (!submissionCode) {
    throw createError("code is required for coding evaluation.", 400);
  }

  if (!Array.isArray(question?.testCases) || question.testCases.length === 0) {
    throw createError("No hidden test cases found for this coding question.", 400);
  }

  const languageId = overrideLanguageId || question.languageId;
  if (!languageId) {
    throw createError("language is required for coding evaluation.", 400);
  }

  const caseResults = [];
  let passedTestCases = 0;

  for (let cIndex = 0; cIndex < question.testCases.length; cIndex += 1) {
    const testCase = question.testCases[cIndex];
    const judgeResult = await submitCode(submissionCode, languageId, testCase.input);
    const actualOutput = normalize(judgeResult.stdout);
    const expectedOutput = normalize(testCase.expectedOutput);
    const isPassed = actualOutput === expectedOutput && !judgeResult.stderr;

    if (isPassed) {
      passedTestCases += 1;
    }

    caseResults.push({
      caseIndex: cIndex,
      input: testCase.input || "",
      expectedOutput: testCase.expectedOutput || "",
      actualOutput: judgeResult.stdout || "",
      stderr: judgeResult.stderr || "",
      compileOutput: judgeResult.compile_output || "",
      status: judgeResult.status,
      passed: isPassed
    });
  }

  const totalTestCases = question.testCases.length;
  const maxMarks = getQuestionMaxMarks(question);
  const marksObtained =
    totalTestCases === 0 ? 0 : Number(((passedTestCases / totalTestCases) * maxMarks).toFixed(2));
  const verdict = getVerdict(passedTestCases, totalTestCases);

  return {
    code: submissionCode,
    languageId,
    languageLabel: getLanguageLabel(languageId),
    passedTestCases,
    totalTestCases,
    passedTestcases: passedTestCases,
    totalTestcases: totalTestCases,
    verdict,
    marksObtained,
    maxMarks,
    caseResults
  };
};

const evaluateCoding = async (test, submissionCode, overrideLanguageId) => {
  if (!submissionCode) {
    throw createError("sourceCode is required for coding submission.", 400);
  }

  const codingQuestions = (test.questions || []).filter(
    (q) => Array.isArray(q.testCases) && q.testCases.length > 0
  );
  if (codingQuestions.length === 0) {
    throw createError("No coding test cases found for this test.", 400);
  }

  let totalCases = 0;
  let passedCases = 0;
  let totalScore = 0;
  let maxScore = 0;
  const questionResults = [];

  for (let qIndex = 0; qIndex < codingQuestions.length; qIndex += 1) {
    const question = codingQuestions[qIndex];
    const evaluation = await evaluateCodingQuestion(question, submissionCode, overrideLanguageId);
    totalCases += evaluation.totalTestCases;
    passedCases += evaluation.passedTestCases;
    totalScore += evaluation.marksObtained;
    maxScore += evaluation.maxMarks;

    questionResults.push({
      questionIndex: qIndex,
      questionTitle: question.questionText || `Question ${qIndex + 1}`,
      problemStatement: question.problemStatement || "",
      code: evaluation.code,
      languageId: evaluation.languageId,
      languageLabel: evaluation.languageLabel,
      verdict: evaluation.verdict,
      passedCases: evaluation.passedTestCases,
      totalCases: evaluation.totalTestCases,
      passedTestCases: evaluation.passedTestCases,
      totalTestCases: evaluation.totalTestCases,
      marksObtained: evaluation.marksObtained,
      maxMarks: evaluation.maxMarks,
      cases: evaluation.caseResults
    });
  }

  const statusPayload = buildStatusPayload({
    earnedScore: totalScore,
    totalPossibleScore: maxScore,
    totalQuestions: codingQuestions.length,
    test
  });

  return {
    ...statusPayload,
    totalScore,
    maxScore,
    detailedResult: {
      totalQuestions: codingQuestions.length,
      totalCases,
      passedCases,
      failedCases: totalCases - passedCases,
      percentage: statusPayload.percentage,
      status: statusPayload.status,
      passingPercentage: statusPayload.passingPercentage,
      totalScore,
      maxScore,
      questions: questionResults
    }
  };
};

const evaluateCodingTest = async (test, answers) => {
  const codingQuestions = (test?.questions || []).filter(
    (question) => Array.isArray(question?.testCases) && question.testCases.length > 0
  );

  if (codingQuestions.length === 0) {
    throw createError("No coding questions found for this test.", 400);
  }

  if (!Array.isArray(answers)) {
    throw createError("answers must be an array for coding test submission.", 400);
  }

  const answerMap = answers.reduce((acc, item) => {
    const key = String(item?.questionId || "");
    if (key) {
      acc[key] = item;
    }
    return acc;
  }, {});

  let totalScore = 0;
  let maxScore = 0;
  let totalCases = 0;
  let passedCases = 0;

  const questionWiseResults = [];

  for (let index = 0; index < codingQuestions.length; index += 1) {
    const question = codingQuestions[index];
    const questionId = String(question?.id || question?._id || `${test._id}:${index}`);
    const matchedAnswer = answerMap[questionId];
    const hasCode = Boolean(String(matchedAnswer?.code || "").trim());
    const evaluation = hasCode
      ? await evaluateCodingQuestion(question, matchedAnswer?.code || "", matchedAnswer?.language)
      : {
          code: "",
          languageId: Number(matchedAnswer?.language) || Number(matchedAnswer?.languageId) || question?.languageId || 71,
          languageLabel: getLanguageLabel(
            Number(matchedAnswer?.language) || Number(matchedAnswer?.languageId) || question?.languageId || 71
          ),
          passedTestCases: 0,
          totalTestCases: Array.isArray(question?.testCases) ? question.testCases.length : 0,
          verdict: "Wrong",
          marksObtained: 0,
          maxMarks: getQuestionMaxMarks(question),
          caseResults: []
        };

    totalScore += evaluation.marksObtained;
    maxScore += evaluation.maxMarks;
    totalCases += evaluation.totalTestCases;
    passedCases += evaluation.passedTestCases;

    questionWiseResults.push({
      questionId,
      questionIndex: index,
      questionTitle: question?.questionText || `Question ${index + 1}`,
      problemStatement: question?.problemStatement || question?.questionText || "",
      code: evaluation.code,
      languageId: evaluation.languageId,
      languageLabel: evaluation.languageLabel,
      marks: evaluation.marksObtained,
      maxMarks: evaluation.maxMarks,
      marksObtained: evaluation.marksObtained,
      verdict: evaluation.verdict,
      passedTestCases: evaluation.passedTestCases,
      totalTestCases: evaluation.totalTestCases,
      cases: evaluation.caseResults
    });
  }

  const statusPayload = buildStatusPayload({
    earnedScore: totalScore,
    totalPossibleScore: maxScore,
    totalQuestions: codingQuestions.length,
    test
  });

  return {
    ...statusPayload,
    totalScore,
    maxScore,
    questionWiseResults,
    detailedResult: {
      totalQuestions: codingQuestions.length,
      totalCases,
      passedCases,
      failedCases: Math.max(0, totalCases - passedCases),
      percentage: statusPayload.percentage,
      status: statusPayload.status,
      passingPercentage: statusPayload.passingPercentage,
      totalScore,
      maxScore,
      questions: questionWiseResults
    }
  };
};

module.exports = {
  evaluateMCQ,
  evaluateCoding,
  evaluateCodingQuestion,
  evaluateCodingTest
};
