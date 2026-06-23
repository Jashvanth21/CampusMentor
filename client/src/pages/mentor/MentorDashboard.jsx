import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../../api/apiService";
import { MENTOR_DATA_UPDATED_EVENT } from "../../utils/mentorEvents";
import "../../styles/mentor-dashboard.css";

const formatDateTime = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
};

const getSeverityClassName = (severity) => {
  if (severity === "HIGH") return "severity-high";
  if (severity === "MEDIUM") return "severity-medium";
  return "severity-low";
};

const MentorDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState({
    summary: {
      totalStudents: 0,
      reviewedCount: 0,
      pendingReviews: 0,
      averageScore: 0
    },
    quickStats: [],
    alerts: [],
    message: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const statCards = [
    { label: "Students Tracked", value: dashboard?.summary?.totalStudents ?? 0 },
    { label: "Reviewed", value: dashboard?.summary?.reviewedCount ?? 0 },
    { label: "Pending Reviews", value: dashboard?.summary?.pendingReviews ?? 0 },
    { label: "Average Score", value: dashboard?.summary?.averageScore ?? 0 }
  ];

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await apiService.getMentorDashboard();
        setDashboard({
          summary: response?.summary || {
            totalStudents: 0,
            reviewedCount: 0,
            pendingReviews: 0,
            averageScore: 0
          },
          quickStats: Array.isArray(response?.quickStats) ? response.quickStats : [],
          alerts: Array.isArray(response?.alerts) ? response.alerts : [],
          message: response?.message || ""
        });
      } catch (requestError) {
        setError("Unable to load mentor dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    window.addEventListener(MENTOR_DATA_UPDATED_EVENT, fetchDashboard);
    return () => window.removeEventListener(MENTOR_DATA_UPDATED_EVENT, fetchDashboard);
  }, []);

  return (
    <div className="mentor-dashboard">
      <section className="dashboard-header mentor-dashboard__header">
        <p className="sidebar-eyebrow">Mentor Overview</p>
        <h2>Mentor Dashboard</h2>
        <p>See summary counts, intervention load, and the next students who need attention.</p>
      </section>

      {loading ? (
        <section className="card mentor-dashboard__state">
          <p className="muted-text">Loading summary...</p>
        </section>
      ) : null}
      {!loading && error ? (
        <section className="card mentor-dashboard__state">
          <p className="dashboard-inline-hint error-text">{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <div className="mentor-dashboard__content">
          <section className="stats-grid mentor-dashboard__stats">
            {statCards.map((item) => (
              <article className="stat-card mentor-dashboard__stat-card" key={item.label}>
                <p className="stat-label">{item.label}</p>
                <p className="stat-value">{item.value}</p>
              </article>
            ))}
          </section>

          <section className="card mentor-dashboard__actions-card">
            <div className="section-head">
              <h3>Quick Actions</h3>
              <span className="score-chip">Active mentoring</span>
            </div>
            <div className="mentor-dashboard__actions">
              <button
                type="button"
                className="auth-button mentor-detail-btn mentor-dashboard__action-btn"
                onClick={() => navigate("/mentor/students")}
              >
                Review Students
              </button>
              <button
                type="button"
                className="auth-button mentor-detail-btn mentor-dashboard__action-btn"
                onClick={() => navigate("/mentor/analytics")}
              >
                View Analytics
              </button>
            </div>
            {dashboard?.message ? <p className="muted-text mentor-dashboard__message">{dashboard.message}</p> : null}
          </section>

          <section className="card mentor-dashboard__alerts-card">
            <div className="section-head">
              <h3>Alerts</h3>
              <span className="analytics-topic-pill topic-pill-weak">Smart priorities</span>
            </div>
            <div className="mentor-dashboard__alerts-body">
              {dashboard.alerts.length === 0 ? (
                <p className="muted-text">No urgent mentor alerts right now.</p>
              ) : (
                <div className="mentor-dashboard__alerts-grid">
                  {dashboard.alerts.map((alert) => (
                    <article className="mentor-dashboard__alert-card" key={alert.id}>
                      <div className="mentor-dashboard__alert-main">
                        <div className="mentor-dashboard__alert-head">
                          <div>
                            <h4>{alert.name || "Student"}</h4>
                            <p className="mentor-dashboard__alert-label">{alert.label || "Pending Review"}</p>
                          </div>
                          <span className={`mentor-dashboard__severity ${getSeverityClassName(alert.severity)}`}>
                            {alert.severity || "LOW"}
                          </span>
                        </div>
                        <p className="mentor-dashboard__alert-message">{alert.message || "Needs mentor attention."}</p>
                        <div className="mentor-dashboard__alert-meta">
                          <p>
                            <span>Last activity</span>
                            <strong>{formatDateTime(alert.lastActivity) || "No recent activity"}</strong>
                          </p>
                          <p>
                            <span>Last feedback</span>
                            <strong>{formatDateTime(alert.lastFeedbackDate) || "No feedback yet"}</strong>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="auth-button mentor-detail-btn mentor-dashboard__review-btn"
                        onClick={() => navigate(`/mentor/student/${alert.studentUserId}`)}
                      >
                        Review Student
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default MentorDashboard;
