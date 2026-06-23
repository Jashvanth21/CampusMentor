const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { getCareerRoadmap } = require("../services/careerPathService");

const router = express.Router();

router.use(protect, allowRoles("student"));

router.get("/", async (req, res, next) => {
  try {
    const result = await getCareerRoadmap(req.user.id, {
      careerPath: String(req.query.careerPath || "").trim(),
      forceRegenerate: String(req.query.force || "").toLowerCase() === "true"
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
