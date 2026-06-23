const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { submitCodingTest } = require("../services/mockTestService");

const router = express.Router();

router.get("/protected", protect, (req, res) => {
  res.status(200).json({
    message: "Protected route working",
    user: req.user
  });
});

router.post("/submit", protect, allowRoles("student"), async (req, res, next) => {
  try {
    const result = await submitCodingTest(req.user.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
