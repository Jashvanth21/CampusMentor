const jwt = require("jsonwebtoken");
const User = require("../models/User");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.split(" ")[1];
};

const verifyToken = async (token) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw createError("JWT_SECRET is not configured.", 500);
  }

  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    throw createError("Invalid or expired token.", 401);
  }
};

const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw createError("Authorization token is required.", 401);
    }

    const decoded = await verifyToken(token);
    const userId = decoded?.id || decoded?.sub;
    const user = await User.findById(userId);

    if (!user) {
      throw createError("User account not found.", 401);
    }

    // Keep user payload aligned with JWT while preserving backward compatibility.
    const normalizedDecoded = {
      ...decoded,
      id: decoded?.id || decoded?.sub || user._id.toString(),
      _id: user._id.toString(),
      role: String(decoded?.role || user.role || "").toLowerCase(),
      name: decoded?.name || user.name,
      email: decoded?.email || user.email
    };
    req.user = normalizedDecoded;

    next();
  } catch (error) {
    next(error);
  }
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(createError("Authentication is required.", 401));
  }

  const allowedRoles = roles.map((role) => String(role).toLowerCase());
  const userRole = String(req.user.role || "").toLowerCase();

  if (!allowedRoles.includes(userRole)) {
    return next(createError("Access denied for this role.", 403));
  }

  return next();
};

module.exports = {
  verifyToken,
  protect,
  allowRoles
};
