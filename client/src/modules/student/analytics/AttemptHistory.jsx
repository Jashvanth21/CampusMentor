import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../../../api/apiService";
import { formatDuration } from "../../../utils/timeFormat";
import PerformanceTrend from "./PerformanceTrend";

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
};

const toScore = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toSeconds = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const toNonEmptyString = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const getAttemptTitle = (attempt) => {
  const populatedTitle = toNonEmptyString(attempt?.testId?.title);
  if (populatedTitle) return populatedTitle;

  if (attempt?.testId === null) return "Archived Test";

  const legacyTitle = toNonEmptyString(attempt?.title || attempt?.testName);
  return legacyTitle || "Untitled Test";
};

const AttemptHistory = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [summary, setSummary] = useState({
    totalAttempts: 0,
    averageScore: 0,
    latestScore: 0
  });
  const [timeSummary, setTimeSummary] = useState({
    average: null,
    fastest: null,
    slowest: null
  });
  const [performanceTrend, setPerformanceTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await apiService.getStudentAttemptHistory();
        const rawAttempts = Array.isArray(data?.attempts) ? data.attempts : [];
        const mappedAttempts = rawAttempts
          .map((attempt, index) => {
            const attemptedAt = toDate(attempt?.date);
            if (!attemptedAt) return null;

            const score = toScore(attempt?.score);
            const title = getAttemptTitle(attempt);
            return {
              id: attempt?.attemptId || `${title}-${attemptedAt.getTime()}-${index}`,
              title,
              attemptedAt,
              score,
              timeTaken: toSeconds(attempt?.timeTaken),
              type: attempt?.type || "Technical",
              attemptMode: attempt?.attemptMode || "Counted",
              isFirstAttempt: attempt?.isFirstAttempt !== false
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime());

        const trend = Array.isArray(data?.performanceTrend)
          ? data.performanceTrend
              .map((item) => {
                const trendDate = toDate(item?.date);
                if (!trendDate) return null;
                return {
                  attemptedAt: trendDate,
                  score: toScore(item?.score)
                };
              })
              .filter(Boolean)
          : [];

        setSummary({
          totalAttempts: Number(data?.totalAttempts) || 0,
          averageScore: Number(data?.averageScore) || 0,
          latestScore: Number(data?.latestScore) || 0
        });
        const attemptTimes = mappedAttempts
          .map((attempt) => attempt.timeTaken)
          .filter((timeTaken) => timeTaken !== null);
        const totalTime = attemptTimes.reduce((sum, timeTaken) => sum + timeTaken, 0);
        setTimeSummary({
          average: attemptTimes.length > 0 ? totalTime / attemptTimes.length : null,
          fastest: attemptTimes.length > 1 ? Math.min(...attemptTimes) : null,
          slowest: attemptTimes.length > 1 ? Math.max(...attemptTimes) : null
        });
        setAttempts(mappedAttempts);
        setPerformanceTrend(trend);
      } catch (requestError) {
        setError("Unable to load attempt history.");
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();
  }, []);

  const hasAttempts = useMemo(() => attempts.length > 0, [attempts.length]);

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Attempt History</h2>
        <p>Only first attempts affect analytics. Later retakes are marked as practice.</p>
      </section>

      {loading ? <section className="card"><p className="muted-text">Loading attempts...</p></section> : null}
      {!loading && error ? <section className="card"><p className="dashboard-inline-hint error-text">{error}</p></section> : null}

      {!loading && !error ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <p className="stat-label">Total Attempts</p>
              <p className="stat-value">{summary.totalAttempts}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Average Score</p>
              <p className="stat-value">{summary.averageScore.toFixed(2)}%</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Latest Score</p>
              <p className="stat-value">{summary.latestScore.toFixed(2)}%</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Avg Time</p>
              <p className="stat-value">{formatDuration(timeSummary.average)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Fastest</p>
              <p className="stat-value">{formatDuration(timeSummary.fastest)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Slowest</p>
              <p className="stat-value">{formatDuration(timeSummary.slowest)}</p>
            </article>
          </section>
          <PerformanceTrend attempts={performanceTrend} />

          <section className="card">
            <h3>Attempts</h3>
            {!hasAttempts ? <p className="muted-text">No attempts yet.</p> : null}

            {hasAttempts ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Date</th>
                      <th>Score</th>
                      <th>Time Taken</th>
                      <th>Type</th>
                      <th>Mode</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{attempt.title}</td>
                        <td>{attempt.attemptedAt.toLocaleString()}</td>
                        <td>{attempt.score.toFixed(2)}%</td>
                        <td>{formatDuration(attempt.timeTaken)}</td>
                        <td>{attempt.type}</td>
                        <td>
                          <span className={attempt.isFirstAttempt ? "score-chip" : "practice-chip"}>
                            {attempt.attemptMode}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="topbar-logout attempt-review-btn"
                            onClick={() => navigate(`/student/attempt-review/${attempt.id}`)}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default AttemptHistory;
