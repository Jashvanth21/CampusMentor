import { useEffect, useMemo, useRef, useState } from "react";
import apiService from "../../api/apiService";

const CAREER_PATH_OPTIONS = [
  "Software Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "AI/ML Engineer"
];

const DEFAULT_RECOMMENDATION_DATA = {
  overallAverage: 0,
  totalTests: 0,
  aptitudeAverage: 0,
  technicalAverage: 0,
  codingAverage: 0,
  cgpa: 0,
  strongSkills: [],
  areasToImprove: [],
  recommendedPaths: [],
  bestPath: "",
  selectedCareerPath: "",
  source: "AI",
  recommendedCareer: "",
  reason: "",
  strengthSummary: "",
  improvementSummary: "",
  strengths: [],
  improvements: [],
  confidence: "",
  whyThisMatchesYou: "",
  improvementAdvice: "",
  message: ""
};

const DEFAULT_ROADMAP = {
  source: "",
  careerPath: "",
  whyThisCareerFits: "",
  improvementAdvice: [],
  overallAnalysis: "",
  phases: [],
  note: "",
  generatedAt: null
};

const getRoadmapSourceLabel = () => "AI Generated";

const getRecommendationSourceLabel = () => "AI Generated";

const StudentRecommendations = () => {
  const [data, setData] = useState(DEFAULT_RECOMMENDATION_DATA);
  const [userId, setUserId] = useState("");
  const [selectedCareerPath, setSelectedCareerPath] = useState("");
  const [savedCareerPath, setSavedCareerPath] = useState("");
  const [roadmapData, setRoadmapData] = useState(DEFAULT_ROADMAP);
  const [loading, setLoading] = useState(true);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [roadmapError, setRoadmapError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const recommendationRequestStartedRef = useRef(false);

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        setLoading(true);
        setError("");
        const [currentUser, analyticsResponse] = await Promise.all([
          apiService.getCurrentUser(),
          apiService.getStudentAnalytics()
        ]);
        const nextUserId = currentUser?._id || "me";
        const totalTests = Number(analyticsResponse?.totalTests ?? analyticsResponse?.performance?.totalTests) || 0;
        const latestAttemptAt = String(analyticsResponse?.latestAttempt?.date || "");
        const cacheKey = apiService.getStudentCareerRecommendationCacheKey(nextUserId);
        const cachedRecommendation = localStorage.getItem(cacheKey);

        setUserId(nextUserId);

        let recommendationResponse = null;
        if (cachedRecommendation) {
          try {
            const parsedCache = JSON.parse(cachedRecommendation);
            const metadata = parsedCache?.metadata || {};
            if (
              Number(metadata?.lastAttemptCount) === totalTests &&
              String(metadata?.lastUpdatedAt || "") === latestAttemptAt &&
              parsedCache?.data
            ) {
              recommendationResponse = parsedCache.data;
            }
          } catch (parseError) {
            localStorage.removeItem(cacheKey);
          }
        }

        if (!recommendationResponse && !recommendationRequestStartedRef.current) {
          recommendationRequestStartedRef.current = true;
          recommendationResponse = await apiService.getStudentCareerRecommendation();
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              metadata: {
                lastAttemptCount: totalTests,
                lastUpdatedAt: latestAttemptAt
              },
              data: recommendationResponse
            })
          );
        }

        const normalizedRecommendation = recommendationResponse || DEFAULT_RECOMMENDATION_DATA;
        setData({
          overallAverage: Number(normalizedRecommendation?.overallAverage) || 0,
          totalTests: Number(normalizedRecommendation?.totalTests) || totalTests,
          aptitudeAverage: Number(normalizedRecommendation?.aptitudeAverage) || 0,
          technicalAverage: Number(normalizedRecommendation?.technicalAverage) || 0,
          codingAverage: Number(normalizedRecommendation?.codingAverage) || 0,
          cgpa: Number(normalizedRecommendation?.cgpa) || 0,
          strongSkills: Array.isArray(normalizedRecommendation?.strongSkills) ? normalizedRecommendation.strongSkills : [],
          areasToImprove: Array.isArray(normalizedRecommendation?.areasToImprove) ? normalizedRecommendation.areasToImprove : [],
          recommendedPaths: Array.isArray(normalizedRecommendation?.recommendedPaths)
            ? normalizedRecommendation.recommendedPaths
            : normalizedRecommendation?.recommendedCareer
              ? [{ role: normalizedRecommendation.recommendedCareer, reason: normalizedRecommendation.reason || "" }]
              : [],
          bestPath: normalizedRecommendation?.bestPath || normalizedRecommendation?.recommendedCareer || "",
          selectedCareerPath: normalizedRecommendation?.selectedCareerPath || "",
          source: "AI",
          recommendedCareer: normalizedRecommendation?.recommendedCareer || normalizedRecommendation?.bestPath || "",
          reason: normalizedRecommendation?.reason || "",
          strengthSummary: normalizedRecommendation?.strengthSummary || "",
          improvementSummary: normalizedRecommendation?.improvementSummary || "",
          strengths: Array.isArray(normalizedRecommendation?.strengths) ? normalizedRecommendation.strengths : [],
          improvements: Array.isArray(normalizedRecommendation?.improvements) ? normalizedRecommendation.improvements : [],
          confidence: normalizedRecommendation?.confidence || "",
          whyThisMatchesYou: normalizedRecommendation?.whyThisMatchesYou || "",
          improvementAdvice: normalizedRecommendation?.improvementAdvice || "",
          message: normalizedRecommendation?.message || ""
        });
        setSelectedCareerPath(normalizedRecommendation?.selectedCareerPath || normalizedRecommendation?.bestPath || "");
        setSavedCareerPath(normalizedRecommendation?.selectedCareerPath || "");
        setRoadmapData(DEFAULT_ROADMAP);
        setRoadmapError("");
      } catch (requestError) {
        setError("Unable to load career recommendations right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
  }, []);

  const hasCareers = useMemo(() => data.recommendedPaths.length > 0, [data.recommendedPaths.length]);
  const insufficientData = Boolean(data.message);

  const normalizeRoadmap = (roadmapResponse) =>
    roadmapResponse
      ? {
          ...DEFAULT_ROADMAP,
          ...roadmapResponse,
          source: "AI"
        }
      : DEFAULT_ROADMAP;

  const loadRoadmap = async (careerPath, force = true) => {
    if (!careerPath) {
      setRoadmapData(DEFAULT_ROADMAP);
      return;
    }

    try {
      setRoadmapLoading(true);
      setRoadmapError("");
      const roadmapResponse = await apiService.getCareerRoadmap(careerPath, force);
      const normalizedRoadmap = normalizeRoadmap(roadmapResponse);
      setRoadmapData(normalizedRoadmap);
      setSavedCareerPath(roadmapResponse?.careerPath || careerPath);
      if (roadmapResponse?.careerPath) {
        setSelectedCareerPath(roadmapResponse.careerPath);
      }
    } catch (requestError) {
      setRoadmapData(DEFAULT_ROADMAP);
      setRoadmapError(requestError?.response?.data?.message || "Unable to generate roadmap right now.");
    } finally {
      setRoadmapLoading(false);
    }
  };

  const handleSaveCareerPath = async () => {
    if (!selectedCareerPath) {
      setSaveMessage("Select a career path before saving.");
      return;
    }

    try {
      setSaveLoading(true);
      setSaveMessage("");
      setRoadmapError("");
      await apiService.saveCareerPath({
        userId,
        careerPath: selectedCareerPath
      });
      setSavedCareerPath(selectedCareerPath);
      setSaveMessage("Career path saved successfully.");
      await loadRoadmap(selectedCareerPath, true);
    } catch (requestError) {
      setSaveMessage(requestError?.response?.data?.message || "Unable to save career path.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSelectCareerPath = async (careerPath) => {
    setSelectedCareerPath(careerPath);
    setSaveMessage("");
  };

  const handleRegenerateRoadmap = async () => {
    if (!selectedCareerPath && !savedCareerPath) {
      return;
    }

    const targetCareerPath = selectedCareerPath || savedCareerPath;
    await loadRoadmap(targetCareerPath, true);
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <p className="sidebar-eyebrow">Career Guidance</p>
        <h2>Career Recommendations</h2>
        <p>Personalized guidance generated from your mock-test performance profile and coding behavior.</p>
        {loading ? <span className="dashboard-inline-hint">Loading recommendations...</span> : null}
        {error ? <span className="dashboard-inline-hint error-text">{error}</span> : null}
      </section>

      {insufficientData ? (
        <section className="card">
          <h3>Recommendation Status</h3>
          <p className="muted-text">{data.message}</p>
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Total Tests</p>
          <p className="stat-value">{data.totalTests}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Aptitude Avg</p>
          <p className="stat-value">{data.aptitudeAverage.toFixed(1)}%</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Technical Avg</p>
          <p className="stat-value">{data.technicalAverage.toFixed(1)}%</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Coding Avg</p>
          <p className="stat-value">{data.codingAverage.toFixed(1)}%</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">CGPA</p>
          <p className="stat-value">{data.cgpa.toFixed(1)}</p>
        </article>
      </section>

      <section className="card">
        <div className="career-roadmap-head">
          <div>
            <h3>Recommended Careers</h3>
            <p className="muted-text">AI now considers language preferences, performance signals, and topic depth.</p>
          </div>
          <span className="analytics-ai-source source-groq">
            {getRecommendationSourceLabel()}
          </span>
        </div>

        {!hasCareers ? (
          <p className="muted-text">No direct career match found yet. Keep practicing to improve profile confidence.</p>
        ) : (
          <>
          {data.recommendedCareer || data.bestPath ? (
              <div className="career-best-path">
                <span className="score-chip">Best Suited Path: {data.recommendedCareer || data.bestPath}</span>
              </div>
            ) : null}
            {data.reason ? <p className="muted-text">{data.reason}</p> : null}
            {data.confidence ? <p className="muted-text">Confidence: {data.confidence}</p> : null}
            <div className="career-grid">
              {data.recommendedPaths.map((career, index) => (
                <article className="career-card career-card-detailed" key={`${career?.role || "career"}-${index}`}>
                  <div className="career-card-headline">
                    <span className="career-icon" aria-hidden>
                      *
                    </span>
                    <p>{career?.role || "Career Path"}</p>
                  </div>
                  <span className="career-reason">{career?.reason || "Profile fit is improving."}</span>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="bottom-grid">
        <section className="card">
          <div className="section-head">
            <h3>Strong Skills</h3>
            <span className="analytics-topic-pill topic-pill-strong">Strengths</span>
          </div>
          {data.strengthSummary ? (
            <p className="muted-text">{data.strengthSummary}</p>
          ) : data.strongSkills.length === 0 ? (
            Array.isArray(data.strengths) && data.strengths.length > 0 ? (
              <ul className="analytics-ai-list">
                {data.strengths.map((item, index) => (
                  <li className="analytics-ai-list-item" key={`strength-${index}`}>
                    <strong>{item}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">No strong topics identified yet.</p>
            )
          ) : (
            <ul className="analytics-ai-list">
              {data.strongSkills.map((item, index) => (
                <li className="analytics-ai-list-item" key={`${item?.topic || "strong-skill"}-${index}`}>
                  <strong>{item?.topic || "Topic"}</strong>
                  <p className="muted-text">{item?.reason || "This topic is contributing positively to your current profile."}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>Areas to Improve</h3>
            <span className="analytics-topic-pill topic-pill-weak">Focus next</span>
          </div>
          {data.improvementSummary ? (
            <p className="muted-text">{data.improvementSummary}</p>
          ) : data.areasToImprove.length === 0 ? (
            Array.isArray(data.improvements) && data.improvements.length > 0 ? (
              <ul className="analytics-ai-list">
                {data.improvements.map((item, index) => (
                  <li className="analytics-ai-list-item" key={`improvement-${index}`}>
                    <strong>{item}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">No weak topics identified yet.</p>
            )
          ) : (
            <ul className="analytics-ai-list">
              {data.areasToImprove.map((item, index) => (
                <li className="analytics-ai-list-item" key={`${item?.topic || "area-to-improve"}-${index}`}>
                  <strong>{item?.topic || "Topic"}</strong>
                  <p className="muted-text">{item?.reason || "This topic needs focused revision in your next preparation cycle."}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Choose Your Career Path</h3>
          <span className="practice-chip">Personalize roadmap</span>
        </div>
        <p className="muted-text">Select the path you want to target. We will generate a roadmap from your scores, CGPA, topic profile, and coding behavior.</p>
        <div className="career-path-grid">
          {CAREER_PATH_OPTIONS.map((careerPath) => {
            const isSelected = selectedCareerPath === careerPath;
            return (
              <button
                type="button"
                key={careerPath}
                className={`career-path-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectCareerPath(careerPath)}
              >
                <span className="career-path-card-kicker">Career Path</span>
                <strong>{careerPath}</strong>
              </button>
            );
          })}
        </div>
        <div className="career-path-actions">
          <button type="button" className="topbar-logout" onClick={handleSaveCareerPath} disabled={saveLoading}>
            {saveLoading ? "Saving..." : "Save Career Path"}
          </button>
          {savedCareerPath ? (
            <span className="score-chip">Selected: {savedCareerPath}</span>
          ) : (
            <span className="dashboard-inline-hint">No career path selected yet.</span>
          )}
        </div>
        {saveMessage ? <p className="dashboard-inline-hint">{saveMessage}</p> : null}
      </section>

      <section className="card">
        <div className="career-roadmap-head">
          <div>
            <h3>Generated Roadmap</h3>
            <p className="muted-text">Progressive roadmap tailored to your selected career path, current scores, and previous plan.</p>
          </div>
          <div className="career-roadmap-meta">
            {roadmapData?.source ? (
              <span className="analytics-ai-source source-groq">{getRoadmapSourceLabel()}</span>
            ) : null}
            <button
              type="button"
              className="topbar-logout"
              onClick={handleRegenerateRoadmap}
              disabled={roadmapLoading || !(selectedCareerPath || savedCareerPath)}
            >
              {roadmapLoading ? "Generating..." : "Regenerate Roadmap"}
            </button>
          </div>
        </div>

        {roadmapLoading ? <p className="muted-text">Generating personalized roadmap...</p> : null}
        {!roadmapLoading && roadmapError ? <p className="dashboard-inline-hint error-text">{roadmapError}</p> : null}
        {!roadmapLoading && !roadmapError && !roadmapData?.careerPath ? (
          <p className="muted-text">Save a career path to generate your personalized roadmap.</p>
        ) : null}

        {!roadmapLoading && roadmapData?.careerPath ? (
          <>
            <div className="career-roadmap-summary">
              <span className="score-chip">Selected Career Path: {roadmapData.careerPath || data.selectedCareerPath || savedCareerPath || "-"}</span>
              {roadmapData?.note ? <p className="muted-text">{roadmapData.note}</p> : null}
            </div>
            {roadmapData?.whyThisCareerFits ? (
              <div className="career-roadmap-summary">
                <h4>Why This Career Fits</h4>
                <p className="muted-text">{roadmapData.whyThisCareerFits}</p>
              </div>
            ) : null}
            {Array.isArray(roadmapData?.improvementAdvice) && roadmapData.improvementAdvice.length > 0 ? (
              <div className="career-roadmap-summary">
                <h4>Improvement Advice</h4>
                <ul className="analytics-ai-list">
                  {roadmapData.improvementAdvice.map((item, index) => (
                    <li className="analytics-ai-list-item" key={`roadmap-advice-${index}`}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {roadmapData?.overallAnalysis ? (
              <div className="career-roadmap-summary">
                <h4>Overall Analysis</h4>
                <p className="muted-text">{roadmapData.overallAnalysis}</p>
              </div>
            ) : null}
            <div className="career-roadmap-grid">
              {(Array.isArray(roadmapData?.phases) ? roadmapData.phases : []).map((phase, index) => (
                <article className="career-roadmap-card" key={`${phase?.phase || "phase"}-${index}`}>
                  <h4 className="phase-title">{phase?.phase || `Phase ${index + 1}`}</h4>
                  {phase?.focus ? <p className="muted-text">{phase.focus}</p> : null}
                  {Array.isArray(phase?.topics) && phase.topics.length > 0 ? (
                    <div className="topic-chip-wrap">
                      {phase.topics.map((item, focusIndex) => (
                        <span className="weak-topic-badge" key={`${phase?.phase || "phase"}-topic-${focusIndex}`}>
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <ul className="analytics-ai-list">
                    {(Array.isArray(phase?.tasks) ? phase.tasks : []).map((task, taskIndex) => (
                      <li className="analytics-ai-list-item" key={`${phase?.phase || "phase"}-task-${taskIndex}`}>
                        {task}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default StudentRecommendations;
