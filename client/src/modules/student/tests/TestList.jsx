import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../../../api/apiService";
const SUBJECT_FILTERS = ["All", "Technical", "Aptitude", "Coding"];

const normalizeSubject = (subject) => {
  if (subject === "DSA") return "Technical";
  if (SUBJECT_FILTERS.includes(subject)) return subject;
  return "Technical";
};

const inferDuration = (test) => {
  const explicitDuration = Number(test?.duration || test?.durationMinutes);
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return `${explicitDuration} mins`;
  }

  const totalQuestions = Array.isArray(test?.questions)
    ? test.questions.length
    : Number(test?.questionsCount) || 0;
  return `${Math.max(15, totalQuestions * 2)} mins`;
};

const formatTestDateTime = (value) => {
  if (!value) {
    return "Not Available";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not Available";
  }

  return parsedDate.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const isPublishedAndActive = (test, now) => {
  // Keep backward compatibility: if publish fields are absent in payload, treat as visible.
  const publishValue = test?.isPublished ?? test?.publish;
  const isPublished = publishValue === undefined ? true : Boolean(publishValue);
  if (!isPublished) return false;

  const startDate = test?.startDate ? new Date(test.startDate) : null;
  const endDate = test?.endDate ? new Date(test.endDate) : null;

  if (startDate instanceof Date && !Number.isNaN(startDate.getTime()) && now < startDate) return false;
  if (endDate instanceof Date && !Number.isNaN(endDate.getTime()) && now > endDate) return false;
  return true;
};

const TestList = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiService.getPublicMockTests();
        setTests(Array.isArray(data?.tests) ? data.tests : []);
      } catch (requestError) {
        setError("Unable to load tests. Please retry.");
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);

  const testCards = useMemo(
    () => {
      const now = new Date();
      return tests
        .filter((test) => isPublishedAndActive(test, now))
        .filter((test) => {
          if (subjectFilter === "All") return true;
          return normalizeSubject(test?.subject) === subjectFilter;
        })
        .map((test) => ({
        id: test.id,
        title: test.title,
        subject: normalizeSubject(test.subject),
        durationLabel: inferDuration(test),
        startDateLabel: formatTestDateTime(test?.startDate),
        endDateLabel: formatTestDateTime(test?.endDate),
          totalQuestions: Array.isArray(test?.questions)
            ? test.questions.length
            : Number(test.questionsCount) || 0
        }));
    },
    [subjectFilter, tests]
  );

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <p className="sidebar-eyebrow">Test Center</p>
        <h2>Mock Tests</h2>
        <p>Choose a test and start your timed attempt.</p>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Available Tests</h3>
          <span className="score-chip">{testCards.length} visible</span>
        </div>
        <div className="admin-action-row">
          {SUBJECT_FILTERS.map((subject) => (
            <button
              key={subject}
              type="button"
              className={`topbar-logout ${subjectFilter === subject ? "is-active-filter" : ""}`}
              onClick={() => setSubjectFilter(subject)}
            >
              {subject}
            </button>
          ))}
        </div>

        {loading ? <p className="muted-text">Loading tests...</p> : null}
        {!loading && error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
        {!loading && !error && testCards.length === 0 ? (
          <p className="muted-text">No tests available right now.</p>
        ) : null}

        {!loading && !error && testCards.length > 0 ? (
          <div className="test-grid">
            {testCards.map((test) => (
              <article className="test-card" key={test.id}>
                <div className="test-card-top">
                  <div className="section-head">
                    <h4 className="test-card-title">{test.title}</h4>
                    <span className="score-chip">{test.subject}</span>
                  </div>
                </div>
                <div className="test-card-middle">
                  <p>
                    <strong>Subject:</strong> {test.subject}
                  </p>
                  <p>
                    <strong>Duration:</strong> {test.durationLabel}
                  </p>
                  <p>
                    <strong>Questions:</strong> {test.totalQuestions}
                  </p>
                  <p>
                    <strong>Start Date:</strong> {test.startDateLabel}
                  </p>
                  <p>
                    <strong>End Date:</strong> {test.endDateLabel}
                  </p>
                </div>
                <div className="test-card-bottom">
                  <button
                    type="button"
                    className="auth-button test-start-btn"
                    onClick={() => navigate(`/student/test/${test.id}`)}
                  >
                    Start Test
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default TestList;
