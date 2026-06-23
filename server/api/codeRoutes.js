const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { submitCode } = require("../services/judge0Service");
const { evaluateCodingQuestionSubmission } = require("../services/mockTestService");

const router = express.Router();

const handleRun = async (req, res, next) => {
  try {
    const { sourceCode, languageId, stdin, code, language, input } = req.body || {};
    const finalCode = code || sourceCode;
    const finalLanguage = Number(language || languageId);
    const finalInput = input ?? stdin ?? "";

    if (!finalCode || !finalLanguage) {
      return res.status(400).json({
        success: false,
        message: "code and language are required."
      });
    }

    const result = await submitCode(finalCode, finalLanguage, finalInput);
    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    return next(error);
  }
};

router.post("/execute", protect, allowRoles("student", "mentor", "admin"), handleRun);
router.post("/run", protect, allowRoles("student", "mentor", "admin"), handleRun);

router.post("/evaluate", protect, allowRoles("student"), async (req, res, next) => {
  try {
    const result = await evaluateCodingQuestionSubmission(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
