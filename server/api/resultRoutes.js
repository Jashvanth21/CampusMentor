const express = require("express");
const { getStudentAttemptResult } = require("../services/studentService");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, allowRoles("student"));

router.get("/:attemptId", async (req, res, next) => {
  try {
    const result = await getStudentAttemptResult(req.user.id, req.params.attemptId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
