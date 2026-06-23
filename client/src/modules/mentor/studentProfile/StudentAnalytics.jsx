import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiService from "../../../api/apiService";
import StudentOverviewLayout from "../../../components/student/StudentOverviewLayout";
import { buildStudentOverviewFromMentorDetail } from "../../../utils/studentOverview";
import "../../../styles/mentor-students.css";

const asList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const getInsightText = (item) =>
  typeof item === "string" ? item : item?.topic || item?.title || item?.text || item?.recommendation || "";

const InsightCard = ({ title, items, variant = "default" }) => {
  const normalizedItems = asList(items).map(getInsightText).filter(Boolean).slice(0, 5);

  return (
    <article className={`mentor-ai-card mentor-ai-card--${variant}`}>
      <h4>{title}</h4>
      {normalizedItems.length > 0 ? (
        <div className="mentor-ai-chip-list">
          {normalizedItems.map((item, index) => (
            <span className="mentor-ai-chip" key={`${title}-${index}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted-text">No insight available yet.</p>
      )}
    </article>
  );
};

const SummaryCard = ({ summary, generatedAt }) => (
  <article className="mentor-ai-card mentor-ai-card--summary">
    <div className="mentor-ai-summary-head">
      <span className="mentor-ai-badge">AI</span>
      <div>
        <h4>Performance Summary</h4>
        <span>{generatedAt ? `Generated ${new Date(generatedAt).toLocaleDateString()}` : "Live performance context"}</span>
      </div>
    </div>
    <p>{summary || "No AI performance summary has been generated yet."}</p>
  </article>
);

const HeaderMetric = ({ label, value }) => (
  <span className="mentor-profile-metric">
    <small>{label}</small>
    <strong>{value || "-"}</strong>
  </span>
);

const StudentAnalytics = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStudentProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiService.getMentorStudentDetail(studentId);
      setDetail(data || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load student profile.");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchStudentProfile();
    } else {
      setLoading(false);
      setError("Invalid student id.");
    }
  }, [fetchStudentProfile, studentId]);

  const overview = useMemo(() => buildStudentOverviewFromMentorDetail(detail), [detail]);
  const profile = detail?.profile || {};
  const aiInsights = detail?.aiInsights || {};

  if (loading) {
    return (
      <section className="card">
        <p className="muted-text">Loading student analytics...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <p className="dashboard-inline-hint error-text">{error}</p>
        <button type="button" className="topbar-logout" onClick={() => navigate("/mentor/students")}>
          Back to Students
        </button>
      </section>
    );
  }

  return (
    <div className="student-dashboard mentor-student-details">
      <section className="dashboard-header mentor-student-details__header">
        <div className="mentor-profile-header-main">
          <div>
            <h2>{profile?.name || "Student Analytics"}</h2>
            <p>{profile?.email || "-"}</p>
          </div>
          <button
            type="button"
            className="auth-button mentor-detail-btn"
            onClick={() => navigate(`/mentor/student/${studentId}/feedback`)}
          >
            Give Feedback
          </button>
        </div>
        <div className="mentor-profile-metrics">
          <HeaderMetric label="Branch" value={profile?.branch} />
          <HeaderMetric label="Year" value={profile?.year} />
          <HeaderMetric label="CGPA" value={profile?.cgpa} />
          <HeaderMetric label="Mentor Sincerity" value={`${profile?.mentorFeedback?.sincerityScore ?? "-"}/10`} />
        </div>
        <div className="mentor-action-row">
          <span className="dashboard-inline-hint">{overview?.academicInfo?.requestSummary || "Mentor review available."}</span>
        </div>
      </section>

      <section className="card mentor-ai-section">
        <div className="section-head mentor-ai-section-head">
          <div>
            <h3>AI Analytics & Insights</h3>
            <p className="mentor-section-copy">Focused performance signals for this assigned student.</p>
          </div>
        </div>

        <div className="mentor-ai-dashboard-grid">
          <SummaryCard
            summary={aiInsights?.performanceSummary || aiInsights?.summary}
            generatedAt={aiInsights?.generatedAt}
          />
          <InsightCard title="Strengths" items={aiInsights?.strengths} variant="strengths" />
          <InsightCard title="Weaknesses" items={aiInsights?.weaknesses} variant="weaknesses" />
        </div>
      </section>

      <StudentOverviewLayout
        wrapperClassName="mentor-student-view__overview"
        overview={overview}
        preparationValues={overview?.preparationProfile}
        preparationReadOnly
        showProfileSections={false}
        renderAttemptActions={(attempt) => (
          <td className="student-overview__attempt-action-cell">
            <button
              type="button"
              className="student-overview__attempt-action student-overview__attempt-action--analysis"
              onClick={() => navigate(`/mentor/student/${studentId}/attempt/${attempt.id}`)}
            >
              View Analysis
            </button>
          </td>
        )}
      />
    </div>
  );
};

export default StudentAnalytics;
