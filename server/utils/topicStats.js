const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTopic = (value) => String(value || "").trim() || "General";

const getAttemptQuestionEntries = (attempt = {}) => {
  const answers = Array.isArray(attempt?.detailedResult?.answers) ? attempt.detailedResult.answers : [];
  if (answers.length > 0) {
    return answers.map((answer) => ({
      topic: normalizeTopic(answer?.topic),
      total: 1,
      correct: answer?.isCorrect ? 1 : 0
    }));
  }

  const codingQuestions = Array.isArray(attempt?.detailedResult?.questions) ? attempt.detailedResult.questions : [];
  const fallbackQuestions = Array.isArray(attempt?.testQuestions)
    ? attempt.testQuestions
    : Array.isArray(attempt?.testId?.questions)
      ? attempt.testId.questions
      : [];
  if (codingQuestions.length > 0) {
    return codingQuestions.map((question, index) => {
      const resolvedIndex = Number.isInteger(Number(question?.questionIndex)) ? Number(question.questionIndex) : index;
      const passedTestcases = Math.max(0, toNumber(question?.passedTestCases ?? question?.passedTestcases));
      return {
        topic: normalizeTopic(question?.topic || fallbackQuestions[resolvedIndex]?.topic),
        total: 1,
        correct: passedTestcases > 0 ? 1 : 0
      };
    });
  }

  const questionWiseResults = Array.isArray(attempt?.questionWiseResults) ? attempt.questionWiseResults : [];
  if (questionWiseResults.length > 0) {
    return questionWiseResults.map((question, index) => {
      const passedTestcases =
        question?.isCorrect === true
          ? 1
          : question?.isCorrect === false
            ? 0
            : Math.max(0, toNumber(question?.passedTestCases ?? question?.passedTestcases));

      return {
        topic: normalizeTopic(
          question?.topic ||
            fallbackQuestions[index]?.topic ||
            question?.questionTitle ||
            question?.questionText
        ),
        total: 1,
        correct: passedTestcases > 0 ? 1 : 0
      };
    });
  }

  const weakTopics = Array.isArray(attempt?.detailedResult?.weakTopics) ? attempt.detailedResult.weakTopics : [];
  return weakTopics
    .map((item) => {
      const misses = Math.max(0, toNumber(item?.misses));
      if (misses <= 0) {
        return null;
      }

      return {
        topic: normalizeTopic(item?.topic),
        total: misses,
        correct: 0
      };
    })
    .filter(Boolean);
};

const buildTopicStatsFromAttempts = (attempts = []) => {
  const topicMap = new Map();

  (Array.isArray(attempts) ? attempts : []).forEach((attempt) => {
    getAttemptQuestionEntries(attempt).forEach((entry) => {
      const topic = normalizeTopic(entry?.topic);
      const existing = topicMap.get(topic) || {
        topic,
        total: 0,
        correct: 0
      };
      existing.total += Math.max(0, toNumber(entry?.total));
      existing.correct += Math.max(0, toNumber(entry?.correct));
      topicMap.set(topic, existing);
    });
  });

  return Array.from(topicMap.values());
};

const updateTopicStats = (student, attempt) => {
  if (!student) {
    return student;
  }

  if (!Array.isArray(student.topicStats)) {
    student.topicStats = [];
  }

  const topicIndexByName = new Map(
    student.topicStats.map((entry, index) => [normalizeTopic(entry?.topic), index])
  );

  getAttemptQuestionEntries(attempt).forEach((entry) => {
    const topic = normalizeTopic(entry?.topic);
    const existingIndex = topicIndexByName.get(topic);

    if (existingIndex === undefined) {
      student.topicStats.push({
        topic,
        total: Math.max(0, toNumber(entry?.total)),
        correct: Math.max(0, toNumber(entry?.correct))
      });
      topicIndexByName.set(topic, student.topicStats.length - 1);
      return;
    }

    const target = student.topicStats[existingIndex];
    target.total = Math.max(0, toNumber(target?.total) + Math.max(0, toNumber(entry?.total)));
    target.correct = Math.max(0, toNumber(target?.correct) + Math.max(0, toNumber(entry?.correct)));
  });

  return student;
};

const getTopics = (topicStats = []) => {
  const strongTopics = [];
  const weakTopics = [];

  (Array.isArray(topicStats) ? topicStats : []).forEach((entry) => {
    const total = Math.max(0, toNumber(entry?.total));
    const correct = Math.max(0, toNumber(entry?.correct));
    if (total <= 0) {
      return;
    }

    const accuracy = (correct / total) * 100;
    if (accuracy >= 70) strongTopics.push(normalizeTopic(entry?.topic));
    if (accuracy <= 40) weakTopics.push(normalizeTopic(entry?.topic));
  });

  return {
    strongTopics,
    weakTopics
  };
};

module.exports = {
  buildTopicStatsFromAttempts,
  getAttemptQuestionEntries,
  getTopics,
  updateTopicStats
};
