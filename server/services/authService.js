const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const buildPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt
});

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateJWT = (payload) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw createError("JWT_SECRET is not configured.", 500);
  }

  return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRES_IN });
};

const registerUser = async ({ name, email, password, role }) => {
  if (!name || !email || !password || !role) {
    throw createError("name, email, password and role are required.", 400);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    throw createError("A user with this email already exists.", 409);
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role
  });

  return {
    success: true,
    message: "User registered successfully"
  };
};

const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw createError("email and password are required.", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
  if (!user) {
    throw createError("Invalid email or password.", 401);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw createError("Invalid email or password.", 401);
  }

  const token = generateJWT({
    id: user._id.toString(),
    sub: user._id.toString(),
    role: String(user.role || "").toLowerCase()
  });

  return {
    success: true,
    token,
    role: user.role,
    user: buildPublicUser(user)
  };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const safeCurrentPassword = String(currentPassword || "");
  const safeNewPassword = String(newPassword || "");

  if (!safeCurrentPassword || !safeNewPassword) {
    throw createError("currentPassword and newPassword are required.", 400);
  }

  if (safeNewPassword.length < 8) {
    throw createError("New password must be at least 8 characters long.", 400);
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw createError("User account not found.", 404);
  }

  const isPasswordValid = await bcrypt.compare(safeCurrentPassword, user.password);
  if (!isPasswordValid) {
    throw createError("Current password is incorrect.", 401);
  }

  const isSamePassword = await bcrypt.compare(safeNewPassword, user.password);
  if (isSamePassword) {
    throw createError("New password must be different from the current password.", 400);
  }

  const hashedPassword = await bcrypt.hash(safeNewPassword, 12);
  await User.findByIdAndUpdate(userId, { password: hashedPassword });

  return {
    success: true,
    message: "Password changed successfully."
  };
};

module.exports = {
  registerUser,
  loginUser,
  changePassword,
  generateJWT
};
