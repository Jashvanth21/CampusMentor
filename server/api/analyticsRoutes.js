const express = require("express");
const { getAnalyticsAI } = require("../controllers/analyticsAIController");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, allowRoles("student"));
router.get("/ai/:userId", getAnalyticsAI);

module.exports = router;
