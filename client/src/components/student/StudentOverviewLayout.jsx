import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import "../../styles/student-overview.css";

const StudentOverviewLayout = ({
  wrapperClassName = "",
  overview,
  preparationValues,
  onPreparationChange,
  preparationReadOnly = true,
  renderAttemptActions,
  showProfileSections = true,
  footer = null
}) => {
  const trendChartData = (overview?.trendData || []).map((item) => ({
    id: item.id,
    date: item.date.toISOString().slice(0, 10),
    avgScore: item.avgScore
  }));

  return (
    <div className={`student-overview ${wrapperClassName}`.trim()}>
      {showProfileSections ? (
        <>
          <div className="student-overview__top-grid">
            <section className="card student-overview__card">
              <div className="student-overview__section-head">
                <h3>Personal Info</h3>
              </div>
              <div className="student-overview__field-grid">
                <label className="student-overview__field">
                  <span>Full Name</span>
                  <input value={overview?.personalInfo?.fullName || ""} disabled readOnly />
                </label>
                <label className="student-overview__field">
                  <span>Email</span>
                  <input value={overview?.personalInfo?.email || ""} disabled readOnly />
                </label>
              </div>
            </section>

            <section className="card student-overview__card">
              <div className="student-overview__section-head">
                <h3>Preparation Profile</h3>
              </div>
              <div className="student-overview__field-grid">
                <label className="student-overview__field student-overview__field--full">
                  <span>Skills</span>
                  <input
                    value={preparationValues?.skills || ""}
                    onChange={
                      preparationReadOnly
                        ? undefined
                        : (event) => onPreparationChange?.("skills", event.target.value)
                    }
                    disabled={preparationReadOnly}
                    readOnly={preparationReadOnly}
                    placeholder="React, Java, DBMS"
                  />
                </label>
                <label className="student-overview__field student-overview__field--full">
                  <span>Career Goal</span>
                  <input
                    value={preparationValues?.careerGoal || ""}
                    onChange={
                      preparationReadOnly
                        ? undefined
                        : (event) => onPreparationChange?.("careerGoal", event.target.value)
                    }
                    disabled={preparationReadOnly}
                    readOnly={preparationReadOnly}
                    placeholder="Backend Developer"
                  />
                </label>
              </div>
            </section>
          </div>

          <section className="card student-overview__card">
            <div className="student-overview__section-head">
              <h3>Academic Info</h3>
            </div>
            <div className="student-overview__field-grid">
              <label className="student-overview__field">
                <span>Branch</span>
                <input value={overview?.academicInfo?.branch || ""} disabled readOnly />
              </label>
              <label className="student-overview__field">
                <span>Year</span>
                <input value={overview?.academicInfo?.year ?? ""} disabled readOnly />
              </label>
              <label className="student-overview__field">
                <span>CGPA</span>
                <input value={overview?.academicInfo?.cgpa ?? ""} disabled readOnly />
              </label>
              <div className="student-overview__field">
                <span>Status</span>
                <div className="student-overview__status-card">
                  <strong className={`student-profile-status-badge ${overview?.academicInfo?.requestStatusClassName || "status-none"}`}>
                    {overview?.academicInfo?.requestStatusLabel || "No Request"}
                  </strong>
                  <p>{overview?.academicInfo?.requestSummary || "No status available."}</p>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div className="student-overview__mid-grid student-overview__mid-grid--stats-only">
        <section className="card student-overview__card">
          <div className="student-overview__section-head">
            <h3>Stats Cards</h3>
          </div>
          <div className="student-overview__stats-grid">
            {(overview?.stats || []).map((item) => (
              <article className="student-overview__stat" key={item.label}>
                <p className="student-overview__stat-label">{item.label}</p>
                <p className="student-overview__stat-value">{item.value}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="card student-overview__card">
        <div className="student-overview__section-head">
          <h3>Student Trend</h3>
        </div>
        {trendChartData.length === 0 ? (
          <p className="muted-text">No data available</p>
        ) : (
          <div className="student-overview__chart">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avgScore" stroke="#27d1ff" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="card student-overview__card">
        <div className="student-overview__section-head">
          <h3>Attempt History</h3>
          <span className="score-chip">{overview?.attempts?.length || 0} attempts</span>
        </div>
        {overview?.attempts?.length ? (
          <div className="student-overview__attempts-wrap">
            <table className="admin-table student-overview__attempts-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Status</th>
                  {renderAttemptActions ? <th>Detailed Analysis</th> : null}
                </tr>
              </thead>
              <tbody>
                {overview.attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>{attempt.title}</td>
                    <td>{attempt.scoreLabel}</td>
                    <td>{attempt.dateLabel}</td>
                    <td>
                      <span className={`student-overview__attempt-status ${attempt.statusClassName}`}>
                        {attempt.status}
                      </span>
                    </td>
                    {renderAttemptActions ? renderAttemptActions(attempt) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-text">No attempt history available.</p>
        )}
      </section>

      {footer}
    </div>
  );
};

export default StudentOverviewLayout;
