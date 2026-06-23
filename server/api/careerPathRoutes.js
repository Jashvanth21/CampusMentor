const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { saveCareerPath } = require("../services/careerPathService");

const router = express.Router();

router.use(protect, allowRoles("student"));

router.post("/", async (req, res, next) => {
  try {
    const result = await saveCareerPath(req.user.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
