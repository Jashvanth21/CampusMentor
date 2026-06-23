const { getStudentFeedback: getStudentFeedbackService } = require("../services/studentService");

const getStudentFeedback = async (req, res, next) => {
  try {
    const result = await getStudentFeedbackService(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getStudentFeedback
};
