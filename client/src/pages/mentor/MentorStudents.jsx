import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import apiService from "../../api/apiService";
import { MENTOR_DATA_UPDATED_EVENT } from "../../utils/mentorEvents";
import "../../styles/mentor-students.css";

const formatScore = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return Number(value).toFixed(1);
};

const getPlacementBadgeText = (placementStatus) => {
  const status = String(placementStatus?.status || "not_applied").toLowerCase();
  if (status === "placed") {
    return `Placed at ${placementStatus?.companyName || "Company"}`;
  }
  if (status === "applied") return "Applied";
  return "Not Applied";
};

const getPlacementBadgeClass = (placementStatus) => {
  const status = String(placementStatus?.status || "not_applied").toLowerCase();
  return `mentor-students__badge mentor-students__badge--placement status-${status}`;
};

const getPlacementIcon = (placementStatus) => {
  const status = String(placementStatus?.status || "not_applied").toLowerCase();
  if (status === "placed") return "*";
  if (status === "applied") return "*";
  return "";
};

const getPlacementSummary = (placementStatus) => {
  const status = String(placementStatus?.status || "not_applied").toLowerCase();
  const companyName = String(placementStatus?.companyName || "").trim();
  const role = String(placementStatus?.role || "").trim();
  const pkg =
    Number.isFinite(Number(placementStatus?.package)) && Number(placementStatus?.package) > 0
      ? `${Number(placementStatus.package).toFixed(1)} LPA`
      : "";

  if (status === "placed") {
    const details = [companyName, role, pkg].filter(Boolean).join(" | ");
    return details ? `Placement: Placed at ${details}` : "Placement: Placed";
  }

  if (status === "applied") {
    return companyName
      ? `Placement: Applied to ${companyName}`
      : "Placement: Applied";
  }

  return "Placement: Not Applied";
};

const MentorStudents = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: ""
  });
  const [data, setData] = useState({
    total: 0,
    filtered: 0,
    students: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const visibleStudents = useMemo(() => data.students, [data.students]);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await apiService.getMentorStudents(filters);
        setData({
          total: Number(response?.total) || 0,
          filtered: Number(response?.filtered) || 0,
          students: Array.isArray(response?.students) ? response.students : []
        });
      } catch (requestError) {
        setError("Unable to load assigned students.");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
    window.addEventListener(MENTOR_DATA_UPDATED_EVENT, fetchStudents);
    return () => window.removeEventListener(MENTOR_DATA_UPDATED_EVENT, fetchStudents);
  }, [filters]);

  return (
    <div className="mentor-students">
      <div className="mentor-students__container">
        <section className="dashboard-header mentor-students__header">
          <h2>Students</h2>
          <p>Review assigned students, search quickly, and open the detailed mentoring page for each learner.</p>
        </section>

        <section className="card mentor-students__filters">
          <div className="mentor-students__filter-grid">
            <label className="mentor-students__filter-field">
              <span>Search</span>
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search by name, email, or branch"
              />
            </label>
          </div>

          <div className="mentor-students__summary">
            <span className="mentor-metric-chip">Total Assigned: {data.total}</span>
            <span className="mentor-metric-chip">Visible: {data.filtered}</span>
          </div>
        </section>

        <section className="card mentor-students__list-shell">
          {loading ? <p className="muted-text">Loading students...</p> : null}
          {!loading && error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
          {!loading && !error && visibleStudents.length === 0 ? (
            <p className="muted-text">No students matched the current filters.</p>
          ) : null}

          {!loading && !error && visibleStudents.length > 0 ? (
            <div className="mentor-students__grid">
              {visibleStudents.map((student) => {
                const studentId = student.studentUserId || student.id || student.userId;
                const weakAreas = (Array.isArray(student.weakAreas) ? student.weakAreas : []).slice(0, 2);
                const placementStatus = student?.placementStatus || {
                  status: "not_applied",
                  companyName: "",
                  role: "",
                  package: null
                };
                const placementIcon = getPlacementIcon(placementStatus);

                return (
                  <article className="mentor-students__card" key={studentId}>
                    <div className="mentor-students__card-content">
                      <div className="mentor-students__card-head">
                        <div className="mentor-students__identity">
                          <h4>{student.name || "Student"}</h4>
                          <p>{student.email || "-"}</p>
                          <p className="mentor-students__card-meta">
                            {student.branch || "-"} | Year {student.year || "-"}
                          </p>
                          <p className="mentor-students__placement-text">
                            {getPlacementSummary(placementStatus)}
                          </p>
                        </div>
                        <div className="mentor-students__badge-group">
                          <span
                            className={`mentor-students__badge ${student?.mentorFeedback?.reviewed ? "is-reviewed" : "is-pending"}`}
                          >
                            {student?.mentorFeedback?.reviewed ? "Reviewed" : "Pending Review"}
                          </span>
                          <span className={getPlacementBadgeClass(placementStatus)}>
                            {placementIcon ? (
                              <span className={`mentor-students__placement-icon status-${placementStatus?.status || "not_applied"}`} aria-hidden>
                                {placementIcon}
                              </span>
                            ) : null}
                            <span>{getPlacementBadgeText(placementStatus)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="mentor-students__metrics">
                        <span className="mentor-metric-chip">Overall: {formatScore(student.overallAverage)}%</span>
                        <span className="mentor-metric-chip">Coding: {formatScore(student.codingAverage)}%</span>
                        <span className="mentor-metric-chip">Tests: {student.totalTests || 0}</span>
                        <span className="mentor-metric-chip">
                          Mentor Score: {student?.mentorFeedback?.sincerityScore ?? "-"}
                        </span>
                      </div>

                      <p className="muted-text mentor-students__focus">
                        {weakAreas.length > 0 ? `Focus: ${weakAreas.join(", ")}` : "Focus: No specific weak areas yet."}
                      </p>
                    </div>

                    <div className="mentor-students__actions">
                      <button
                        type="button"
                        className="primary-button button-flex-1 mentor-students__action-button mentor-students__action-button--primary"
                        onClick={() => navigate(`/mentor/student/${studentId}`)}
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        className="secondary-button button-flex-1 mentor-students__action-button mentor-students__action-button--secondary"
                        onClick={() => navigate(`/mentor/student/${studentId}/feedback`)}
                      >
                        Add Feedback
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default MentorStudents;
