import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import apiService from "../../../api/apiService";
import BatchPerformanceChart from "./BatchPerformanceChart";
import { MENTOR_DATA_UPDATED_EVENT } from "../../../utils/mentorEvents";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const MentorAnalytics = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMentorAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const studentsResponse = await apiService.getMentorStudents();

        const assignedStudents = Array.isArray(studentsResponse?.students)
          ? studentsResponse.students
          : [];

        setStudents(
          assignedStudents.map((student) => ({
            name: student?.name || "Student",
            averageScore: toNumber(student?.overallAverage),
            codingAverage: toNumber(student?.codingAverage),
            aptitudeAverage: toNumber(student?.aptitudeAverage),
            totalAttempts: toNumber(student?.totalTests),
            mentorSincerity: toNumber(student?.mentorFeedback?.sincerityScore),
            reviewed: Boolean(student?.mentorFeedback?.reviewed)
          }))
        );
      } catch (requestError) {
        setError("Unable to load mentor analytics.");
      } finally {
        setLoading(false);
      }
    };

    fetchMentorAnalytics();
    window.addEventListener(MENTOR_DATA_UPDATED_EVENT, fetchMentorAnalytics);
    return () => window.removeEventListener(MENTOR_DATA_UPDATED_EVENT, fetchMentorAnalytics);
  }, []);

  const sectionComparison = useMemo(
    () =>
      students.map((student) => ({
        name: student.name,
        Coding: student.codingAverage,
        Aptitude: student.aptitudeAverage
      })),
    [students]
  );

  const reviewedCount = useMemo(
    () => students.filter((student) => student.reviewed).length,
    [students]
  );

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Mentor Analytics</h2>
        <p>Track batch-level charts and performance trends across assigned students.</p>
      </section>

      {loading ? <section className="card"><p className="muted-text">Loading analytics...</p></section> : null}
      {!loading && error ? <section className="card"><p className="dashboard-inline-hint error-text">{error}</p></section> : null}

      {!loading && !error ? (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <p className="stat-label">Students Tracked</p>
              <p className="stat-value">{students.length}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Reviewed Profiles</p>
              <p className="stat-value">{reviewedCount}</p>
            </article>
          </section>

          <BatchPerformanceChart students={students} />

          <section className="card">
            <h3>Section Comparison</h3>
            {sectionComparison.length === 0 ? (
              <p className="muted-text">No assigned students.</p>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={sectionComparison}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="Coding" fill="#27d1ff" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Aptitude" fill="#1ec8a5" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

export default MentorAnalytics;
