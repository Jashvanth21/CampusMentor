import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import apiService from "../../../api/apiService";

const DEFAULT_ANALYTICS = {
  totalStudents: 0,
  totalAttempts: 0,
  averageAccuracy: 0,
  subjectStats: {
    coding: 0,
    aptitude: 0,
    technical: 0
  },
  topStudents: [],
  atRiskStudents: [],
  attemptsTrend: [],
  placementStats: {
    eligibleStudents: 0,
    totalStudents: 0,
    placedStudents: 0,
    placementPercentage: 0,
    totalPlacementSelections: 0
  }
};

const DashboardIcon = ({ name }) => {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "icon-svg"
  };

  switch (name) {
    case "students":
      return (
        <svg {...commonProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="7" r="4" />
          <path d="M20 8a3 3 0 0 1 0 6" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
      );
    case "mentors":
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21a6 6 0 0 1 12 0" />
          <circle cx="18" cy="8" r="3" />
          <path d="M15 21a4.5 4.5 0 0 1 6 0" />
        </svg>
      );
    case "tests":
      return (
        <svg {...commonProps}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case "risk":
      return (
        <svg {...commonProps}>
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      );
    case "placed":
      return (
        <svg {...commonProps}>
          <path d="m9 12 2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "percentage":
    case "analytics":
      return (
        <svg {...commonProps}>
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-7" />
        </svg>
      );
    case "requests":
      return (
        <svg {...commonProps}>
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      );
    default:
      return null;
  }
};

const QUICK_ACTIONS = [
  {
    to: "/admin/create-test",
    title: "Create Test",
    description: "Build and publish a new assessment quickly.",
    accentClass: "action-violet",
    icon: "tests"
  },
  {
    to: "/admin/analytics",
    title: "View Analytics",
    description: "Review student performance and trend signals.",
    accentClass: "action-blue",
    icon: "analytics"
  },
  {
    to: "/admin/students",
    title: "Manage Students",
    description: "Update records, assign mentors, and review status.",
    accentClass: "action-cyan",
    icon: "students"
  }
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatShortDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getActiveTestsCount = (tests) => {
  const publishedCount = tests.filter((test) => Boolean(test?.isPublished)).length;
  return publishedCount || tests.length;
};

const AdminDashboard = () => {
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [mentors, setMentors] = useState([]);
  const [tests, setTests] = useState([]);
  const [drives, setDrives] = useState([]);
  const [placementSummary, setPlacementSummary] = useState({
    totalDrives: 0,
    activeDrives: 0,
    totalApplications: 0,
    totalPlaced: 0,
    totalPlacedStudents: 0,
    recentPlacements: []
  });
  const [cgpaRequests, setCgpaRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          analyticsResponse,
          mentorsResponse,
          testsResponse,
          drivesResponse,
          cgpaRequestsResponse
        ] = await Promise.all([
          apiService.getAdminSystemAnalytics(),
          apiService.getAdminMentors(),
          apiService.getMockTests(),
          apiService.getPlacementDrives(),
          apiService.getAdminCgpaRequests()
        ]);

        setAnalytics(analyticsResponse?.analytics || DEFAULT_ANALYTICS);
        setMentors(Array.isArray(mentorsResponse?.mentors) ? mentorsResponse.mentors : []);
        setTests(Array.isArray(testsResponse?.tests) ? testsResponse.tests : []);
        setDrives(Array.isArray(drivesResponse?.drives) ? drivesResponse.drives : []);
        setPlacementSummary(drivesResponse?.summary || {
          totalDrives: 0,
          activeDrives: 0,
          totalApplications: 0,
          totalPlaced: 0,
          totalPlacedStudents: 0,
          recentPlacements: []
        });
        setCgpaRequests(Array.isArray(cgpaRequestsResponse?.requests) ? cgpaRequestsResponse.requests : []);
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Unable to load admin dashboard.");
        setAnalytics(DEFAULT_ANALYTICS);
        setMentors([]);
        setTests([]);
        setDrives([]);
        setPlacementSummary({
          totalDrives: 0,
          activeDrives: 0,
          totalApplications: 0,
          totalPlaced: 0,
          totalPlacedStudents: 0,
          recentPlacements: []
        });
        setCgpaRequests([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const performanceTrendData = useMemo(() => {
    const rawTrend = Array.isArray(analytics?.attemptsTrend) ? analytics.attemptsTrend : [];
    return rawTrend
      .map((entry) => ({
        dateKey: entry?.dateKey || "",
        day: entry?.date || entry?.day || entry?.label || "-",
        score: toNumber(entry?.score ?? entry?.performance ?? entry?.averageScore ?? entry?.accuracy)
      }))
      .filter((entry) => entry.day !== "-")
      .sort((left, right) => String(left.dateKey || "").localeCompare(String(right.dateKey || "")));
  }, [analytics?.attemptsTrend]);

  const subjectPerformance = useMemo(
    () => [
      { name: "Coding", value: toNumber(analytics?.subjectStats?.coding), colorClass: "subject-coding" },
      { name: "Aptitude", value: toNumber(analytics?.subjectStats?.aptitude), colorClass: "subject-aptitude" },
      { name: "Technical", value: toNumber(analytics?.subjectStats?.technical), colorClass: "subject-technical" }
    ],
    [analytics]
  );

  const pendingCgpaCount = useMemo(
    () => cgpaRequests.filter((request) => String(request?.status || "").toLowerCase() === "pending").length,
    [cgpaRequests]
  );

  const atRiskStudents = useMemo(
    () => (Array.isArray(analytics?.atRiskStudents) ? analytics.atRiskStudents : []),
    [analytics]
  );

  const recentDrives = useMemo(() => {
    return [...drives]
      .sort((left, right) => {
        const leftTime = new Date(left?.driveDate || left?.createdAt || 0).getTime();
        const rightTime = new Date(right?.driveDate || right?.createdAt || 0).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 5);
  }, [drives]);

  const recentlyPlacedStudents = useMemo(() => {
    if (Array.isArray(placementSummary?.recentPlacements) && placementSummary.recentPlacements.length > 0) {
      return [...placementSummary.recentPlacements]
        .sort((left, right) => new Date(right?.placedAt || 0).getTime() - new Date(left?.placedAt || 0).getTime())
        .map((item) => ({
          key: `${item.id}-${item.studentId}`,
          name: item?.studentName || "Student",
          branch: item?.branch || "-",
          year: item?.year || "-",
          companyName: item?.companyName || "Company",
          role: item?.role || "Role",
          driveDate: item?.placedAt || null
        }))
        .slice(0, 5);
    }

    const items = [];

    drives.forEach((drive) => {
      const preview = Array.isArray(drive?.placedStudentsPreview) ? drive.placedStudentsPreview : [];
      preview.forEach((student) => {
        items.push({
          key: `${drive.id}-${student.id || student.name}`,
          name: student?.name || "Student",
          branch: student?.branch || "-",
          year: student?.year || "-",
          companyName: drive?.companyName || "Company",
          role: drive?.role || "Role",
          driveDate: drive?.driveDate || drive?.createdAt || null
        });
      });
    });

    return items
      .sort((left, right) => new Date(right.driveDate || 0).getTime() - new Date(left.driveDate || 0).getTime())
      .slice(0, 5);
  }, [drives, placementSummary]);

  const placementSelections = useMemo(
    () => toNumber(analytics?.placementStats?.totalPlacementSelections),
    [analytics]
  );

  const placementPercentage = useMemo(
    () => toNumber(analytics?.placementStats?.placementPercentage),
    [analytics]
  );

  const summaryCards = useMemo(
    () => [
      {
        title: "Total Students",
        value: toNumber(analytics?.totalStudents),
        icon: "students",
        accentClass: "summary-students"
      },
      {
        title: "Total Mentors",
        value: mentors.length,
        icon: "mentors",
        accentClass: "summary-mentors"
      },
      {
        title: "Active Tests",
        value: getActiveTestsCount(tests),
        icon: "tests",
        accentClass: "summary-tests"
      },
      {
        title: "At-Risk Students",
        value: atRiskStudents.length,
        icon: "risk",
        accentClass: "summary-risk"
      },
      {
        title: "Placement Selections",
        value: placementSelections,
        icon: "placed",
        accentClass: "summary-placed"
      },
      {
        title: "Placement Percentage",
        value: `${placementPercentage}%`,
        icon: "percentage",
        accentClass: "summary-rate"
      }
    ],
    [analytics, mentors.length, tests, atRiskStudents.length, placementSelections, placementPercentage]
  );

  return (
    <div className="student-dashboard admin-dashboard-page">
      <section className="dashboard-header admin-dashboard-hero">
        <div>
          <p className="sidebar-eyebrow">Operations Hub</p>
          <h2>Admin Dashboard</h2>
          <p>Track platform activity, student readiness, placement movement, and high-priority admin tasks in one view.</p>
        </div>
        <div className="admin-dashboard-hero-status">
          {loading ? <span className="score-chip">Refreshing data</span> : <span className="score-chip">Live overview</span>}
          {error ? <span className="dashboard-inline-hint error-text">{error}</span> : null}
        </div>
      </section>

      <section className="stats-grid admin-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.title} className={`stat-card admin-summary-card ${card.accentClass}`}>
            <div className="admin-summary-card-head">
              <span className="admin-summary-icon" aria-hidden>
                <DashboardIcon name={card.icon} />
              </span>
              <p className="stat-label">{card.title}</p>
            </div>
            <p className="stat-value">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-alerts">
        <article className="card admin-alert-card">
          <div className="admin-alert-icon" aria-hidden>
            <DashboardIcon name="requests" />
          </div>
          <div>
            <p className="admin-alert-label">Pending CGPA Requests</p>
            <strong>{pendingCgpaCount}</strong>
          </div>
        </article>
        <article className="card admin-alert-card admin-alert-card-risk">
          <div className="admin-alert-icon" aria-hidden>
            <DashboardIcon name="risk" />
          </div>
          <div>
            <p className="admin-alert-label">At-Risk Students</p>
            <strong>{atRiskStudents.length}</strong>
          </div>
        </article>
      </section>

      <section className="admin-dashboard-analytics-layout">
        <article className="chart-section admin-dashboard-chart-card">
          <div className="section-head">
            <div>
              <h3>Student Performance Trend</h3>
              <p className="admin-dashboard-card-copy">Daily average scores from student attempts over the last 14 days.</p>
            </div>
            <span className="score-chip">Last 14 days</span>
          </div>
          <div className="chart-wrap admin-dashboard-chart-wrap">
            {performanceTrendData.length === 0 ? (
              <div className="admin-dashboard-empty-state">
                <p className="muted-text">No recent attempt data available yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, "Average score"]} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#7c5cff"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#27d1ff", stroke: "#7c5cff", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="chart-section admin-dashboard-subject-card">
          <div className="section-head">
            <div>
              <h3>Subject Performance</h3>
              <p className="admin-dashboard-card-copy">Current accuracy split across key assessment categories.</p>
            </div>
          </div>

          <div className="admin-subject-performance-list">
            {subjectPerformance.map((item) => (
              <div className="admin-subject-performance-item" key={item.name}>
                <div className="admin-subject-performance-head">
                  <span>{item.name}</span>
                  <strong>{item.value}%</strong>
                </div>
                <div className="admin-progress-track" aria-hidden>
                  <div
                    className={`admin-progress-fill ${item.colorClass}`}
                    style={{ width: `${Math.max(6, Math.min(item.value || 0, 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="card admin-dashboard-quick-actions-card">
        <div className="section-head">
          <h3>Quick Actions</h3>
          <span className="practice-chip">Core workflows</span>
        </div>
        <div className="admin-dashboard-actions admin-dashboard-actions-row">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.to} to={action.to} className={`admin-dashboard-action-card ${action.accentClass}`}>
              <span className="admin-dashboard-action-icon" aria-hidden>
                <DashboardIcon name={action.icon} />
              </span>
              <div>
                <strong>{action.title}</strong>
                <p>{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card admin-placement-overview-card">
        <div className="section-head">
          <div>
            <h3>Placement Overview</h3>
            <p className="admin-dashboard-card-copy">Review the latest drives and the most recent confirmed placements at a glance.</p>
          </div>
          <span className="practice-chip">Placement pipeline</span>
        </div>

        <div className="admin-placement-overview-grid">
          <div className="admin-placement-panel">
            <div className="admin-placement-panel-head">
              <h4>Recent Placement Drives</h4>
              <Link to="/admin/drives" className="admin-panel-link">
                View All
              </Link>
            </div>
            <div className="admin-placement-panel-body">
              {recentDrives.length === 0 ? (
                <div className="admin-dashboard-empty-state">
                  <p className="muted-text">No placement drives available.</p>
                </div>
              ) : (
                <div className="admin-table-wrap admin-compact-table-wrap admin-panel-scroll">
                  <table className="admin-table admin-compact-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Role</th>
                        <th>Date</th>
                        <th>Placed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentDrives.map((drive) => (
                        <tr key={drive.id}>
                          <td>{drive.companyName || "Company"}</td>
                          <td>{drive.role || "-"}</td>
                          <td>{formatShortDate(drive.driveDate || drive.createdAt)}</td>
                          <td>{toNumber(drive.selectedCandidatesCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="admin-placement-panel">
            <div className="admin-placement-panel-head">
              <h4>Recently Placed Students</h4>
              <Link to="/admin/drives" className="admin-panel-link">
                View All
              </Link>
            </div>
            <div className="admin-placement-panel-body">
              {recentlyPlacedStudents.length === 0 ? (
                <div className="admin-dashboard-empty-state">
                  <p className="muted-text">No placement confirmations available yet.</p>
                </div>
              ) : (
                <div className="admin-recent-placement-list admin-panel-scroll">
                  {recentlyPlacedStudents.map((student) => (
                    <article key={student.key} className="admin-recent-placement-item">
                      <div className="admin-recent-placement-avatar" aria-hidden>
                        {String(student.name || "S").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{student.name}</strong>
                        <p>
                          {student.companyName} | {student.role}
                        </p>
                        <span>
                          {student.branch} | Year {student.year}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
