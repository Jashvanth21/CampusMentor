import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiService from "../../../api/apiService";
import { formatDuration } from "../../../utils/timeFormat";

const formatScore = (attempt) => {
  const totalScore = Number(attempt?.totalScore);
  const maxScore = Number(attempt?.maxScore);

  if (Number.isFinite(totalScore) && Number.isFinite(maxScore) && maxScore > 0) {
    return `${totalScore}/${maxScore}`;
  }

  return `${Number(attempt?.percentage || 0).toFixed(2)}%`;
};

const getVerdictClassName = (verdict) => {
  const normalized = String(verdict || "").toLowerCase();
  if (normalized === "accepted") return "accepted";
  if (normalized === "partial") return "partial";
  return "wrong";
};

const isCodingAttempt = (attemptType) => String(attemptType || "").toLowerCase() === "coding";
const getQuestionExplainId = (question, index) => question?.questionId || question?._id || `question-${index}`;

const toNonEmptyString = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const getAttemptTitle = (attempt) =>
  toNonEmptyString(attempt?.testId?.title) ||
  toNonEmptyString(attempt?.testTitle) ||
  "Archived Test";

const getQuestionExplainPayload = (question, codingAttempt) => ({
  question: question?.title || question?.problemStatement || "Question unavailable",
  correctAnswer: question?.correctAnswer || question?.expectedOutput || question?.verdict || "Not available",
  questionType: codingAttempt ? "coding" : "mcq",
  description: question?.problemStatement || question?.title || "Problem unavailable",
  constraints: question?.constraints || "",
  sampleInput: question?.sampleInput || "",
  sampleOutput: question?.sampleOutput || "",
  language: question?.language || "Python"
});

const AttemptReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [explanations, setExplanations] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiService.getAttemptResult(id);
        setAttempt(data?.attempt || null);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Unable to load this attempt review.");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAttempt();
    }
  }, [id]);

  const handleExplain = async (question, index, codingQuestion = false) => {
    const explainId = getQuestionExplainId(question, index);
    if (explanations[explainId]) {
      return;
    }

    try {
      setLoadingId(explainId);
      const response = await apiService.explainAttemptAnswer(getQuestionExplainPayload(question, codingQuestion));
      setExplanations((prev) => ({
        ...prev,
        [explainId]: {
          type: response?.type || (codingQuestion ? "code" : "explanation"),
          content: response?.explanation || "Explanation unavailable. Please try again."
        }
      }));
    } catch (requestError) {
      console.error("Explain failed", requestError);
      setExplanations((prev) => ({
        ...prev,
        [explainId]: {
          type: codingQuestion ? "code" : "explanation",
          content: "Explanation unavailable. Please try again."
        }
      }));
    } finally {
      setLoadingId(null);
    }
  };

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setAnalysisLoading(true);
        const data = await apiService.getAttemptAnalysis(id);
        setAnalysis(data?.analysis || null);
      } catch (requestError) {
        setAnalysisError("Unable to load performance analysis.");
      } finally {
        setAnalysisLoading(false);
      }
    };

    if (id) {
      fetchAnalysis();
    }
  }, [id]);

  if (loading) {
    return (
      <section className="card">
        <p className="muted-text">Loading attempt review...</p>
      </section>
    );
  }

  if (!attempt) {
    return (
      <section className="card">
        <p className="dashboard-inline-hint error-text">{error || "Attempt not found."}</p>
        <button type="button" className="topbar-logout review-back-btn" onClick={() => navigate("/student/attempt-history")}>
          Back to Attempt History
        </button>
      </section>
    );
  }

  const codingAttempt = isCodingAttempt(attempt.type);
  const attemptTitle = getAttemptTitle(attempt);
  const hasMistakeAnalysis = Array.isArray(analysis?.mistakeAnalysis) && analysis.mistakeAnalysis.length > 0;
  const hasTimeAnalysis = Boolean(analysis?.timeAnalysis);
  const hasImprovementStrategy = Array.isArray(analysis?.improvementStrategy) && analysis.improvementStrategy.length > 0;
  const hasNextTestFocus = Array.isArray(analysis?.nextTestFocus) && analysis.nextTestFocus.length > 0;

  return (
    <div className="student-dashboard attempt-review-dashboard">
      <section className="dashboard-header review-hero">
        <div>
          <h2>{attemptTitle}</h2>
          <p>Detailed breakdown of this submission.</p>
        </div>
        <button type="button" className="topbar-logout review-back-btn" onClick={() => navigate("/student/attempt-history")}>
          Back to History
        </button>
      </section>

      <section className="review-summary-grid">
        <article className="review-summary-card">
          <span>Submitted</span>
          <strong>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-"}</strong>
        </article>
        <article className="review-summary-card">
          <span>Score</span>
          <strong>{formatScore(attempt)}</strong>
        </article>
        <article className="review-summary-card">
          <span>Percentage</span>
          <strong>{Number(attempt.percentage || 0).toFixed(2)}%</strong>
        </article>
        <article className="review-summary-card">
          <span>Type</span>
          <strong>{attempt.type}</strong>
        </article>
        <article className="review-summary-card">
          <span>Mode</span>
          <strong>{attempt.attemptMode || (attempt.isFirstAttempt ? "Counted" : "Practice")}</strong>
        </article>
        <article className="review-summary-card">
          <span>Time Taken</span>
          <strong>{formatDuration(attempt.timeTaken)}</strong>
        </article>
      </section>

      {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}

      <section className="card review-ai-panel review-ai-dashboard-panel">
        <div className="section-head">
          <h3>AI Performance Analysis</h3>
          <div className="review-ai-head-meta">
            {analysis?.source ? (
              <span className="review-analysis-source source-groq">AI</span>
            ) : null}
            {analysis?.generatedAt ? <span className="dashboard-inline-hint">Generated {new Date(analysis.generatedAt).toLocaleString()}</span> : null}
          </div>
        </div>

        {analysisLoading ? <p className="muted-text">Generating personalized analysis...</p> : null}
        {!analysisLoading && analysis ? (
          <div className="review-ai-dashboard-content">
            <article className="review-ai-card review-ai-summary-dashboard-card">
              <h4>Summary</h4>
              <p className="analysis-ai-report">{analysis.summary}</p>
            </article>
            <div className="review-ai-analytics-grid">
              <article className="review-ai-card review-ai-card-strength">
                <h4 className="review-ai-card-title review-ai-card-title-strength">
                  <span aria-hidden>+</span>
                  <span>Strengths</span>
                </h4>
                <ul className="review-ai-list">
                  {(analysis.strengths || []).map((item, index) => (
                    <li key={`strength-${index}`}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="review-ai-card review-ai-card-weakness">
                <h4 className="review-ai-card-title review-ai-card-title-weakness">
                  <span aria-hidden>!</span>
                  <span>Weaknesses</span>
                </h4>
                <ul className="review-ai-list">
                  {(analysis.weaknesses || []).map((item, index) => (
                    <li key={`weakness-${index}`}>{item}</li>
                  ))}
                </ul>
              </article>
              {hasMistakeAnalysis ? (
                <article className="review-ai-card review-ai-card-mistakes">
                  <h4>Mistake Analysis</h4>
                  <ul className="review-ai-list">
                    {(analysis.mistakeAnalysis || []).map((item, index) => (
                      <li key={`mistake-analysis-${index}`}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {hasTimeAnalysis ? (
                <article className="review-ai-card review-ai-time-card">
                  <h4>Time Analysis</h4>
                  <div className="review-time-stat-row">
                    <span>
                      <small>Time Taken</small>
                      <strong>{formatDuration(attempt.timeTaken)}</strong>
                    </span>
                    <span>
                      <small>Score</small>
                      <strong>{formatScore(attempt)}</strong>
                    </span>
                  </div>
                  <p className="analysis-ai-report">{analysis.timeAnalysis}</p>
                </article>
              ) : null}
            </div>
            <div className="review-ai-strategy-grid">
              {hasImprovementStrategy ? (
                <article className="review-ai-card review-ai-scroll-card">
                  <h4>Improvement Strategy</h4>
                  <ul className="review-ai-list">
                    {(analysis.improvementStrategy || []).map((item, index) => (
                      <li key={`improvement-strategy-${index}`}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {hasNextTestFocus ? (
                <article className="review-ai-card review-ai-scroll-card">
                  <h4>Next Test Focus</h4>
                  <ul className="review-ai-list">
                    {(analysis.nextTestFocus || []).map((item, index) => (
                      <li key={`next-test-focus-${index}`}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </div>
          </div>
        ) : null}
        {!analysisLoading && !analysis && analysisError ? <p className="muted-text">{analysisError}</p> : null}
      </section>

      <section className="review-list">
        {(attempt.questions || []).map((question, index) => (
          <article className="review-question-card" key={question.questionId || `${attempt.id}-${index}`}>
            {(() => {
              const explainId = getQuestionExplainId(question, index);
              const explanationEntry = explanations[explainId];

              return (
                <>
            <div className="review-question-head">
              <div>
                <p className="review-question-kicker">Question {index + 1}</p>
                <h3>{question.title}</h3>
                {codingAttempt && question.problemStatement ? <p className="muted-text">{question.problemStatement}</p> : null}
              </div>
              <span className={`review-verdict ${getVerdictClassName(question.verdict)}`}>{question.verdict}</span>
            </div>

            <section className="review-metrics-grid">
              {codingAttempt ? (
                <div className="review-metric">
                  <span>Language</span>
                  <strong>{question.language || "-"}</strong>
                </div>
              ) : null}
              <div className="review-metric">
                <span>{codingAttempt ? "Passed" : "Result"}</span>
                <strong>
                  {codingAttempt
                    ? `${Number(question.passedTestCases || 0)}/${Number(question.totalTestCases || 0)}`
                    : question.verdict}
                </strong>
              </div>
              <div className="review-metric">
                <span>Marks</span>
                <strong>
                  {Number(question.marksObtained || 0)}/{Number(question.maxMarks || 0)}
                </strong>
              </div>
            </section>

            <section className="review-answer-block">
              <button
                type="button"
                className="topbar-logout attempt-review-btn"
                onClick={() => handleExplain(question, index, codingAttempt)}
                disabled={loadingId === explainId}
              >
                {loadingId === explainId ? "Explaining..." : "Explain"}
              </button>
              {loadingId === explainId ? (
                <p className="muted-text">Generating explanation...</p>
              ) : null}
              {!codingAttempt && explanationEntry?.content ? (
                <div className="review-ai-card review-ai-card-full">
                  <h4>Explanation</h4>
                  <p>{explanationEntry.content}</p>
                </div>
              ) : null}
            </section>

            {!codingAttempt ? (
              <section className="review-answer-block">
                <div className={`review-answer-row ${question.verdict === "Accepted" ? "answer-correct" : "answer-wrong"}`}>
                  <span>Your Answer</span>
                  <strong>{question.userAnswer || "Not Answered"}</strong>
                </div>
                <div className="review-answer-row answer-correct">
                  <span>Correct Answer</span>
                  <strong>{question.correctAnswer || "-"}</strong>
                </div>
              </section>
            ) : null}

            {codingAttempt && (question.code || explanationEntry?.type === "code") ? (
              <section className="review-code-block">
                <div className="section-head">
                  <h4>Your Code</h4>
                </div>
                <pre>{question.code || "No code submitted."}</pre>
                {explanationEntry?.type === "code" && explanationEntry?.content ? (
                  <>
                    <div className="section-head">
                      <h4>Optimal Solution</h4>
                    </div>
                    <pre>{explanationEntry.content}</pre>
                  </>
                ) : null}
              </section>
            ) : null}

            {codingAttempt && Array.isArray(question.cases) && question.cases.length > 0 ? (
              <section className="review-cases-wrap">
                <div className="section-head">
                  <h4>Testcase Review</h4>
                </div>
                <div className="review-cases-grid">
                  {question.cases.map((caseItem, caseIndex) => (
                    <article
                      className={`review-case-card ${caseItem?.passed ? "passed" : "failed"}`}
                      key={`${question.questionId || index}-case-${caseIndex}`}
                    >
                      <div className="review-case-head">
                        <strong>Case {caseIndex + 1}</strong>
                        <span>{caseItem?.passed ? "Passed" : "Failed"}</span>
                      </div>
                      {caseItem?.input ? (
                        <div className="review-case-section">
                          <span>Input</span>
                          <pre>{caseItem.input}</pre>
                        </div>
                      ) : null}
                      <div className="review-case-section">
                        <span>Expected Output</span>
                        <pre>{caseItem?.expectedOutput || "-"}</pre>
                      </div>
                      <div className="review-case-section">
                        <span>Your Output</span>
                        <pre>{caseItem?.actualOutput || caseItem?.stderr || caseItem?.compileOutput || "-"}</pre>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
                </>
              );
            })()}
          </article>
        ))}
      </section>
    </div>
  );
};

export default AttemptReview;
