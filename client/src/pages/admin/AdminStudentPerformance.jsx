import { useCallback, useEffect, useRef, useState } from "react";
import apiService from "../../api/apiService";
import {
  AnalyticsFilters,
  PerformanceTable,
  ScoreCard
} from "./components/StudentPerformanceComponents";

const DEFAULT_SUMMARY = {
  totalStudents: 0,
  averageOverall: 0,
  averageAccuracy: 0,
  totalAttempts: 0
};

const AdminStudentPerformance = () => {
  const [performanceRows, setPerformanceRows] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [error, setError] = useState("");
  const [branchFilter, setBranchFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [placementFilter, setPlacementFilter] = useState("all");
  const [scoreRange, setScoreRange] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("overallScore");
  const [sortOrder, setSortOrder] = useState("desc");
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(debounceTimer);
  }, [search]);

  const loadStudentPerformance = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isFirstLoad = !hasLoadedRef.current;

    try {
      if (isFirstLoad) {
        setIsInitialLoading(true);
      } else {
        setIsTableLoading(true);
      }
      setError("");
      const performanceResponse = await apiService.getAdminStudentPerformance({
        branch: branchFilter,
        year: yearFilter,
        placementStatus: placementFilter,
        scoreRange,
        search: debouncedSearch,
        sortBy,
        sortOrder
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setPerformanceRows(Array.isArray(performanceResponse?.students) ? performanceResponse.students : []);
      setSummary(performanceResponse?.summary || DEFAULT_SUMMARY);
      hasLoadedRef.current = true;
    } catch (requestError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      if (isFirstLoad) {
        setPerformanceRows([]);
        setSummary(DEFAULT_SUMMARY);
      }
      setError(requestError?.response?.data?.message || "Unable to load student performance.");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsInitialLoading(false);
        setIsTableLoading(false);
      }
    }
  }, [branchFilter, yearFilter, placementFilter, scoreRange, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    loadStudentPerformance();
  }, [loadStudentPerformance]);

  return (
    <div className="student-dashboard admin-student-performance-page">
      <section className="dashboard-header">
        <h2>Student Performance Analytics</h2>
        <p>Review score trends, placement readiness, and critical performance signals across the student base.</p>
      </section>

      {error ? <div className="admin-toast error">{error}</div> : null}

      <section className="card admin-students-performance-card admin-performance-page-card">
        <div className="admin-performance-head">
          <div>
            <h3>Performance Overview</h3>
            <p className="muted-text">Scores are read from stored AI analytics first, with counted attempts used when needed.</p>
          </div>
        </div>

        <div className="admin-performance-summary">
          <ScoreCard label="Students" value={summary.totalStudents || 0} />
          <ScoreCard label="Avg Overall" value={`${summary.averageOverall || 0}%`} />
          <ScoreCard label="Avg Accuracy" value={`${summary.averageAccuracy || 0}%`} />
          <ScoreCard label="Tests" value={summary.totalAttempts || 0} />
        </div>

        <AnalyticsFilters
          branch={branchFilter}
          year={yearFilter}
          placementStatus={placementFilter}
          scoreRange={scoreRange}
          search={search}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onBranchChange={setBranchFilter}
          onYearChange={setYearFilter}
          onPlacementStatusChange={setPlacementFilter}
          onScoreRangeChange={setScoreRange}
          onSearchChange={setSearch}
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
        />

        <section className="card admin-analytics-table-card admin-performance-all-card">
          <div className="section-head">
            <h3>All Student Performance</h3>
            <span className="practice-chip">{isTableLoading ? "Updating..." : `${performanceRows.length} students`}</span>
          </div>
          <PerformanceTable students={performanceRows} loading={isInitialLoading || isTableLoading} />
        </section>
      </section>
    </div>
  );
};

export default AdminStudentPerformance;
