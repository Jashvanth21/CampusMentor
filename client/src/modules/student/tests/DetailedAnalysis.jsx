import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const getResultStorageKey = (testId) => `student_test_result_${testId}`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildTopicBreakdownFromResult = (result) => {
  const details = result?.detailedResult || {};
  const resultType = String(result?.type || "").toUpperCase();

  if (resultType === "MCQ") {
    const answers = Array.isArray(details?.answers) ? details.answers : [];
    const map = {};

    answers.forEach((item) => {
      const topic = item?.topic || "General";
      if (!map[topic]) {
        map[topic] = { totalQuestions: 0, correctAnswers: 0, incorrectAnswers: 0 };
      }
      map[topic].totalQuestions += 1;
      if (item?.isCorrect) {
        map[topic].correctAnswers += 1;
      } else {
        map[topic].incorrectAnswers += 1;
      }
    });

    return Object.entries(map).map(([topic, stats]) => ({
      topic,
      totalQuestions: stats.totalQuestions,
      correctAnswers: stats.correctAnswers,
      incorrectAnswers: stats.incorrectAnswers,
      accuracy:
        stats.totalQuestions > 0
          ? Number(((stats.correctAnswers / stats.totalQuestions) * 100).toFixed(2))
          : 0
    }));
  }

  const codingQuestions = Array.isArray(result?.questionWiseResults) && result.questionWiseResults.length > 0
    ? result.questionWiseResults
    : Array.isArray(details?.questions) ? details.questions : [];
  return codingQuestions.map((question, index) => {
    const totalQuestions = toNumber(question?.totalCases ?? question?.totalTestCases);
    const correctAnswers = toNumber(question?.passedCases ?? question?.passedTestCases);
    const incorrectAnswers = Math.max(0, totalQuestions - correctAnswers);
    const topic = question?.problemStatement?.trim() || `Coding Question ${index + 1}`;

    return {
      topic,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      accuracy: totalQuestions > 0 ? Number(((correctAnswers / totalQuestions) * 100).toFixed(2)) : 0
    };
  });
};

const buildTestSpecificRecommendation = ({ accuracy, weakTopics, subject }) => {
  const safeSubject = subject || "this subject";
  const weakTopicText =
    weakTopics.length > 0
      ? weakTopics.map((item) => item.topic).slice(0, 3).join(", ")
      : "foundational topics";

  if (accuracy < 50) {
    return `Revise fundamentals of ${weakTopicText} in ${safeSubject}.`;
  }

  if (accuracy < 80) {
    return `Practice mixed difficulty questions in ${weakTopicText} for ${safeSubject}.`;
  }

  return `Increase difficulty and attempt timed practice in ${safeSubject}.`;
};

const DetailedAnalysis = () => {
  const { testId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState(location?.state?.result || null);
  const [testMeta, setTestMeta] = useState(location?.state?.testMeta || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const resolveResult = () => {
      try {
        setLoading(true);
        setError("");

        if (!testId) {
          navigate("/student/mock-tests", { replace: true });
          return;
        }

        if (location?.state?.result) {
          const enrichedResult = location?.state?.testMeta
            ? { ...location.state.result, _testMeta: location.state.testMeta }
            : location.state.result;
          localStorage.setItem(getResultStorageKey(testId), JSON.stringify(enrichedResult));
          setResult(enrichedResult);
          setTestMeta(location?.state?.testMeta || enrichedResult?._testMeta || null);
          return;
        }

        const storedRaw = localStorage.getItem(getResultStorageKey(testId));
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          if (stored) {
            setResult(stored);
            setTestMeta(stored?._testMeta || null);
            return;
          }
        }

        setError("No test-specific result found. Please submit or open this analysis from Test Result page.");
      } catch (requestError) {
        setError("Unable to load detailed analysis right now.");
      } finally {
        setLoading(false);
      }
    };

    resolveResult();
  }, [location?.state?.result, location?.state?.testMeta, navigate, testId]);

  const score = toNumber(result?.score);
  const topicBreakdown = useMemo(() => buildTopicBreakdownFromResult(result), [result]);
  const weakTopics = useMemo(
    () =>
      topicBreakdown
        .filter((item) => item.totalQuestions > 0 && item.accuracy < 50)
        .sort((a, b) => a.accuracy - b.accuracy || b.incorrectAnswers - a.incorrectAnswers),
    [topicBreakdown]
  );
  const strongTopics = useMemo(
    () =>
      topicBreakdown
        .filter((item) => item.totalQuestions > 0 && item.accuracy > 80)
        .sort((a, b) => b.accuracy - a.accuracy),
    [topicBreakdown]
  );

  const aiRecommendation = useMemo(
    () =>
      buildTestSpecificRecommendation({
        accuracy: score,
        weakTopics,
        subject: testMeta?.subject || "this subject"
      }),
    [score, testMeta?.subject, weakTopics]
  );

  if (loading) {
    return (
      <section className="card">
        <p className="muted-text">Loading detailed analysis...</p>
      </section>
    );
  }

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Detailed Analysis</h2>
        <p>Topic-level strengths and gaps for this test attempt only.</p>
        {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
        {!error && (
          <p className="dashboard-inline-hint">
            Accuracy: {score.toFixed(2)}% {testMeta?.subject ? `| Subject: ${testMeta.subject}` : ""}
          </p>
        )}
      </section>

      <section className="bottom-grid">
        <article className="card">
          <h3>Weak Topics</h3>
          {weakTopics.length === 0 ? (
            <p className="muted-text">No weak topics detected yet.</p>
          ) : (
            <ul className="weak-topic-list">
              {weakTopics.map((topic, index) => (
                <li className="weak-topic-item" key={`${topic.topic}-${index}`}>
                  <span>{topic.topic}</span>
                  <span className="weak-topic-badge">{Number(topic?.accuracy || 0).toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h3>Strong Topics</h3>
          {strongTopics.length === 0 ? (
            <p className="muted-text">Not enough data to identify strengths.</p>
          ) : (
            <ul className="weak-topic-list">
              {strongTopics.map((topic) => (
                <li className="weak-topic-item" key={topic.topic}>
                  <span>{topic.topic}</span>
                  <span className="score-chip">{Number(topic?.accuracy || 0).toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="card">
        <h3>Accuracy Per Topic (This Test)</h3>
        {topicBreakdown.length === 0 ? (
          <p className="muted-text">No topic-level data available for this attempt.</p>
        ) : (
          <ul className="weak-topic-list">
            {topicBreakdown.map((topic, index) => (
              <li className="weak-topic-item" key={`${topic.topic}-${index}-accuracy`}>
                <span>{topic.topic}</span>
                <span className="score-chip">
                  {Number(topic?.accuracy || 0).toFixed(2)}% ({Number(topic?.correctAnswers || 0)}/
                  {Number(topic?.totalQuestions || 0)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>AI Recommendation</h3>
        <p className="analysis-ai-report">{aiRecommendation}</p>
      </section>
    </div>
  );
};

export default DetailedAnalysis;
