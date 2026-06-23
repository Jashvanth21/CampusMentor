const {
  loginUser,
  changePassword
} = require("../services/authService");

const loginController = async (req, res, next) => {
  try {
    const result = await loginUser(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const verifyTokenController = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Token is valid",
      user: req.user
    });
  } catch (error) {
    return next(error);
  }
};

const getCurrentUserController = async (req, res, next) => {
  try {
    return res.status(200).json({
      _id: req.user.id,
      name: req.user.name,
      role: req.user.role
    });
  } catch (error) {
    return next(error);
  }
};

const changePasswordController = async (req, res, next) => {
  try {
    const result = await changePassword(req.user.id, req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  loginController,
  verifyTokenController,
  getCurrentUserController,
  changePasswordController
};
