import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import api from "../../api/axios";
import apiService from "../../api/apiService";
import { formatDuration } from "../../utils/timeFormat";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const StatCard = ({ title, value, suffix = "" }) => (
  <article className="stat-card">
    <p className="stat-label">{title}</p>
    <p className="stat-value">
      {value}
      {suffix}
    </p>
  </article>
);

const DEFAULT_ANALYTICS = {
  overallAverage: 0,
  codingAverage: 0,
  aptitudeAverage: 0,
  technicalAverage: 0,
  totalTests: 0,
  testsAttempted: 0,
  avgTimePerTest: 0,
  subjectBreakdown: [],
  trendData: [],
  codingVsAptitude: [],
  insights: [],
  weakTopics: [],
  strongTopics: [],
  performance: {}
};

const DEFAULT_AI_ANALYTICS = {
  success: false,
  source: "ai",
  summary: "",
  keyInsight: "",
  recommendation: "",
  insights: "",
  sections: {
    coding: {
      score: 0,
      level: "Average",
      explanation: "",
      improvementTips: []
    },
    aptitude: {
      score: 0,
      level: "Average",
      explanation: "",
      improvementTips: []
    },
    technical: {
      score: 0,
      level: "Average",
      explanation: "",
      improvementTips: []
    }
  },
  sectionScores: {
    coding: 0,
    aptitude: 0,
    technical: 0
  },
  strengths: [],
  weaknesses: [],
  strongTopics: [],
  weakTopics: [],
  promptData: {
    attempts: []
  },
  recommendations: [],
  studyPlan: []
};

const sanitizeArray = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : String(item?.description || item?.title || "").trim()
        )
        .filter(Boolean)
    : [];

const isLegacyAnalyticsCache = (payload) =>
  Boolean(payload) &&
  (
    (Array.isArray(payload?.recommendations) && payload.recommendations.some((item) => typeof item !== "string")) ||
    (Array.isArray(payload?.studyPlan) && payload.studyPlan.some((item) => typeof item !== "string")) ||
    (Array.isArray(payload?.strengths) && payload.strengths.some((item) => typeof item !== "string")) ||
    (Array.isArray(payload?.weaknesses) && payload.weaknesses.some((item) => typeof item !== "string"))
  );

const getPromptAttempts = (payload) =>
  Array.isArray(payload?.promptData?.attempts) ? payload.promptData.attempts : [];

const normalizeAIAnalytics = (aiResponse) =>
  aiResponse?.data && typeof aiResponse.data === "object"
    ? {
        ...DEFAULT_AI_ANALYTICS,
        success: Boolean(aiResponse?.success),
        source: "ai",
        ...aiResponse.data,
        promptData: {
          attempts: getPromptAttempts(aiResponse?.data)
        },
        keyInsight: String(aiResponse?.data?.keyInsight || "").trim(),
        recommendation: String(aiResponse?.data?.recommendation || "").trim(),
        strengths: sanitizeArray(aiResponse?.data?.strengths),
        weaknesses: sanitizeArray(aiResponse?.data?.weaknesses),
        strongTopics: sanitizeArray(aiResponse?.data?.strongTopics),
        weakTopics: sanitizeArray(aiResponse?.data?.weakTopics),
        recommendations: sanitizeArray(aiResponse?.data?.recommendations),
        studyPlan: sanitizeArray(aiResponse?.data?.studyPlan)
      }
    : {
        ...DEFAULT_AI_ANALYTICS,
        ...aiResponse,
        source: "ai",
        promptData: {
          attempts: getPromptAttempts(aiResponse)
        },
        keyInsight: String(aiResponse?.keyInsight || "").trim(),
        recommendation: String(aiResponse?.recommendation || "").trim(),
        strengths: sanitizeArray(aiResponse?.strengths),
        weaknesses: sanitizeArray(aiResponse?.weaknesses),
        strongTopics: sanitizeArray(aiResponse?.strongTopics),
        weakTopics: sanitizeArray(aiResponse?.weakTopics),
        recommendations: sanitizeArray(aiResponse?.recommendations),
        studyPlan: sanitizeArray(aiResponse?.studyPlan)
      };

const getLatestAttemptTimestamp = (analytics) => String(analytics?.latestAttempt?.date || "");

const getMetricClass = (score) => {
  if (score >= 70) return "metric-good";
  if (score >= 40) return "metric-mid";
  return "metric-low";
};

const getLevelClass = (level) => {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "good") return "ai-level-good";
  if (normalized === "poor") return "ai-level-poor";
  return "ai-level-average";
};

const formatAvgTimeLabel = (minutesValue) => {
  if (minutesValue === null || minutesValue === undefined || minutesValue === "") {
    return "No data available";
  }

  const safeMinutes = Number(minutesValue);
  if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) {
    return "No data available";
  }

  return formatDuration(safeMinutes * 60);
};

const formatSourceLabel = () => "AI";

const buildTrendDataFromAttempts = (attempts) => {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return [];
  }

  const grouped = attempts.reduce((accumulator, attempt) => {
    const takenAt = attempt?.takenAt;
    const score = Number(attempt?.score);
    if (!takenAt || !Number.isFinite(score)) {
      return accumulator;
    }

    const parsedDate = new Date(takenAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return accumulator;
    }

    const date = parsedDate.toISOString().split("T")[0];
    if (!accumulator[date]) {
      accumulator[date] = { totalScore: 0, count: 0 };
    }

    accumulator[date].totalScore += score;
    accumulator[date].count += 1;
    return accumulator;
  }, {});

  return Object.keys(grouped)
    .map((date) => ({
      date,
      avgScore: grouped[date].totalScore / grouped[date].count
    }))
    .sort((left, right) => new Date(left.date) - new Date(right.date));
};

const calculateAverageTimePerTest = (attempts) => {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return null;
  }

  const validTimes = attempts
    .map((attempt) => Number(attempt?.timeTaken))
    .filter((timeTaken) => Number.isFinite(timeTaken) && timeTaken > 0);

  if (validTimes.length === 0) {
    return null;
  }

  const totalTime = validTimes.reduce((sum, timeTaken) => sum + timeTaken, 0);
  return totalTime / validTimes.length;
};

const StudentAnalytics = () => {
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [aiAnalytics, setAIAnalytics] = useState(DEFAULT_AI_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      let nextUserId = "me";
      let basicAnalyticsPayload = DEFAULT_ANALYTICS;

      try {
        setLoading(true);
        setError("");

        const basicAnalytics = await api.get("/student/analytics");
        basicAnalyticsPayload = basicAnalytics?.data || DEFAULT_ANALYTICS;
        console.log("Student analytics response:", basicAnalyticsPayload);

        setAnalytics({
          ...DEFAULT_ANALYTICS,
          ...(basicAnalyticsPayload || {})
        });

        const currentUser = await apiService.getCurrentUser();
        nextUserId = currentUser?._id || "me";
      } catch (requestError) {
        setError("Unable to load analytics right now. Showing default stats.");
        setAnalytics(DEFAULT_ANALYTICS);
        return;
      }

      try {
        const cacheKey = apiService.getStudentAIAnalyticsCacheKey(nextUserId);
        const lastAttemptKey = apiService.getStudentLastAttemptKey(nextUserId);
        const legacyCacheKey = `aiAnalytics_${nextUserId || "me"}`;
        const cachedAnalytics = localStorage.getItem(cacheKey);
        const cachedLastAttempt = localStorage.getItem(lastAttemptKey);
        const currentLastAttempt = getLatestAttemptTimestamp(basicAnalyticsPayload);
        const isNewAttempt = cachedLastAttempt !== currentLastAttempt;

        if (legacyCacheKey !== cacheKey) {
          localStorage.removeItem(legacyCacheKey);
        }

        if (cachedAnalytics && !isNewAttempt) {
          try {
            const parsedCache = JSON.parse(cachedAnalytics);
            if (parsedCache && typeof parsedCache === "object") {
              if (isLegacyAnalyticsCache(parsedCache)) {
                localStorage.removeItem(cacheKey);
                localStorage.removeItem(lastAttemptKey);
              } else {
                const sanitizedCache = normalizeAIAnalytics(parsedCache);
                setAIAnalytics({
                  ...DEFAULT_AI_ANALYTICS,
                  ...sanitizedCache
                });
                setAnalytics((prev) => ({
                  ...prev,
                  ai: parsedCache?.data || sanitizedCache || null
                }));
                return;
              }
            }
          } catch (parseError) {
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(lastAttemptKey);
          }
        }

        setLoadingAI(true);
        const aiAnalyticsResponse = await api.get(`/analytics/ai/${encodeURIComponent(nextUserId)}`);
        const normalizedAI = normalizeAIAnalytics(aiAnalyticsResponse?.data);

        setAIAnalytics(normalizedAI);
        setAnalytics((prev) => ({
          ...prev,
          ai: aiAnalyticsResponse?.data?.data || null
        }));
        localStorage.setItem(cacheKey, JSON.stringify(normalizedAI));
        localStorage.setItem(lastAttemptKey, currentLastAttempt);
      } catch {
      } finally {
        setLoadingAI(false);
      }
    };

    fetchAnalytics().finally(() => {
      setLoading(false);
    });
  }, []);

  const totalTests = toNumber(analytics?.totalTests ?? analytics?.performance?.totalTests);
  const overallAverage = toNumber(analytics?.overallAverage ?? analytics?.performance?.overallAverage).toFixed(1);
  const codingAverage = toNumber(analytics?.codingAverage ?? analytics?.performance?.codingAverage).toFixed(1);
  const promptAttempts = useMemo(() => getPromptAttempts(aiAnalytics), [aiAnalytics]);
  const avgTimePerTestMinutes = useMemo(() => calculateAverageTimePerTest(promptAttempts), [promptAttempts]);
  const avgTimePerTestLabel = formatAvgTimeLabel(avgTimePerTestMinutes);

  const trendData = useMemo(() => {
    const promptTrendData = buildTrendDataFromAttempts(promptAttempts);
    if (promptTrendData.length > 0) {
      return promptTrendData;
    }

    return [];
  }, [promptAttempts]);

  const subjectChartData = useMemo(() => {
    const testsCount = toNumber(analytics?.totalTests ?? analytics?.testsAttempted ?? analytics?.performance?.totalTests);
    if (testsCount <= 0) {
      return [];
    }

    const breakdown = Array.isArray(analytics?.subjectBreakdown) ? analytics.subjectBreakdown : [];
    const normalizedBreakdown = breakdown
      .map((item) => ({
        name: item?.name || item?.subject || "Unknown",
        score: toNumber(item?.score ?? item?.averageScore)
      }))
      .filter((item) => item.name);

    if (normalizedBreakdown.length > 0) {
      return normalizedBreakdown;
    }

    return [
      { name: "Coding", score: toNumber(analytics?.codingAverage) },
      { name: "Aptitude", score: toNumber(analytics?.aptitudeAverage) },
      { name: "Technical", score: toNumber(analytics?.technicalAverage) }
    ];
  }, [analytics]);

  const codingVsAptitude = useMemo(() => {
    const testsCount = toNumber(analytics?.totalTests ?? analytics?.testsAttempted ?? analytics?.performance?.totalTests);
    if (testsCount <= 0) {
      return [];
    }

    const raw = Array.isArray(analytics?.codingVsAptitude) ? analytics.codingVsAptitude : [];
    const normalized = raw.map((item) => ({
      name: item?.name || item?.label || "Unknown",
      score: toNumber(item?.score)
    }));

    if (normalized.length > 0) {
      return normalized;
    }

    return [
      { name: "Coding", score: toNumber(analytics?.codingAverage) },
      { name: "Aptitude", score: toNumber(analytics?.aptitudeAverage) }
    ];
  }, [analytics]);

  const aiWeakTopics = useMemo(
    () =>
      (
        Array.isArray(analytics?.weakTopics) && analytics.weakTopics.length > 0
          ? analytics.weakTopics
          : Array.isArray(aiAnalytics?.weaknesses) && aiAnalytics.weaknesses.length > 0
            ? aiAnalytics.weaknesses
            : aiAnalytics?.weakTopics || []
      ).slice(0, 8),
    [aiAnalytics, analytics]
  );
  const aiStrongTopics = useMemo(
    () =>
      (
        Array.isArray(analytics?.strongTopics) && analytics.strongTopics.length > 0
          ? analytics.strongTopics
          : Array.isArray(aiAnalytics?.strengths) && aiAnalytics.strengths.length > 0
            ? aiAnalytics.strengths
            : aiAnalytics?.strongTopics || []
      ).slice(0, 8),
    [aiAnalytics, analytics]
  );
  const aiRecommendations = useMemo(
    () => (Array.isArray(aiAnalytics?.recommendations) ? aiAnalytics.recommendations : []),
    [aiAnalytics]
  );
  const aiStudyPlan = useMemo(
    () => (Array.isArray(aiAnalytics?.studyPlan) ? aiAnalytics.studyPlan : []),
    [aiAnalytics]
  );
  const aiSourceLabel = formatSourceLabel();
  const hasEnoughAttemptsForAILists = totalTests >= 2;

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <p className="sidebar-eyebrow">Deep Analysis</p>
        <h2>Student Analytics</h2>
        <p>Track your latest performance across mock tests and subjects.</p>
        {loading ? <span className="dashboard-inline-hint">Loading analytics...</span> : null}
        {error ? <span className="dashboard-inline-hint error-text">{error}</span> : null}
      </section>

      <section className="stats-grid">
        <StatCard title="Total Tests Attempted" value={totalTests} />
        <StatCard title="Overall Average" value={overallAverage} suffix="%" />
        <StatCard title="Coding Average" value={codingAverage} suffix="%" />
        <StatCard title="Avg Time / Test" value={avgTimePerTestLabel} />
      </section>

      <section className="card analytics-ai-summary-card">
        <div className="analytics-ai-summary-head">
          <div>
            <h3>AI Performance Summary</h3>
            <p className="muted-text">Advanced section-wise and topic-wise insights based on your counted attempts.</p>
          </div>
          {aiAnalytics?.source ? (
            <span className="analytics-ai-source source-groq">{aiSourceLabel}</span>
          ) : null}
        </div>
        {loadingAI ? <p className="dashboard-inline-hint">Generating AI Insights...</p> : null}
        {aiAnalytics?.summary ? (
          <>
            <p className="analytics-ai-summary-text">{aiAnalytics.summary}</p>
            {aiAnalytics?.keyInsight ? (
              <p className="analytics-ai-keyline">
                Key insight: <strong>{aiAnalytics.keyInsight}</strong>
              </p>
            ) : null}
            {aiAnalytics?.recommendation ? (
              <p className="muted-text">{aiAnalytics.recommendation}</p>
            ) : null}
          </>
        ) : (
          <p className="muted-text">AI insights will appear after your analytics data is available.</p>
        )}
      </section>

      <section className="analytics-ai-section-grid">
        {["coding", "aptitude", "technical"].map((sectionKey) => {
          const label = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
          const section = aiAnalytics?.sections?.[sectionKey] || {};
          const level = section?.level || "Average";
          const scoreValue = toNumber(section?.score ?? aiAnalytics?.sectionScores?.[sectionKey]);
          const description = section?.explanation || "No analysis available yet.";
          const improvementTips = Array.isArray(section?.improvementTips) ? section.improvementTips.slice(0, 3) : [];

          return (
            <article className="analytics-ai-section-card" key={sectionKey}>
              <div className="analytics-ai-section-head">
                <h3>{label} Analysis</h3>
                <span className={`analytics-ai-level ${getLevelClass(level)}`}>{level}</span>
              </div>
              <p className={`analytics-ai-score ${getMetricClass(scoreValue)}`}>{scoreValue.toFixed(1)}%</p>
              <p className="analytics-ai-explanation">{description}</p>
              {improvementTips.length > 0 ? (
                <ul className="analytics-ai-tips">
                  {improvementTips.map((tip, index) => (
                    <li key={`${sectionKey}-tip-${index}`}>{tip}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="chart-section">
        <div className="section-head">
          <h3>Performance Trend</h3>
          <span className="score-chip">{trendData.length} data points</span>
        </div>
        {trendData.length === 0 ? (
          <p className="muted-text">No data available</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avgScore" stroke="#27d1ff" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="chart-section">
        <div className="section-head">
          <h3>Subject Performance</h3>
          <span className="practice-chip">Subject breakdown</span>
        </div>
        {subjectChartData.length === 0 ? (
          <p className="muted-text">No subject performance data yet. Attempt a test to populate this chart.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#7c5cff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="chart-section">
        <div className="section-head">
          <h3>Coding vs Aptitude</h3>
          <span className="score-chip">Comparative view</span>
        </div>
        {codingVsAptitude.length === 0 ? (
          <p className="muted-text">Comparison data unavailable yet.</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={codingVsAptitude}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#1ec8a5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="bottom-grid">
        <section className="card analytics-ai-topic-card">
          <div className="analytics-ai-topic-head">
            <h3>Weak Topics</h3>
            <span className="analytics-topic-pill topic-pill-weak">Needs Practice</span>
          </div>
          {aiWeakTopics.length === 0 ? (
            <p className="muted-text">No clear weak topics identified yet.</p>
          ) : (
            <div className="analytics-topic-chip-list">
              {aiWeakTopics.map((topic, index) => (
                <span className="analytics-topic-chip weak" key={`${topic}-ai-weak-${index}`}>
                  {topic}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card analytics-ai-topic-card">
          <div className="analytics-ai-topic-head">
            <h3>Strong Topics</h3>
            <span className="analytics-topic-pill topic-pill-strong">Doing Well</span>
          </div>
          {aiStrongTopics.length === 0 ? (
            <p className="muted-text">No clear strong topics identified yet.</p>
          ) : (
            <div className="analytics-topic-chip-list">
              {aiStrongTopics.map((topic, index) => (
                <span className="analytics-topic-chip strong" key={`${topic}-ai-strong-${index}`}>
                  {topic}
                </span>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="bottom-grid">
        <section className="card">
          <div className="section-head">
            <h3>Recommendations</h3>
            <span className="practice-chip">Next steps</span>
          </div>
          {!hasEnoughAttemptsForAILists ? (
            <p className="muted-text">Attempt at least 2 counted tests to unlock AI recommendations.</p>
          ) : aiRecommendations.length === 0 ? (
            <p className="muted-text">Recommendations will appear after enough analytics data is collected.</p>
          ) : (
            <ul className="analytics-ai-list">
              {aiRecommendations.map((item, index) => (
                <li className="analytics-ai-list-item" key={`recommendation-${index}`}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>Study Plan</h3>
            <span className="score-chip">Guided revision</span>
          </div>
          {!hasEnoughAttemptsForAILists ? (
            <p className="muted-text">Attempt at least 2 counted tests to unlock your study plan.</p>
          ) : aiStudyPlan.length === 0 ? (
            <p className="muted-text">A study plan will appear after enough analytics data is available.</p>
          ) : (
            <ul className="analytics-ai-list">
              {aiStudyPlan.map((item, index) => (
                <li className="analytics-ai-list-item" key={`study-plan-${index}`}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
};

export default StudentAnalytics;
