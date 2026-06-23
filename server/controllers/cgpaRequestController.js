const { getCGPARequests, reviewCGPARequest } = require("../services/cgpaRequestService");

const getAdminCGPARequestsController = async (req, res, next) => {
  try {
    const result = await getCGPARequests(req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

const reviewCGPARequestController = async (req, res, next) => {
  try {
    const result = await reviewCGPARequest(req.user.id, req.params.id, req.body?.status);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAdminCGPARequestsController,
  reviewCGPARequestController
};
