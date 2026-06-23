const express = require("express");
const { explainAnswer } = require("../controllers/aiController");
const { protect, allowRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, allowRoles("student"));
router.post("/explain", explainAnswer);

module.exports = router;
