import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiService from "../../../api/apiService";
import "../../../styles/mentor-students.css";
import { formatDuration } from "../../../utils/timeFormat";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "-";
};

const getAttemptCategory = (attempt, analysis) => {
  const value = String(analysis?.category || analysis?.testType || attempt?.type || attempt?.subject || "").toLowerCase();
  if (value.includes("coding")) return "Coding";
  if (value.includes("aptitude")) return "Aptitude";
  return "Technical";
};

const getAnalysisTitle = (category) => {
  if (category === "Coding") return "Coding Performance Analysis";
  if (category === "Aptitude") return "Aptitude Test Analysis";
  return "Technical Test Analysis";
};

const getResultLabel = (question) => {
  const verdict = String(question?.verdict || "").toLowerCase();
  return verdict === "accepted" || question?.isCorrect ? "Correct" : "Wrong";
};

const isCorrectResponse = (question) => getResultLabel(question) === "Correct";

const getQuestionKey = (question, index) => question?.questionId || `question-${index}`;

const InsightList = ({ title, items }) => (
  <article className="review-ai-card">
    <h4>{title}</h4>
    {Array.isArray(items) && items.length > 0 ? (
      <ul className="review-ai-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    ) : null}
  </article>
);

const MentorAttemptReview = () => {
  const { studentId, attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [expandedResponses, setExpandedResponses] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [attemptResponse, analysisResponse] = await Promise.allSettled([
        apiService.getMentorStudentAttemptResult(studentId, attemptId),
        apiService.getMentorStudentAttemptAnalysis(studentId, attemptId)
      ]);

      if (attemptResponse.status === "fulfilled") {
        setAttempt(attemptResponse.value?.attempt || null);
        setExpandedResponses(new Set());
      } else {
        throw attemptResponse.reason;
      }

      if (analysisResponse.status === "fulfilled") {
        setAnalysis(analysisResponse.value?.analysis || null);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load attempt analysis.");
      setAttempt(null);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [attemptId, studentId]);

  useEffect(() => {
    if (studentId && attemptId) {
      loadReview();
    } else {
      setLoading(false);
      setError("Invalid review link.");
    }
  }, [attemptId, loadReview, studentId]);

  if (loading) {
    return (
      <section className="card">
        <p className="muted-text">Loading attempt analysis...</p>
      </section>
    );
  }

  if (!attempt) {
    return (
      <section className="card">
        <p className="dashboard-inline-hint error-text">{error || "Attempt not found."}</p>
        <button type="button" className="topbar-logout review-back-btn" onClick={() => navigate(`/mentor/student/${studentId}`)}>
          Back to Student
        </button>
      </section>
    );
  }

  const category = getAttemptCategory(attempt, analysis);
  const analysisCards = Array.isArray(analysis?.cards)
    ? analysis.cards.filter((card) => Array.isArray(card?.items) && card.items.length > 0)
    : [];
  const questions = Array.isArray(attempt?.questions) ? attempt.questions : [];
  const isCodingAttempt = category === "Coding";
  const allResponseKeys = questions.map(getQuestionKey);
  const allResponsesExpanded = questions.length > 0 && allResponseKeys.every((key) => expandedResponses.has(key));

  const toggleResponse = (key) => {
    setExpandedResponses((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAllResponses = () => {
    setExpandedResponses(new Set(allResponseKeys));
  };

  const collapseAllResponses = () => {
    setExpandedResponses(new Set());
  };

  return (
    <div className="student-dashboard mentor-attempt-review-page">
      <section className="dashboard-header review-hero">
        <div>
          <h2>{getAnalysisTitle(category)}</h2>
          <p>{attempt.testName} | Attempt-specific {category.toLowerCase()} insights only.</p>
        </div>
        <button type="button" className="topbar-logout review-back-btn" onClick={() => navigate(`/mentor/student/${studentId}`)}>
          Back to Student
        </button>
      </section>

      {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}

      <section className="review-summary-grid mentor-attempt-meta-grid">
        <article className="review-summary-card">
          <span>Test Name</span>
          <strong>{attempt.testName || "-"}</strong>
        </article>
        <article className="review-summary-card">
          <span>Test Type</span>
          <strong>{attempt.type || category}</strong>
        </article>
        <article className="review-summary-card">
          <span>Difficulty</span>
          <strong>{attempt.difficulty || "Standard"}</strong>
        </article>
        <article className="review-summary-card">
          <span>Score</span>
          <strong>
            {attempt.totalScore !== null && attempt.maxScore !== null
              ? `${toNumber(attempt.totalScore)}/${toNumber(attempt.maxScore)}`
              : `${toNumber(attempt.percentage).toFixed(1)}%`}
          </strong>
        </article>
        <article className="review-summary-card">
          <span>Status</span>
          <strong>{attempt.attemptMode || "Completed"}</strong>
        </article>
        <article className="review-summary-card">
          <span>Attempt Date</span>
          <strong>{formatDate(attempt.submittedAt)}</strong>
        </article>
        <article className="review-summary-card">
          <span>Duration</span>
          <strong>{formatDuration(attempt.timeTaken)}</strong>
        </article>
        <article className="review-summary-card">
          <span>AI Generated</span>
          <strong>{analysis?.generatedAt ? formatDate(analysis.generatedAt) : "-"}</strong>
        </article>
      </section>

      <section className="card review-ai-panel review-ai-panel--focused">
        <div className="section-head">
          <h3>{getAnalysisTitle(category)}</h3>
          {analysis?.generatedAt ? <span className="dashboard-inline-hint">Generated {formatDate(analysis.generatedAt)}</span> : null}
        </div>
        {analysis ? (
          <div className="review-ai-grid">
            <article className="review-ai-card review-ai-card-full">
              <h4>{category} Performance Summary</h4>
              <p>{analysis.summary || analysis.performanceSummary || "No AI feedback available for this attempt."}</p>
            </article>
            {analysisCards.map((card) => (
              <InsightList key={card.title} title={card.title} items={card.items} />
            ))}
          </div>
        ) : (
          <p className="muted-text">AI analysis is not available for this attempt.</p>
        )}
      </section>

      <section className="card mentor-response-section">
        <div className="section-head">
          <div>
            <h3>Student Responses</h3>
            <p className="mentor-section-copy">
              {isCodingAttempt ? "Submitted code, execution results, and case outcomes." : "Question-wise answers with selected and correct options."}
            </p>
          </div>
          <div className="mentor-response-tools">
            <span className="score-chip">{questions.length} questions</span>
            {questions.length > 0 ? (
              <>
                <button type="button" className="mentor-response-tool-btn" onClick={expandAllResponses} disabled={allResponsesExpanded}>
                  Expand All
                </button>
                <button type="button" className="mentor-response-tool-btn" onClick={collapseAllResponses} disabled={expandedResponses.size === 0}>
                  Collapse All
                </button>
              </>
            ) : null}
          </div>
        </div>

        {questions.length === 0 ? (
          <p className="muted-text">No student responses are available for this attempt.</p>
        ) : (
          <div className="mentor-response-accordion">
            {questions.map((question, index) => {
              const questionKey = getQuestionKey(question, index);
              const isExpanded = expandedResponses.has(questionKey);

              return (
                <article className={`mentor-response-card${isExpanded ? " is-expanded" : ""}`} key={questionKey}>
                  <button
                    type="button"
                    className="mentor-response-summary"
                    aria-expanded={isExpanded}
                    onClick={() => toggleResponse(questionKey)}
                  >
                    <span className="mentor-response-question-number">Question {index + 1}</span>
                    <span className="mentor-response-preview">{question.title || question.problemStatement || "Question unavailable"}</span>
                    <em className={`mentor-result-badge ${getResultLabel(question).toLowerCase()}`}>{getResultLabel(question)}</em>
                    <span className="mentor-response-arrow" aria-hidden="true">v</span>
                  </button>

                  <div className="mentor-response-panel">
                    <div className="mentor-response-panel-inner">
                      {isCodingAttempt ? (
                        <div className="mentor-coding-response">
                          <div className="mentor-response-block">
                            <h4>Problem Statement</h4>
                            <p>{question.problemStatement || question.title || "Problem statement unavailable."}</p>
                          </div>

                          <div className="mentor-code-meta">
                            <span>Language: <strong>{question.language || "-"}</strong></span>
                            <span>Passed: <strong>{toNumber(question.passedTestCases)}/{toNumber(question.totalTestCases)}</strong></span>
                            <span>Failed: <strong>{Math.max(0, toNumber(question.totalTestCases) - toNumber(question.passedTestCases))}</strong></span>
                            <span>Result: <strong>{question.verdict || "-"}</strong></span>
                          </div>

                          <div className="mentor-response-block">
                            <h4>Submitted Code</h4>
                            <pre className="mentor-code-block"><code>{question.code || "No code submitted."}</code></pre>
                          </div>

                          {Array.isArray(question.cases) && question.cases.length > 0 ? (
                            <div className="mentor-case-grid">
                              {question.cases.map((caseItem, caseIndex) => (
                                <article className={`mentor-case-card ${caseItem?.passed ? "passed" : "failed"}`} key={`${question.questionId}-${caseIndex}`}>
                                  <div>
                                    <strong>Case {caseIndex + 1}</strong>
                                    <span>{caseItem?.passed ? "Passed" : "Failed"}</span>
                                  </div>
                                  {caseItem?.input ? <pre>Input: {caseItem.input}</pre> : null}
                                  <pre>Expected: {caseItem?.expectedOutput || "-"}</pre>
                                  <pre>Output: {caseItem?.actualOutput || caseItem?.stderr || caseItem?.compileOutput || "-"}</pre>
                                </article>
                              ))}
                            </div>
                          ) : null}

                        </div>
                      ) : (
                        <div className="mentor-mcq-response">
                          <p className="mentor-question-text">{question.title}</p>
                          {isCorrectResponse(question) ? (
                            <div className="mentor-answer-grid mentor-answer-grid--single">
                              <div className="mentor-answer-card is-correct">
                                <span>Selected &amp; Correct Answer</span>
                                <strong>{question.userAnswer || question.correctAnswer || "Not Answered"}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="mentor-answer-grid">
                              <div className="mentor-answer-card is-wrong">
                                <span>Selected Answer</span>
                                <strong>{question.userAnswer || "Not Answered"}</strong>
                              </div>
                              <div className="mentor-answer-card is-correct">
                                <span>Correct Answer</span>
                                <strong>{question.correctAnswer || "-"}</strong>
                              </div>
                            </div>
                          )}
                          {question.explanation ? (
                            <div className="mentor-response-block">
                              <h4>Explanation / Insight</h4>
                              <p>{question.explanation}</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MentorAttemptReview;

