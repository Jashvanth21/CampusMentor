import api from "./axios";

const unwrapApiPayload = (response) => response?.data?.data || response?.data || {};
const AI_ANALYTICS_CACHE_PREFIX = "aiAnalytics_";
const AI_ANALYTICS_CACHE_VERSION = "v2";
const LAST_ATTEMPT_PREFIX = "lastAttempt_";
const CAREER_AI_CACHE_PREFIX = "careerAI_";

const getAIAnalyticsCacheKey = (userId) => `${AI_ANALYTICS_CACHE_PREFIX}${userId || "me"}_${AI_ANALYTICS_CACHE_VERSION}`;
const getLastAttemptKey = (userId) => `${LAST_ATTEMPT_PREFIX}${userId || "me"}`;
const getCareerAICacheKey = (userId) => `${CAREER_AI_CACHE_PREFIX}${userId || "me"}`;

const clearKeysByPrefix = (prefix) => {
  const keysToRemove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

const apiService = {
  getMockTests: async () => {
    const response = await api.get("/mocktests", {
      params: { ts: Date.now() }
    });
    return response.data;
  },

  getPublicMockTests: async () => {
    const response = await api.get("/mocktests/public", {
      params: { ts: Date.now() }
    });
    return response.data;
  },

  getTests: async () => {
    const response = await api.get("/mocktests", {
      params: { ts: Date.now() }
    });
    return response.data;
  },

  getMockTestById: async (testId) => {
    const response = await api.get(`/mocktests/${testId}`);
    return response.data;
  },

  createMockTest: async (payload) => {
    const response = await api.post("/mocktests", payload);
    return response.data;
  },

  createTest: async (payload) => {
    const response = await api.post("/mocktests", payload);
    return response.data;
  },

  updateMockTest: async (id, payload) => {
    const response = await api.put(`/mocktests/${id}`, payload);
    return response.data;
  },

  deleteMockTest: async (id) => {
    const response = await api.delete(`/mocktests/${id}`);
    return response.data;
  },

  toggleMockTestPublish: async (id) => {
    const response = await api.patch(`/mocktests/${id}/toggle-publish`, {});
    return response.data;
  },
  submitMockTest: async (testId, payload) => {
    const response = await api.post(`/mocktests/${testId}/submit`, payload);
    return response.data;
  },

  submitCodingTest: async (payload) => {
    const response = await api.post("/tests/submit", payload);
    return response.data;
  },

  startMockTest: async (testId, payload = {}) => {
    const response = await api.post(`/mocktests/${testId}/start`, payload);
    return response.data;
  },

  getStudentAnalytics: async () => {
    const response = await api.get("/student/analytics");
    return response.data;
  },

  getStudentAIAnalytics: async (userId) => {
    const response = await api.get(`/analytics/ai/${encodeURIComponent(userId || "me")}`);
    return response.data;
  },

  getStudentAIAnalyticsCacheKey: getAIAnalyticsCacheKey,

  getStudentLastAttemptKey: getLastAttemptKey,

  invalidateStudentAIAnalyticsCache: (userId) => {
    if (userId) {
      localStorage.removeItem(getAIAnalyticsCacheKey(userId));
      localStorage.removeItem(getLastAttemptKey(userId));
      return;
    }

    clearKeysByPrefix(AI_ANALYTICS_CACHE_PREFIX);
    clearKeysByPrefix(LAST_ATTEMPT_PREFIX);
  },

  markStudentAttemptUpdated: (userId, attemptedAt = new Date().toISOString()) => {
    if (userId) {
      localStorage.removeItem(getAIAnalyticsCacheKey(userId));
      localStorage.removeItem(getCareerAICacheKey(userId));
      localStorage.setItem(getLastAttemptKey(userId), String(attemptedAt));
      return;
    }

    clearKeysByPrefix(AI_ANALYTICS_CACHE_PREFIX);
    clearKeysByPrefix(CAREER_AI_CACHE_PREFIX);
    clearKeysByPrefix(LAST_ATTEMPT_PREFIX);
  },

  getStudentDashboard: async () => {
    const response = await api.get("/student/dashboard");
    return response.data;
  },

  getStudentProfile: async () => {
    const response = await api.get("/student/profile");
    return response.data;
  },

  updateStudentProfile: async (payload) => {
    const response = await api.put("/student/profile", payload);
    return response.data;
  },

  requestCgpaUpdate: async (requestedCGPA) => {
    const response = await api.post("/student/request-cgpa-update", { requestedCGPA });
    return response.data;
  },

  getStudentAttemptHistory: async () => {
    const response = await api.get("/student/attempt-history");
    return response.data;
  },

  getAttemptResult: async (attemptId) => {
    const response = await api.get(`/results/${attemptId}`);
    return response.data;
  },

  getAttemptAnalysis: async (attemptId) => {
    const response = await api.get(`/analysis/${attemptId}`);
    return response.data;
  },

  explainAttemptAnswer: async (payload) => {
    const response = await api.post("/ai/explain", payload);
    return response.data;
  },

  getStudentTopicAnalytics: async () => {
    const response = await api.get("/student/topic-analytics");
    return response.data;
  },

  getStudentFeedback: async () => {
    const response = await api.get("/student/feedback");
    return response.data;
  },

  getStudentCareerRecommendation: async () => {
    const response = await api.get("/student/career-recommendation");
    return response.data;
  },

  getStudentCareerRecommendationCacheKey: getCareerAICacheKey,

  invalidateCareerRecommendationCache: (userId) => {
    if (userId) {
      localStorage.removeItem(getCareerAICacheKey(userId));
      return;
    }

    clearKeysByPrefix(CAREER_AI_CACHE_PREFIX);
  },

  saveCareerPath: async (payload) => {
    const response = await api.post("/career-path", payload);
    return response.data;
  },

  getCareerRoadmap: async (careerPath = "", force = false) => {
    const params = {};
    if (careerPath) {
      params.careerPath = careerPath;
    }
    if (force) {
      params.force = true;
    }
    const response = await api.get("/roadmap", {
      params
    });
    return response.data;
  },

  getStudentPlacements: async () => {
    const response = await api.get("/student/placements");
    return response.data;
  },

  applyToPlacementDrive: async (driveId) => {
    const response = await api.post(`/placement/${driveId}/apply`);
    return response.data;
  },

  sendStudentChatMessage: async (payload) => {
    const response = await api.post("/chat", payload);
    return response.data;
  },

  getAIAdvisorReport: async () => {
    const response = await api.get("/student/ai-report");
    return response.data;
  },

  getMentorStudents: async (filters = {}) => {
    const params = {};
    if (filters.search) {
      params.search = filters.search;
    }
    if (filters.riskLevel && filters.riskLevel !== "all") {
      params.riskLevel = filters.riskLevel;
    }
    const response = await api.get("/mentor/students", { params });
    return unwrapApiPayload(response);
  },

  getMentorDashboard: async () => {
    const response = await api.get("/mentor/dashboard");
    return unwrapApiPayload(response);
  },

  getMentorStudentDetail: async (studentUserId) => {
    const response = await api.get(`/mentor/student/${studentUserId}`);
    return unwrapApiPayload(response);
  },

  getMentorStudentAttemptResult: async (studentUserId, attemptId) => {
    const response = await api.get(`/mentor/student/${studentUserId}/attempt/${attemptId}`);
    return response.data;
  },

  getMentorStudentAttemptAnalysis: async (studentUserId, attemptId) => {
    const response = await api.get(`/mentor/student/${studentUserId}/attempt/${attemptId}/analysis`);
    return response.data;
  },

  getMentorFeedback: async (studentUserId) => {
    const response = await api.get(`/mentor/feedback/${studentUserId}`);
    return unwrapApiPayload(response);
  },

  saveMentorFeedback: async (studentUserId, payload) => {
    const response = await api.post(`/mentor/feedback/${studentUserId}`, payload);
    return unwrapApiPayload(response);
  },

  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  changePassword: async (payload) => {
    const response = await api.put("/auth/change-password", payload);
    return response.data;
  },

  getAdminAnalytics: async (filters = {}) => {
    const params = {};
    if (filters.branch && filters.branch !== "All") {
      params.branch = filters.branch;
    }
    params.year = filters.year && filters.year !== "All" ? Number(filters.year) : "all";
    const response = await api.get("/admin/analytics", { params });
    return response.data;
  },

  getAdminCgpaRequests: async () => {
    const response = await api.get("/admin/cgpa-requests");
    return response.data;
  },

  reviewAdminCgpaRequest: async (requestId, status) => {
    const response = await api.put(`/admin/cgpa-requests/${requestId}`, { status });
    return response.data;
  },

  getAdminSystemAnalytics: async (filters = {}) => {
    const params = {};
    if (filters.branch && filters.branch !== "All") {
      params.branch = filters.branch;
    }
    if (filters.year && filters.year !== "All") {
      params.year = Number(filters.year);
    }
    const response = await api.get("/admin/system-analytics", { params });
    return response.data;
  },

  createAdminStudent: async (payload) => {
    const response = await api.post("/admin/students", payload);
    return response.data;
  },

  getAdminStudents: async (filters = {}) => {
    const params = {};
    if (filters.branch && filters.branch !== "All") {
      params.branch = filters.branch;
    }
    if (filters.year && filters.year !== "All") {
      params.year = Number(filters.year);
    }
    if (filters.mentor && filters.mentor !== "all") {
      params.mentor = filters.mentor;
    }
    const response = await api.get("/admin/students", { params });
    return response.data;
  },

  getAdminStudentPerformance: async (filters = {}) => {
    const params = {};
    if (filters.branch && filters.branch !== "All") {
      params.branch = filters.branch;
    }
    if (filters.year && filters.year !== "All") {
      params.year = Number(filters.year);
    }
    if (filters.placementStatus && filters.placementStatus !== "all") {
      params.placementStatus = filters.placementStatus;
    }
    if (filters.scoreRange && filters.scoreRange !== "all") {
      params.scoreRange = filters.scoreRange;
    }
    if (filters.search) {
      params.search = filters.search;
    }
    if (filters.sortBy && filters.sortBy !== "accuracy") {
      params.sortBy = filters.sortBy;
    }
    if (filters.sortOrder) {
      params.sortOrder = filters.sortOrder;
    }
    const response = await api.get("/admin/students/performance", { params });
    return response.data;
  },

  updateAdminStudent: async (studentId, payload) => {
    const response = await api.put(`/admin/students/${studentId}`, payload);
    return response.data;
  },

  deleteAdminStudent: async (studentId) => {
    const response = await api.delete(`/admin/students/${studentId}`);
    return response.data;
  },

  promoteBatch: async (batch) => {
    const response = await api.post("/admin/students/promote-batch", { batch });
    return response.data;
  },

  assignMentorToStudent: async ({ studentId, mentorId }) => {
    const response = await api.put("/admin/assign-mentor", { studentId, mentorId });
    return response.data;
  },

  createAdminMentor: async (payload) => {
    const response = await api.post("/admin/mentors", payload);
    return response.data;
  },

  getAdminMentors: async (filters = {}) => {
    const params = {};
    if (filters.department && filters.department !== "All") {
      params.department = filters.department;
    }
    const response = await api.get("/admin/mentors", { params });
    return response.data;
  },

  getAvailableMentorsByBranch: async (branch) => {
    const response = await api.get(`/admin/mentors/available/${encodeURIComponent(branch || "")}`);
    return response.data;
  },

  updateAdminMentor: async (mentorId, payload) => {
    const response = await api.put(`/admin/mentors/${mentorId}`, payload);
    return response.data;
  },

  deleteAdminMentor: async (mentorId) => {
    const response = await api.delete(`/admin/mentors/${mentorId}`);
    return response.data;
  },

  createPlacementDrive: async (payload) => {
    const response = await api.post("/admin/placement", payload);
    return response.data;
  },

  getPlacementDrives: async () => {
    const response = await api.get("/admin/placement");
    return response.data;
  },

  updatePlacementDrive: async (driveId, payload) => {
    const response = await api.put(`/admin/placement/${driveId}`, payload);
    return response.data;
  },

  deletePlacementDrive: async (driveId) => {
    const response = await api.delete(`/admin/placement/${driveId}`);
    return response.data;
  },

  togglePlacementDriveStatus: async (driveId) => {
    const response = await api.patch(`/placement/drives/${driveId}/toggle`);
    return response.data;
  },

  updatePlacementApplicationStatus: async (driveId, applicationId, status) => {
    const response = await api.put(`/admin/placement/${driveId}/applications/${applicationId}`, { status });
    return response.data;
  },

  runCodeOnJudge0: async ({ sourceCode, languageId, stdin }) => {
    const response = await api.post("/code/execute", {
      sourceCode,
      languageId: Number(languageId),
      stdin: stdin || ""
    });
    return response.data?.result || response.data;
  },

  runCode: async ({ code, language, input }) => {
    const response = await api.post("/code/run", {
      code,
      language: Number(language),
      input: input || ""
    });
    return response.data?.result || response.data;
  },

  evaluateCode: async ({ questionId, code, language }) => {
    const response = await api.post("/code/evaluate", {
      questionId,
      code,
      language: Number(language)
    });
    return response.data;
  }
};

export default apiService;
