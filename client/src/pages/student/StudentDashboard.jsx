import { useEffect, useMemo, useState } from "react";
import apiService from "../../api/apiService";
import StudentStatCard from "../../components/dashboard/StudentStatCard";
import RecommendationCard from "../../components/dashboard/RecommendationCard";
import FeedbackCard from "../../components/dashboard/FeedbackCard";
import SectionCard from "../../components/dashboard/SectionCard";
import { useAuth } from "../../context/AuthContext";
import { formatDuration } from "../../utils/timeFormat";
import "../../styles/student-dashboard.css";

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const StudentDashboard = () => {
  const { userName, setUserProfile } = useAuth();
  const [user, setUser] = useState({ name: userName || "Student", role: "student" });
  const [analytics, setAnalytics] = useState({
    overallAverage: 0,
    codingAverage: 0,
    totalTests: 0,
    cgpa: null,
    sincerity: { sincerityScore: 0 },
    latestAttempt: null,
    subjectBreakdown: [],
    quickRecommendations: []
  });
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [analyticsResult, dashboardResult, userResult, feedbackResult] = await Promise.allSettled([
          apiService.getStudentAnalytics(),
          apiService.getStudentDashboard(),
          apiService.getCurrentUser(),
          apiService.getStudentFeedback()
        ]);

        const nextAnalytics = {};

        if (analyticsResult.status === "fulfilled") {
          Object.assign(nextAnalytics, analyticsResult.value || {});
          setError(false);
        } else {
          setError(true);
        }

        if (dashboardResult.status === "fulfilled") {
          const dashboardData = dashboardResult.value || {};
          nextAnalytics.cgpa = dashboardData?.cgpa ?? nextAnalytics.cgpa ?? null;
        }

        if (Object.keys(nextAnalytics).length > 0) {
          setAnalytics((prev) => ({ ...prev, ...nextAnalytics }));
        }

        if (userResult.status === "fulfilled") {
          const profile = userResult.value || {};
          const nextUser = {
            name: profile?.name || userName || "Student",
            role: profile?.role || "student"
          };
          setUser(nextUser);
          setUserProfile(nextUser);
        }

        if (feedbackResult.status === "fulfilled") {
          setFeedback(Array.isArray(feedbackResult.value?.feedback) ? feedbackResult.value.feedback : []);
        } else {
          setFeedback([]);
        }
      } catch (requestError) {
        console.error("Analytics fetch failed:", requestError);
        setError(true);
        setFeedback([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [setUserProfile, userName]);

  const sincerity = analytics?.sincerity || {};
  const totalTestsRaw = toNumber(analytics?.totalTests);

  const overallAverage = toNumber(analytics?.overallAverage).toFixed(1);
  const codingAverage = toNumber(analytics?.codingAverage).toFixed(1);
  const totalTests = totalTestsRaw;
  const sincerityScore = Math.round(toNumber(sincerity?.sincerityScore));
  const rawCgpa = analytics?.cgpa;
  const hasCgpa = rawCgpa !== null && rawCgpa !== undefined && Number.isFinite(Number(rawCgpa));
  const cgpaValue = hasCgpa ? `${Number(rawCgpa).toFixed(1)} / 10` : "-";

  const quickRecommendations = useMemo(() => {
    const recommendations = Array.isArray(analytics?.quickRecommendations)
      ? analytics.quickRecommendations
      : [];
    return recommendations.slice(0, 2);
  }, [analytics]);

  const latestAttempt = analytics?.latestAttempt || null;
  const latestFeedback = useMemo(() => feedback.slice(0, 3), [feedback]);
  const latestAttemptScore = toNumber(latestAttempt?.score);
  const latestAttemptStatus = latestAttemptScore >= 60 ? "On track" : "Needs focus";
  const latestAttemptStatusClass = latestAttemptScore >= 60 ? "good" : "attention";
  const statCards = useMemo(
    () => [
      { title: "Overall Average", value: `${overallAverage}%`, accent: "overall", helper: "Across counted tests" },
      { title: "Coding Average", value: `${codingAverage}%`, accent: "coding", helper: "Hands-on performance" },
      { title: "Tests Attempted", value: `${totalTests}`, accent: "tests", helper: "Completed attempts" },
      { title: "Sincerity Score", value: `${sincerityScore}/100`, accent: "sincerity", helper: "Consistency signal" },
      { title: "CGPA", value: cgpaValue, accent: "cgpa", helper: hasCgpa ? "Academic standing" : "Awaiting update" }
    ],
    [cgpaValue, codingAverage, hasCgpa, overallAverage, sincerityScore, totalTests]
  );
  return (
    <div className="student-dashboard student-dashboard-screen student-dashboard-saas">
      <section className="dashboard-header dashboard-header-screen dashboard-hero-panel">
        <p className="dashboard-page-title">Dashboard</p>
        <h2>Welcome, {user.name}</h2>
        <p>Track your placement prep, latest performance signals, and mentor guidance in one compact workspace.</p>
        {user?.role ? <span className="score-chip">{user.role}</span> : null}
        {loading ? <span className="dashboard-inline-hint">Loading dashboard...</span> : null}
        {!loading && error ? (
          <span className="dashboard-inline-hint error-text">
            Data unavailable right now. Showing the latest available values.
          </span>
        ) : null}
      </section>

      <section className="stats-grid stats-grid-screen student-stats-row">
        {statCards.map((card) => (
          <StudentStatCard
            key={card.title}
            title={card.title}
            value={card.value}
            accent={card.accent}
            helper={card.helper}
          />
        ))}
      </section>

      <section className="dashboard-main-grid dashboard-main-grid-saas">
        <SectionCard
          title="Latest Test Attempt"
          badge="Recent activity"
          className="card dashboard-compact-card dashboard-screen-panel dashboard-screen-panel-left dashboard-primary-column"
        >
          <div className="dashboard-screen-panel-body">
            {!latestAttempt ? (
              <p className="muted-text">No attempts yet. Start a mock test to generate dashboard insights.</p>
            ) : (
              <div className="dashboard-attempt-card">
                <div className="dashboard-attempt-top">
                  <div className="dashboard-attempt-main">
                    <p className="dashboard-attempt-title">{latestAttempt?.testName || "Test"}</p>
                    <p className="dashboard-attempt-subtitle">
                      {latestAttempt?.date ? new Date(latestAttempt.date).toLocaleDateString() : "Date unavailable"}
                    </p>
                  </div>
                  <span className={`dashboard-status-pill ${latestAttemptStatusClass}`}>{latestAttemptStatus}</span>
                </div>
                <div className="dashboard-attempt-metrics">
                  <div className="dashboard-attempt-badge">
                    <span>Score</span>
                    <strong>{latestAttemptScore.toFixed(1)}%</strong>
                  </div>
                  <div className="dashboard-attempt-badge">
                    <span>Questions</span>
                    <strong>{toNumber(latestAttempt?.correctAnswers)}/{toNumber(latestAttempt?.totalQuestions)}</strong>
                  </div>
                  <div className="dashboard-attempt-badge">
                    <span>Time Taken</span>
                    <strong>{formatDuration(latestAttempt?.timeTaken)}</strong>
                  </div>
                  <div className="dashboard-attempt-badge">
                    <span>Confidence</span>
                    <strong>{latestAttemptScore >= 75 ? "High" : latestAttemptScore >= 50 ? "Steady" : "Recover"}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Quick Recommendations"
          badge="Top 2"
          className="card recommendation-panel dashboard-compact-card dashboard-screen-panel dashboard-screen-panel-right dashboard-secondary-column"
        >
          <div className="dashboard-screen-panel-body dashboard-recommendations-scroll">
            <div className="recommendation-head">
              <p className="muted-text">Focused next steps from your most recent performance signals.</p>
            </div>
            {quickRecommendations.length === 0 ? (
              <p className="muted-text">Attempt more tests to unlock recommendations.</p>
            ) : (
              <div className="recommendation-list recommendation-list-v2">
                {quickRecommendations.map((text, index) => (
                  <RecommendationCard key={`recommendation-${index}`} index={index} text={text} />
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Mentor Feedback"
        badge="Latest 3"
        className="card dashboard-compact-card dashboard-feedback-row dashboard-feedback-carousel-shell"
      >
        <div className="dashboard-feedback-body">
          {latestFeedback.length === 0 ? (
            <p className="muted-text">No feedback yet.</p>
          ) : (
            <div className="student-feedback-grid student-feedback-grid-screen">
              {latestFeedback.map((item) => (
                <FeedbackCard feedback={item} key={item.id} />
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default StudentDashboard;
