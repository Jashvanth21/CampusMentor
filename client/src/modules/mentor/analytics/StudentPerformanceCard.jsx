import RiskIndicator from "./RiskIndicator";

const toPercent = (value) => `${(Number(value) || 0).toFixed(1)}%`;

const TrendIndicator = ({ trend }) => {
  if (trend === "up") return <span className="trend-up">↑ Improving</span>;
  if (trend === "down") return <span className="trend-down">↓ Declining</span>;
  return <span className="trend-flat">→ Stable</span>;
};

const StudentPerformanceCard = ({ student, onViewDetails }) => {
  return (
    <article className="mentor-student-card">
      <div className="mentor-card-head">
        <div>
          <h4>{student.name || "Student"}</h4>
          <p>{student.email || "-"}</p>
        </div>
        <RiskIndicator student={student} />
      </div>

      <div className="mentor-metric-grid">
        <span className="mentor-metric-chip">Total Attempts: {student.totalAttempts}</span>
        <span className="mentor-metric-chip">Average: {toPercent(student.averageScore)}</span>
        <span className="mentor-metric-chip">Latest: {toPercent(student.latestScore)}</span>
      </div>

      <div className="mentor-trend-line">
        <TrendIndicator trend={student.trend} />
      </div>

      <button
        type="button"
        className="auth-button mentor-detail-btn"
        onClick={() => onViewDetails(student.studentUserId)}
      >
        View Details
      </button>
    </article>
  );
};

export default StudentPerformanceCard;
