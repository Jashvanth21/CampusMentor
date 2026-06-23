import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import apiService from "../../api/apiService";
import { BRANCH_FILTER_OPTIONS } from "../../constants/branches";

const YEAR_OPTIONS = ["All", "1", "2", "3", "4"];

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
    totalPlacementSelections: 0,
    totalApplications: 0,
    totalDrives: 0,
    companyWisePlacements: [],
    branchWisePlacement: []
  },
  placementPercentage: 0,
  branchWisePlacement: [],
  companyWisePlacements: [],
  totalPlacedStudents: 0,
  eligibleStudents: 0
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const StatCard = ({ title, value }) => (
  <article className="stat-card admin-analytics-stat-card">
    <p className="stat-value">{value}</p>
    <p className="stat-label">{title}</p>
  </article>
);

const StudentTable = ({ title, students, emptyMessage, highlightLow = false }) => (
  <section className="card admin-analytics-table-card">
    <div className="section-head">
      <h3>{title}</h3>
      <span className="practice-chip">{students.length} students</span>
    </div>
    {students.length === 0 ? (
      <p className="muted-text">{emptyMessage}</p>
    ) : (
      <div className={`admin-table-wrap ${highlightLow ? "admin-support-table-scroll" : ""}`}>
        <table className="admin-table admin-analytics-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Branch</th>
              <th>Year</th>
              <th>Overall Average</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.studentId}>
                <td>{index + 1}</td>
                <td>{student.name || "Student"}</td>
                <td>{student.branch || "-"}</td>
                <td>{student.year || "-"}</td>
                <td
                  className={highlightLow && toNumber(student.overallAverage) < 50 ? "admin-analytics-low-score" : ""}
                >
                  {toNumber(student.overallAverage).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [branch, setBranch] = useState("All");
  const [year, setYear] = useState("All");
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError("");
        const analyticsResponse = await apiService.getAdminAnalytics({ branch, year });
        console.log(
          "[AdminAnalytics] Critical-risk students received:",
          Array.isArray(analyticsResponse?.analytics?.atRiskStudents)
            ? analyticsResponse.analytics.atRiskStudents.length
            : 0
        );
        setAnalytics(analyticsResponse?.analytics || DEFAULT_ANALYTICS);
      } catch (requestError) {
        console.error("[AdminAnalytics] API error:", requestError?.response?.data || requestError?.message);
        setError("Unable to load system analytics.");
        setAnalytics(DEFAULT_ANALYTICS);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [branch, year]);

  const subjectChartData = useMemo(
    () => [
      { subject: "Coding", accuracy: toNumber(analytics?.subjectStats?.coding), color: "#7c5cff" },
      { subject: "Aptitude", accuracy: toNumber(analytics?.subjectStats?.aptitude), color: "#4da3ff" },
      { subject: "Technical", accuracy: toNumber(analytics?.subjectStats?.technical), color: "#1ec8a5" }
    ],
    [analytics]
  );

  const trendChartData = useMemo(() => {
    const trend = Array.isArray(analytics?.attemptsTrend) ? analytics.attemptsTrend : [];
    return trend.map((entry) => ({
      date: entry?.date || "-",
      attempts: toNumber(entry?.count)
    }));
  }, [analytics]);

  const topStudents = useMemo(
    () =>
      [...(Array.isArray(analytics?.topStudents) ? analytics.topStudents : [])].sort(
        (a, b) => toNumber(b.overallAverage) - toNumber(a.overallAverage)
      ),
    [analytics]
  );

  const atRiskStudents = useMemo(
    () =>
      [...(Array.isArray(analytics?.atRiskStudents) ? analytics.atRiskStudents : [])].sort(
        (a, b) => toNumber(a.overallAverage) - toNumber(b.overallAverage)
      ),
    [analytics]
  );

  const placementOverview = useMemo(() => {
    const placementStats = analytics?.placementStats || {};
    const companyPlacements = Array.isArray(placementStats?.companyWisePlacements)
      ? placementStats.companyWisePlacements.map((item) => ({
          company: item?.company || item?.companyName || "Company",
          placed: toNumber(item?.placementSelections ?? item?.placed ?? item?.selectedApplications)
        }))
      : [];
    const branchPlacements = Array.isArray(placementStats?.branchWisePlacement)
      ? placementStats.branchWisePlacement.map((item) => ({
          branch: item?.branch || "-",
          percentage: toNumber(item?.percentage),
          eligibleStudents: toNumber(item?.totalStudents ?? item?.eligibleStudents),
          placedStudents: toNumber(item?.placementSelections ?? item?.placedStudents)
        }))
      : [];

    return {
      totalDrives: toNumber(placementStats?.totalDrives),
      totalApplications: toNumber(placementStats?.totalApplications),
      totalPlaced: toNumber(placementStats?.totalPlacementSelections ?? placementStats?.placedStudents),
      totalPlacedStudents: toNumber(placementStats?.totalPlacementSelections ?? placementStats?.placedStudents),
      totalPlacementSelections: toNumber(placementStats?.totalPlacementSelections),
      placementRate: toNumber(placementStats?.placementPercentage),
      companyPlacements,
      branchPlacements
    };
  }, [analytics]);

  const backendPlacementStats = analytics?.placementStats || {};
  const placementRate = toNumber(backendPlacementStats?.placementPercentage);
  const placementSelectionsCount = toNumber(backendPlacementStats?.totalPlacementSelections ?? backendPlacementStats?.placedStudents);
  const filteredPlacementStudentsCount = toNumber(
    backendPlacementStats?.totalStudents ?? backendPlacementStats?.eligibleStudents
  );

  const summaryCards = [
    { title: "Total Students", value: toNumber(analytics?.totalStudents) },
    { title: "Total Tests Taken", value: toNumber(analytics?.totalAttempts) },
    { title: "Average Accuracy", value: `${toNumber(analytics?.averageAccuracy).toFixed(1)}%` },
    { title: "At-Risk Students", value: atRiskStudents.length },
    { title: "Placement Selections", value: placementSelectionsCount },
    { title: "Placement Percentage", value: `${placementRate.toFixed(1)}%` }
  ];

  const placementSummaryCards = [
    { title: "Total Drives", value: placementOverview.totalDrives },
    { title: "Total Applicants", value: placementOverview.totalApplications },
    { title: "Filtered Students", value: filteredPlacementStudentsCount },
    { title: "Placement Selections", value: placementOverview.totalPlacementSelections },
    { title: "Placement Rate", value: `${placementRate.toFixed(1)}%` }
  ];

  return (
    <div className="student-dashboard admin-analytics-page">
      <section className="dashboard-header admin-analytics-header">
        <div>
          <h2>Placement Intelligence Dashboard</h2>
          <p>Track academic performance, placement outcomes, and students who need timely intervention.</p>
        </div>
        <div className="admin-dashboard-hero-status">
          {loading ? <span className="score-chip">Refreshing data</span> : <span className="score-chip">Live insights</span>}
          <button
            type="button"
            className="topbar-logout admin-action-btn"
            onClick={() => navigate("/admin/student-performance")}
          >
            View Student Performance
          </button>
          {error ? <span className="dashboard-inline-hint error-text">{error}</span> : null}
        </div>
      </section>

      <section className="stats-grid admin-analytics-summary-grid">
        {summaryCards.map((card) => (
          <StatCard key={card.title} title={card.title} value={card.value} />
        ))}
      </section>

      <section className="card admin-analytics-filter-card">
        <div className="admin-analytics-filters admin-analytics-filters-row">
          <label>
            Branch
            <select className="admin-select" value={branch} onChange={(event) => setBranch(event.target.value)}>
              {BRANCH_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select className="admin-select" value={year} onChange={(event) => setYear(event.target.value)}>
              {YEAR_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="chart-section admin-analytics-chart-card">
        <div className="section-head">
          <div>
            <h3>Subject Performance</h3>
            <p className="admin-dashboard-card-copy">Current accuracy distribution across core placement preparation areas.</p>
          </div>
        </div>
        <div className="chart-wrap admin-analytics-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={subjectChartData} barCategoryGap={36}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="subject" tickLine={false} axisLine={{ stroke: "rgba(129, 153, 197, 0.34)" }} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={{ stroke: "rgba(129, 153, 197, 0.34)" }} />
              <Tooltip formatter={(value) => [`${value}%`, "Accuracy"]} />
              <Bar dataKey="accuracy" radius={[12, 12, 0, 0]} maxBarSize={72}>
                {subjectChartData.map((entry) => (
                  <Cell key={entry.subject} fill={entry.color} />
                ))}
                <LabelList dataKey="accuracy" position="top" formatter={(value) => `${value}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-section admin-analytics-chart-card">
        <div className="section-head">
          <div>
            <h3>Test Activity Trend (Last 7 Days)</h3>
            <p className="admin-dashboard-card-copy">Daily attempt volume to spot engagement shifts and testing momentum.</p>
          </div>
        </div>
        <div className="chart-wrap admin-analytics-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "rgba(129, 153, 197, 0.34)" }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "rgba(129, 153, 197, 0.34)" }} />
              <Tooltip formatter={(value) => [value, "Attempts"]} />
              <Line
                type="monotone"
                dataKey="attempts"
                stroke="#27d1ff"
                strokeWidth={3}
                dot={{ r: 4, fill: "#7c5cff", stroke: "#27d1ff", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card admin-analytics-placement-card">
        <div className="section-head">
          <div>
            <h3>Placement Overview</h3>
            <p className="admin-dashboard-card-copy">Monitor drive demand, placement output, and company distribution in one place.</p>
          </div>
          <span className="practice-chip">Placement intelligence</span>
        </div>

        <div className="admin-analytics-placement-summary">
          {placementSummaryCards.map((card) => (
            <article className="admin-analytics-placement-stat" key={card.title}>
              <p>{card.title}</p>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <div className="admin-analytics-placement-grid">
          <section className="admin-analytics-placement-panel">
            <div className="admin-placement-panel-head">
              <h4>Company-wise Placements</h4>
            </div>
            {placementOverview.companyPlacements.length === 0 ? (
              <p className="muted-text">No placement records found for the current filters.</p>
            ) : (
              <div className="admin-analytics-list admin-company-placement-list">
                {placementOverview.companyPlacements.map((item) => (
                  <article className="admin-analytics-list-row" key={item.company}>
                    <span>{item.company}</span>
                    <strong>{item.placed}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-analytics-placement-panel">
            <div className="admin-placement-panel-head">
              <h4>Branch-wise Placement %</h4>
            </div>
            {placementOverview.branchPlacements.length === 0 ? (
              <p className="muted-text">Branch placement share will appear once students are marked as placed.</p>
            ) : (
              <div className="admin-analytics-list">
                {placementOverview.branchPlacements.map((item) => (
                  <article className="admin-analytics-list-row" key={item.branch}>
                    <span>{item.branch}</span>
                    <span className="admin-analytics-list-row-meta">
                      {item.placedStudents}/{item.eligibleStudents}
                    </span>
                    <strong>{item.percentage}%</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="bottom-grid admin-analytics-bottom-grid">
        <StudentTable
          title="Top 5 Performing Students"
          students={topStudents}
          emptyMessage="No attempts found for current filters."
        />
        <StudentTable
          title="Students Needing Support"
          students={atRiskStudents}
          emptyMessage="No critical-risk students currently."
          highlightLow
        />
      </section>
    </div>
  );
};

export default AdminAnalytics;
