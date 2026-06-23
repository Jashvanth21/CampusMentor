const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toDate = (value) => {
  const parsed = value ? new Date(value) : null;
  return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const getPromptAttempts = (detail = {}) => {
  if (Array.isArray(detail?.analyticsAI?.promptData?.attempts)) {
    return detail.analyticsAI.promptData.attempts;
  }

  if (Array.isArray(detail?.aiInsights?.promptData?.attempts)) {
    return detail.aiInsights.promptData.attempts;
  }

  return [];
};

const buildDailyAverageTrend = (attempts = []) => {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    return [];
  }

  const grouped = attempts.reduce((accumulator, attempt, index) => {
    const attemptedAt = toDate(attempt?.takenAt || attempt?.date || attempt?.submittedAt);
    const score = Number(attempt?.score);
    if (!attemptedAt || !Number.isFinite(score)) {
      return accumulator;
    }

    const dateKey = attemptedAt.toISOString().split("T")[0];
    if (!accumulator[dateKey]) {
      accumulator[dateKey] = {
        id: `${dateKey}-${index}`,
        date: attemptedAt,
        totalScore: 0,
        count: 0
      };
    }

    accumulator[dateKey].totalScore += score;
    accumulator[dateKey].count += 1;
    return accumulator;
  }, {});

  return Object.values(grouped)
    .map((entry) => ({
      id: entry.id,
      date: entry.date,
      avgScore: entry.totalScore / entry.count
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

const buildRequestMeta = (latestRequest) => {
  if (!latestRequest?.status) {
    return {
      statusLabel: "No Request",
      statusClassName: "status-none",
      summary: "No pending verification workflow."
    };
  }

  const normalizedStatus = String(latestRequest.status).toLowerCase();
  return {
    statusLabel: latestRequest.status.charAt(0).toUpperCase() + latestRequest.status.slice(1),
    statusClassName: `status-${normalizedStatus}`,
    summary: `Current: ${latestRequest.currentCGPA} | Requested: ${latestRequest.requestedCGPA}`
  };
};

const buildAttemptRows = (attempts = []) =>
  attempts
    .map((attempt, index) => {
      const attemptedAt = toDate(attempt?.attemptedAt || attempt?.date || attempt?.takenAt || attempt?.submittedAt);
      const score = toNumber(attempt?.score);
      const isPractice =
        attempt?.isFirstAttempt === false || String(attempt?.attemptMode || "").toLowerCase() === "practice";

      return {
        id: attempt?.id || attempt?.attemptId || `attempt-${index}`,
        title: attempt?.title || attempt?.testName || "Mock Test",
        date: attemptedAt,
        dateLabel: attemptedAt ? attemptedAt.toLocaleString() : "Date unavailable",
        score,
        scoreLabel: `${score.toFixed(1)}%`,
        status: isPractice ? "Practice" : "Counted",
        statusClassName: isPractice ? "is-practice" : "is-counted"
      };
    })
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

const buildTrendDataFromStudentApis = (attemptHistoryResponse, analyticsResponse) => {
  const performanceTrend = Array.isArray(attemptHistoryResponse?.performanceTrend)
    ? attemptHistoryResponse.performanceTrend
    : [];

  if (performanceTrend.length > 0) {
    return performanceTrend
      .map((item) => {
        const date = toDate(item?.date);
        if (!date) return null;
        return {
          id: `${date.getTime()}-${item?.score ?? 0}`,
          date,
          score: toNumber(item?.score)
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const analyticsTrend = Array.isArray(analyticsResponse?.trendData) ? analyticsResponse.trendData : [];
  return analyticsTrend
    .map((item) => {
      const date = toDate(item?.date);
      if (!date) return null;
      return {
        id: `${date.getTime()}-${item?.score ?? 0}`,
        date,
        score: toNumber(item?.score)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const buildStudentOverviewFromStudentApis = ({
  profileResponse,
  analyticsResponse,
  attemptHistoryResponse
}) => {
  const profile = profileResponse?.profile || null;
  const requestMeta = buildRequestMeta(profile?.latestCGPARequest || null);
  const attempts = Array.isArray(attemptHistoryResponse?.attempts) ? attemptHistoryResponse.attempts : [];
  const attemptRows = buildAttemptRows(
    attempts.map((attempt, index) => ({
      id: attempt?.attemptId || `${attempt?.testName || "mock-test"}-${index}`,
      title: attempt?.testName || "Mock Test",
      attemptedAt: attempt?.date,
      score: attempt?.score,
      attemptMode: attempt?.attemptMode || "Counted",
      isFirstAttempt: attempt?.isFirstAttempt !== false
    }))
  );

  const latestScore = attemptRows[0]?.score ?? 0;

  return {
    personalInfo: {
      fullName: profile?.fullName || "",
      email: profile?.email || ""
    },
    preparationProfile: {
      skills: Array.isArray(profile?.skills) ? profile.skills.join(", ") : "",
      careerGoal: profile?.careerGoal || ""
    },
    academicInfo: {
      branch: profile?.branch || "",
      year: profile?.year ?? "",
      cgpa: profile?.cgpa ?? "",
      requestStatusLabel: requestMeta.statusLabel,
      requestStatusClassName: requestMeta.statusClassName,
      requestSummary: requestMeta.summary
    },
    stats: [
      { label: "Overall Average", value: `${toNumber(analyticsResponse?.overallAverage).toFixed(1)}%` },
      { label: "Coding Average", value: `${toNumber(analyticsResponse?.codingAverage).toFixed(1)}%` },
      { label: "Tests Attempted", value: `${toNumber(attemptHistoryResponse?.totalAttempts || analyticsResponse?.totalTests)}` },
      { label: "Latest Score", value: `${latestScore.toFixed(1)}%` }
    ],
    trendData: buildTrendDataFromStudentApis(attemptHistoryResponse, analyticsResponse),
    attempts: attemptRows
  };
};

export const buildStudentOverviewFromMentorDetail = (detail) => {
  const profile = detail?.profile || {};
  const performance = detail?.performance || {};
  const promptAttempts = getPromptAttempts(detail);
  const attemptReviews = Array.isArray(detail?.attemptReviews) ? detail.attemptReviews : [];
  const rawHistory =
    attemptReviews.length > 0
      ? attemptReviews
      : profile?.performanceHistory ||
    performance?.history ||
    performance?.attempts ||
    [];

  const attemptRows = buildAttemptRows(
    Array.isArray(rawHistory)
      ? rawHistory.map((entry, index) => ({
          id: entry?.attemptId || entry?._id || entry?.id || `attempt-${index}`,
          title: entry?.testName || entry?.title || "Mock Test",
          attemptedAt: entry?.attemptedAt || entry?.takenAt || entry?.date || entry?.submittedAt,
          score: entry?.score,
          attemptMode: entry?.attemptMode || "Counted",
          isFirstAttempt: entry?.isFirstAttempt !== false
        }))
      : []
  );

  const latestScore = attemptRows[0]?.score ?? 0;

  return {
    personalInfo: {
      fullName: profile?.name || profile?.fullName || "",
      email: profile?.email || ""
    },
    preparationProfile: {
      skills: Array.isArray(profile?.skills) ? profile.skills.join(", ") : "",
      careerGoal: profile?.careerGoal || ""
    },
    academicInfo: {
      branch: profile?.branch || "",
      year: profile?.year ?? "",
      cgpa: profile?.cgpa ?? "",
      requestStatusLabel: profile?.mentorFeedback?.reviewed ? "Reviewed" : "Pending Review",
      requestStatusClassName: profile?.mentorFeedback?.reviewed ? "status-approved" : "status-pending",
      requestSummary: `Mentor Sincerity: ${profile?.mentorFeedback?.sincerityScore ?? "-"}/10`
    },
    stats: [
      { label: "Overall Average", value: `${toNumber(performance?.overallAverage).toFixed(1)}%` },
      { label: "Coding Average", value: `${toNumber(performance?.codingAverage).toFixed(1)}%` },
      { label: "Tests Attempted", value: `${toNumber(performance?.totalTests)}` },
      { label: "Latest Score", value: `${latestScore.toFixed(1)}%` }
    ],
    trendData: buildDailyAverageTrend(promptAttempts),
    attempts: attemptRows,
    meta: {
      subtitle: `${profile?.email || "-"} | Branch: ${profile?.branch || "-"} | Year: ${profile?.year || "-"} | CGPA: ${profile?.cgpa ?? "-"}`
    }
  };
};
