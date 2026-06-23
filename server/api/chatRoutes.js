const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { postStudentChatMessage } = require("../controllers/chatController");

const router = express.Router();

router.use(protect, allowRoles("student"));
router.post("/", postStudentChatMessage);

module.exports = router;
