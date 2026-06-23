import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDuration } from "../../../utils/timeFormat";

const getResultStorageKey = (testId) => `student_test_result_${testId}`;

const TestResult = () => {
  const { testId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [resultLoading, setResultLoading] = useState(true);
  const [resultError, setResultError] = useState("");
  const testMeta = location?.state?.testMeta || null;

  useEffect(() => {
    const resolveResult = async () => {
      if (!testId) {
        navigate("/student/mock-tests", { replace: true });
        return;
      }

      try {
        setResultLoading(true);
        setResultError("");

        const stateResult = location?.state?.result || null;
        if (stateResult) {
          const enrichedResult = testMeta ? { ...stateResult, _testMeta: testMeta } : stateResult;
          setResult(enrichedResult);
          localStorage.setItem(getResultStorageKey(testId), JSON.stringify(enrichedResult));
          return;
        }

        const storedRaw = localStorage.getItem(getResultStorageKey(testId));
        if (storedRaw) {
          try {
            const stored = JSON.parse(storedRaw);
            if (stored) {
              setResult(stored);
              return;
            }
          } catch (parseError) {
            localStorage.removeItem(getResultStorageKey(testId));
          }
        }

        setResultError("No result found for this test session.");
      } catch (requestError) {
        setResultError("Unable to load result right now.");
      } finally {
        setResultLoading(false);
      }
    };

    resolveResult();
  }, [location?.state?.result, navigate, testId]);

  if (resultLoading) {
    return (
      <section className="card">
        <h2>Test Result</h2>
        <p className="muted-text">Loading result...</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="card">
        <h2>Test Result</h2>
        <p className="muted-text">{resultError || "No result found for this test session."}</p>
        <button type="button" className="auth-button" onClick={() => navigate("/student/mock-tests")}>
          Back to Test List
        </button>
      </section>
    );
  }

  const score = Number(result?.score) || 0;
  const totalScore = Number(result?.totalScore);
  const maxScore = Number(result?.maxScore);
  const percentage = Number(result?.percentage ?? score) || 0;
  const passingPercentage = Number(result?.passingPercentage) || 50;
  const accuracy = percentage.toFixed(2);
  const passStatus = result?.status || (percentage >= passingPercentage ? "Pass" : "Fail");
  const timeTaken = formatDuration(result?.timeTaken ?? result?.takenSeconds);
  const effectiveTestMeta = testMeta || result?._testMeta || null;
  const questionWiseResults = Array.isArray(result?.questionWiseResults) ? result.questionWiseResults : [];

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Test Result</h2>
        <p>Submission summary and your current outcome.</p>
      </section>

      <section className="result-grid">
        <article className="result-item">
          <strong>Total Score</strong>
          <p>
            {Number.isFinite(totalScore) && Number.isFinite(maxScore) ? `${totalScore}/${maxScore}` : `${score.toFixed(2)}%`}
          </p>
        </article>
        <article className="result-item">
          <strong>Accuracy</strong>
          <p>{accuracy}%</p>
        </article>
        <article className="result-item">
          <strong>Passing Criteria</strong>
          <p>{passingPercentage.toFixed(2)}%</p>
        </article>
        <article className="result-item">
          <strong>Time Taken</strong>
          <p>{timeTaken}</p>
        </article>
        <article className="result-item">
          <strong>Status</strong>
          <p className={passStatus === "Pass" ? "status-pass" : "status-fail"}>{passStatus}</p>
        </article>
      </section>

      {questionWiseResults.length > 0 ? (
        <section className="card">
          <h3>Question-wise Performance</h3>
          <ul className="weak-topic-list">
            {questionWiseResults.map((item, index) => (
              <li className="weak-topic-item" key={`${item?.questionId || index}`}>
                <span>{item?.problemStatement || `Question ${index + 1}`}</span>
                <span className="score-chip">
                  {Number(item?.marks || 0)}/{Number(item?.maxMarks || 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h3>Session Details</h3>
        {effectiveTestMeta?.title ? (
          <p>
            <strong>Test Name:</strong> {effectiveTestMeta.title}
          </p>
        ) : null}
        <p>
          <strong>Submitted At:</strong>{" "}
          {result?.takenAt ? new Date(result.takenAt).toLocaleString() : new Date().toLocaleString()}
        </p>
        {result?.autoSubmitted ? (
          <p className="dashboard-inline-hint">This test was auto-submitted after timer expiry.</p>
        ) : null}
      </section>

      <section className="test-actions-row">
        <button type="button" className="topbar-logout" onClick={() => navigate(`/student/test/${testId}`)}>
          Retake Test
        </button>
        <button
          type="button"
          className="auth-button"
          onClick={() =>
            navigate(`/student/test/${testId}/analysis`, {
              state: {
                result,
                testMeta: effectiveTestMeta
              }
            })
          }
        >
          View Detailed Analysis
        </button>
      </section>
    </div>
  );
};

export default TestResult;
