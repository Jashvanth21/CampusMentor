const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const {
  getAssignedStudents,
  getStudentDetailedAnalytics,
  getMentorStudentAttemptResult,
  getMentorStudentAttemptAnalysis,
  addMentorFeedback,
  getMentorFeedback,
  saveMentorFeedback
} = require("../services/mentorService");
const { getMentorDashboard } = require("../services/mentorAnalyticsService");

const router = express.Router();

router.use(protect, allowRoles("mentor"));

const getMentorIdFromRequest = (req) => req.user?.id || req.user?._id || req.query?.mentorId || null;

const sendMentorSuccess = (res, result) =>
  res.status(200).json({
    success: true,
    data: result
  });

const handleMentorError = (res, error) => {
  return res.status(error?.statusCode || 500).json({
    success: false,
    message: error?.message || "Internal Server Error"
  });
};

router.get("/dashboard", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await getMentorDashboard(mentorId);
    return sendMentorSuccess(res, result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.get("/students", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await getAssignedStudents(mentorId, req.query || {});
    return sendMentorSuccess(res, result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.get("/student/:id", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await getStudentDetailedAnalytics(mentorId, req.params.id);
    return sendMentorSuccess(res, result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.get("/student/:id/attempt/:attemptId", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await getMentorStudentAttemptResult(mentorId, req.params.id, req.params.attemptId);
    return res.status(200).json(result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.get("/student/:id/attempt/:attemptId/analysis", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await getMentorStudentAttemptAnalysis(mentorId, req.params.id, req.params.attemptId);
    return res.status(200).json(result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.get("/feedback/:studentId", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await getMentorFeedback(mentorId, req.params.studentId);
    return sendMentorSuccess(res, result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.post("/feedback/:studentId", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await saveMentorFeedback(mentorId, req.params.studentId, req.body || {});
    return sendMentorSuccess(res, result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

router.post("/student/:id/feedback", async (req, res, next) => {
  try {
    const mentorId = getMentorIdFromRequest(req);
    const result = await addMentorFeedback(mentorId, req.params.id, req.body || {});
    return sendMentorSuccess(res, result);
  } catch (error) {
    return handleMentorError(res, error);
  }
});

module.exports = router;
