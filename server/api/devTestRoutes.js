const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { runMockTestFull } = require("./devMockTestRunner");

const router = express.Router();

router.get("/ping", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is alive"
  });
});

router.get("/protected", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated access granted",
    user: req.user
  });
});

router.get("/student-only", protect, allowRoles("student"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "Student access granted"
  });
});

router.get("/mentor-only", protect, allowRoles("mentor"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "Mentor access granted"
  });
});

router.get("/admin-only", protect, allowRoles("admin"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin access granted"
  });
});

router.get("/run-mocktest-full", runMockTestFull);

module.exports = router;
