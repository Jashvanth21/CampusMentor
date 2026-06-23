const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  loginController,
  verifyTokenController,
  getCurrentUserController,
  changePasswordController
} = require("../controllers/authController");

const router = express.Router();

router.post("/login", loginController);
router.get("/verify-token", protect, verifyTokenController);
router.get("/me", protect, getCurrentUserController);
router.put("/change-password", protect, changePasswordController);

module.exports = router;
