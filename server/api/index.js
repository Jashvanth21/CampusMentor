const express = require("express");
const authRoutes = require("./authRoutes");
const studentRoutes = require("./studentRoutes");
const devTestRoutes = require("./devTestRoutes");
const mockTestRoutes = require("./mockTestRoutes");
const resultRoutes = require("./resultRoutes");
const analysisRoutes = require("./analysisRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const testAiRoutes = require("./testAiRoutes");
const testGroqRoutes = require("./testGroqRoutes");
const careerPathRoutes = require("./careerPathRoutes");
const roadmapRoutes = require("./roadmapRoutes");
const placementRoutes = require("./placementRoutes");
const mentorRoutes = require("./mentorRoutes");
const adminRoutes = require("./adminRoutes");
const testRoutes = require("./testRoutes");
const codeRoutes = require("./codeRoutes");
const chatRoutes = require("./chatRoutes");
const aiRoutes = require("./aiRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CampusMentor API is healthy"
  });
});

router.use("/auth", authRoutes);
router.use("/student", studentRoutes);
router.use("/results", resultRoutes);
router.use("/analysis", analysisRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/test-ai", testAiRoutes);
router.use("/test-groq", testGroqRoutes);
router.use("/career-path", careerPathRoutes);
router.use("/roadmap", roadmapRoutes);
router.use("/mentor", mentorRoutes);
router.use("/admin", adminRoutes);
router.use("/mocktests", mockTestRoutes);
router.use("/placement", placementRoutes);
router.use("/test", testRoutes);
router.use("/tests", testRoutes);
router.use("/code", codeRoutes);
router.use("/chat", chatRoutes);
router.use("/ai", aiRoutes);

if (process.env.NODE_ENV !== "production") {
  router.use("/dev", devTestRoutes);
}

module.exports = router;
