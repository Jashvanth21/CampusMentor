const SUBJECTS = ["Technical", "Aptitude", "Coding"];
const normalizeSubject = (subject) => (subject === "DSA" ? "Technical" : subject);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getAttemptScore = (attempt) => {
  const directScore = toNumber(attempt?.score);
  if (directScore !== null) {
    return directScore;
  }

  const percentageScore = toNumber(attempt?.percentage);
  if (percentageScore !== null) {
    return percentageScore;
  }

  const totalScore = toNumber(attempt?.totalScore);
  const maxScore = toNumber(attempt?.maxScore);
  if (totalScore !== null && maxScore !== null && maxScore > 0) {
    return Number(((totalScore / maxScore) * 100).toFixed(2));
  }

  return 0;
};

const getCodingScore = (attempt, fallbackScore) => {
  const candidateScores = [
    attempt?.coding?.score,
    attempt?.sections?.coding?.score,
    attempt?.codingScore
  ];

  for (const candidate of candidateScores) {
    const parsed = toNumber(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return fallbackScore;
};

const analyzeStudentPerformance = (studentProfile) => {
  const scores = (Array.isArray(studentProfile?.mockTestScores) ? studentProfile.mockTestScores : []).filter(
    (attempt) => attempt?.isFirstAttempt !== false
  );

  const subjectBuckets = SUBJECTS.reduce((acc, subject) => {
    acc[subject] = { totalScore: 0, totalTests: 0 };
    return acc;
  }, {});

  let totalScore = 0;
  let codingScore = 0;
  let codingCount = 0;
  let mcqScore = 0;
  let mcqCount = 0;
  const topicStats = {};
  const codingScores = [];

  if (scores.length > 0) {
    console.log("Analytics first attempt sample:", scores[0]);
  }

  scores.forEach((entry) => {
    const score = getAttemptScore(entry);
    const subject = normalizeSubject(entry?.subject);
    const type = entry?.type;
    const testQuestions = Array.isArray(entry?.testQuestions) ? entry.testQuestions : [];
    const isCodingEntry = subject === "Coding" || String(type || "").toUpperCase() === "CODING";

    totalScore += score;

    if (subjectBuckets[subject]) {
      subjectBuckets[subject].totalScore += score;
      subjectBuckets[subject].totalTests += 1;
    }

    if (isCodingEntry) {
      const normalizedCodingScore = getCodingScore(entry, score);
      codingScore += normalizedCodingScore;
      codingCount += 1;
      codingScores.push(normalizedCodingScore);
      const codingQuestions = Array.isArray(entry?.detailedResult?.questions) ? entry.detailedResult.questions : [];

      codingQuestions.forEach((questionItem) => {
        const questionIndex = Number(questionItem?.questionIndex);
        const topic =
          questionItem?.topic ||
          (Number.isInteger(questionIndex) ? testQuestions[questionIndex]?.topic : null) ||
          "General";
        const totalQuestionCases = Math.max(1, Number(questionItem?.totalTestCases) || 0);
        const passedQuestionCases = Math.max(0, Number(questionItem?.passedTestCases) || 0);

        if (!topicStats[topic]) {
          topicStats[topic] = {
            totalQuestions: 0,
            correctAnswers: 0,
            incorrectAnswers: 0
          };
        }

        topicStats[topic].totalQuestions += totalQuestionCases;
        topicStats[topic].correctAnswers += passedQuestionCases;
        topicStats[topic].incorrectAnswers += Math.max(0, totalQuestionCases - passedQuestionCases);
      });
    } else if (type === "MCQ") {
      mcqScore += score;
      mcqCount += 1;

      const answers = Array.isArray(entry?.detailedResult?.answers) ? entry.detailedResult.answers : [];
      if (answers.length > 0) {
        answers.forEach((answerItem) => {
          const topic = answerItem?.topic || "General";
          if (!topicStats[topic]) {
            topicStats[topic] = {
              totalQuestions: 0,
              correctAnswers: 0,
              incorrectAnswers: 0
            };
          }

          topicStats[topic].totalQuestions += 1;
          if (answerItem?.isCorrect) {
            topicStats[topic].correctAnswers += 1;
          } else {
            topicStats[topic].incorrectAnswers += 1;
          }
        });
      } else {
        // Backward compatibility for older attempts that only persisted weak-topic misses.
        const weakTopics = entry?.detailedResult?.weakTopics;
        if (Array.isArray(weakTopics)) {
          weakTopics.forEach((item) => {
            if (!item?.topic) {
              return;
            }
            if (!topicStats[item.topic]) {
              topicStats[item.topic] = {
                totalQuestions: 0,
                correctAnswers: 0,
                incorrectAnswers: 0
              };
            }
            topicStats[item.topic].incorrectAnswers += Number(item.misses) || 0;
            topicStats[item.topic].totalQuestions += Number(item.misses) || 0;
          });
        }
      }
    }
  });

  console.log("Coding Scores:", codingScores);

  const totalTests = scores.length;
  const overallAverage = totalTests ? Number((totalScore / totalTests).toFixed(2)) : 0;
  const codingAverage = codingCount ? Number((codingScore / codingCount).toFixed(2)) : 0;
  const mcqAverage = mcqCount ? Number((mcqScore / mcqCount).toFixed(2)) : 0;

  const subjectBreakdown = {};
  SUBJECTS.forEach((subject) => {
    const bucket = subjectBuckets[subject];
    subjectBreakdown[subject] = {
      averageScorePerSubject: bucket.totalTests
        ? Number((bucket.totalScore / bucket.totalTests).toFixed(2))
        : 0,
      totalTestsPerSubject: bucket.totalTests
    };
  });

  const topicBreakdown = {};
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const totalQuestions = Number(stats.totalQuestions) || 0;
    const correctAnswers = Number(stats.correctAnswers) || 0;
    const incorrectAnswers = Number(stats.incorrectAnswers) || 0;
    const accuracy = totalQuestions > 0 ? Number(((correctAnswers / totalQuestions) * 100).toFixed(2)) : 0;

    topicBreakdown[topic] = {
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      accuracy
    };
  });

  const weakestTopics = Object.entries(topicBreakdown)
    .filter(([, stats]) => Number(stats?.incorrectAnswers) > 0)
    .map(([topic, stats]) => ({
      topic,
      misses: Number(stats.incorrectAnswers) || 0,
      accuracy: Number(stats.accuracy) || 0,
      totalQuestions: Number(stats.totalQuestions) || 0
    }))
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.misses - a.misses;
    })
    .slice(0, 3);

  const strongestTopics = Object.entries(topicBreakdown)
    .filter(([, stats]) => Number(stats?.totalQuestions) > 0)
    .map(([topic, stats]) => ({
      topic,
      accuracy: Number(stats.accuracy) || 0,
      correctAnswers: Number(stats.correctAnswers) || 0,
      totalQuestions: Number(stats.totalQuestions) || 0
    }))
    .sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.correctAnswers - a.correctAnswers;
    })
    .slice(0, 3);

  return {
    overallAverage,
    subjectBreakdown,
    topicBreakdown,
    codingAverage,
    mcqAverage,
    weakestTopics,
    strongestTopics,
    totalTests
  };
};

module.exports = {
  analyzeStudentPerformance
};
