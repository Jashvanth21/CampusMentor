const express = require("express");
const { getAnalytics } = require("../controllers/analyticsController");
const { getStudentFeedback } = require("../controllers/studentController");
const {
  getStudentProfileController,
  updateStudentProfileController,
  requestStudentCGPAUpdateController
} = require("../controllers/studentProfileController");
const {
  createStudentProfile,
  getStudentDashboard,
  getStudentAttemptHistory,
  getStudentTopicAnalytics
} = require("../services/studentService");
const { getCareerRecommendations } = require("../services/recommendationService");
const { getAIAdvisorReport } = require("../services/aiAdvisorService");
const { getCareerRecommendationsForStudent } = require("../services/careerRecommendationService");
const { getStudentPlacements } = require("../services/placementService");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

const respondWithResult = (serviceFn, resolveArgs = (req) => [req.user.id]) => async (req, res, next) => {
  try {
    const result = await serviceFn(...resolveArgs(req));
    const statusCode = req.method === "POST" ? 201 : 200;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
};

router.use(protect, allowRoles("student"));

router.post("/profile", respondWithResult(createStudentProfile, (req) => [req.user.id, req.body]));

router.get("/profile", getStudentProfileController);
router.put("/profile", updateStudentProfileController);
router.post("/request-cgpa-update", requestStudentCGPAUpdateController);

router.get("/dashboard", respondWithResult(getStudentDashboard));

router.get("/analytics", (req, res, next) => {
  return getAnalytics(req, res, next);
});

router.get("/attempt-history", respondWithResult(getStudentAttemptHistory));

router.get("/topic-analytics", respondWithResult(getStudentTopicAnalytics));

router.get("/feedback", getStudentFeedback);

router.get("/recommendations", respondWithResult(getCareerRecommendations));

router.get("/career-recommendations", respondWithResult(getCareerRecommendationsForStudent));

router.get("/career-recommendation", respondWithResult(getCareerRecommendationsForStudent));

router.get("/ai-report", respondWithResult(getAIAdvisorReport));

router.get("/placements", respondWithResult(getStudentPlacements));

module.exports = router;
