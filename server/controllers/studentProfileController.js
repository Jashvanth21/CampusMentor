const { getStudentProfile, updateStudentProfile } = require("../services/studentService");
const { requestCGPAUpdate } = require("../services/cgpaRequestService");

const getStudentProfileController = async (req, res, next) => {
  try {
    const result = await getStudentProfile(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const updateStudentProfileController = async (req, res, next) => {
  try {
    const { skills, careerGoal } = req.body || {};
    console.log("Update student profile req.body:", req.body);
    const result = await updateStudentProfile(req.user.id, {
      ...(req.body || {}),
      skills,
      careerGoal: careerGoal === undefined ? "" : careerGoal
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const requestStudentCGPAUpdateController = async (req, res, next) => {
  try {
    const result = await requestCGPAUpdate(req.user.id, req.body?.requestedCGPA);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getStudentProfileController,
  updateStudentProfileController,
  requestStudentCGPAUpdateController
};
