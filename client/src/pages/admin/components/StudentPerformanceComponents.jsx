import { BRANCH_FILTER_OPTIONS } from "../../../constants/branches";

export const YEAR_OPTIONS = ["All", "1", "2", "3", "4"];

export const PLACEMENT_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "not_applied", label: "Not Applied" },
  { value: "applied", label: "Applied" },
  { value: "placed", label: "Placed" },
  { value: "rejected", label: "Rejected" }
];

export const SCORE_RANGE_OPTIONS = [
  { value: "all", label: "All Scores" },
  { value: "critical", label: "Critical Risk" },
  { value: "0-25", label: "Below 25%" },
  { value: "25-50", label: "25% - 50%" },
  { value: "50-75", label: "50% - 75%" },
  { value: "75-100", label: "75%+" }
];

export const PERFORMANCE_SORT_OPTIONS = [
  { value: "overallScore", label: "Overall score" },
  { value: "codingScore", label: "Coding score" },
  { value: "testsAttempted", label: "Test count" }
];

const getPerformanceBadgeClass = (status) => `status-badge admin-performance-status status-${status || "not_applied"}`;

export const ScoreCard = ({ label, value }) => (
  <div>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export const AnalyticsFilters = ({
  branch,
  year,
  placementStatus,
  scoreRange,
  search,
  sortBy,
  sortOrder,
  onBranchChange,
  onYearChange,
  onPlacementStatusChange,
  onScoreRangeChange,
  onSearchChange,
  onSortByChange,
  onSortOrderChange
}) => (
  <div className="admin-performance-filters">
    <label>
      Branch
      <select className="admin-select" value={branch} onChange={(event) => onBranchChange(event.target.value)}>
        {BRANCH_FILTER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
    <label>
      Year
      <select className="admin-select" value={year} onChange={(event) => onYearChange(event.target.value)}>
        {YEAR_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
    <label>
      Placement Status
      <select
        className="admin-select"
        value={placementStatus}
        onChange={(event) => onPlacementStatusChange(event.target.value)}
      >
        {PLACEMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label>
      Score Range
      <select className="admin-select" value={scoreRange} onChange={(event) => onScoreRangeChange(event.target.value)}>
        {SCORE_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label>
      Search
      <input
        className="admin-performance-search"
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Name, roll number, branch"
      />
    </label>
    <label>
      Sort By
      <select className="admin-select" value={sortBy} onChange={(event) => onSortByChange(event.target.value)}>
        {PERFORMANCE_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
    <label>
      Order
      <select className="admin-select" value={sortOrder} onChange={(event) => onSortOrderChange(event.target.value)}>
        <option value="desc">High to low</option>
        <option value="asc">Low to high</option>
      </select>
    </label>
  </div>
);

export const PerformanceTable = ({
  students,
  loading = false,
  emptyMessage = "No performance records found for selected filters.",
  scroll = false
}) => (
  <div className={`admin-table-wrap admin-performance-table-wrap${scroll ? " admin-support-table-scroll" : ""}${loading ? " is-loading" : ""}`}>
    <table className="admin-table admin-performance-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Roll Number</th>
          <th>Branch</th>
          <th>Year</th>
          <th>Overall Score</th>
          <th>Coding Score</th>
          <th>Aptitude Score</th>
          <th>Technical Score</th>
          <th>Tests</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.id}>
            <td>{student.name || "-"}</td>
            <td>{student.rollNumber || "-"}</td>
            <td>{student.branch || "-"}</td>
            <td>{student.year ?? "-"}</td>
            <td>{student.overallScore ?? 0}%</td>
            <td>{student.codingScore ?? 0}%</td>
            <td>{student.aptitudeScore ?? 0}%</td>
            <td>{student.technicalScore ?? 0}%</td>
            <td>{student.testsAttempted ?? 0}</td>
            <td>
              <span className={getPerformanceBadgeClass(student.placementStatus)}>
                {student.placementStatusLabel || "Not Applied"}
              </span>
            </td>
          </tr>
        ))}
        {students.length === 0 && loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <tr key={`performance-skeleton-${index}`} className="admin-performance-skeleton-row">
                <td colSpan="10">
                  <span />
                </td>
              </tr>
            ))
          : null}
        {students.length === 0 && !loading ? (
          <tr>
            <td colSpan="10" className="muted-text">
              {emptyMessage}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  </div>
);
