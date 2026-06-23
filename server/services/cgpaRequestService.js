const CGPAUpdateRequest = require("../models/CGPAUpdateRequest");
const Student = require("../models/Student");
const User = require("../models/User");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const ensureRole = async (userId, allowedRoles) => {
  const user = await User.findById(userId).select("_id role");
  if (!user) {
    throw createError("User account not found.", 404);
  }

  if (!allowedRoles.includes(String(user.role || "").toLowerCase())) {
    throw createError("Access denied for this role.", 403);
  }

  return user;
};

const mapRequest = (request) => ({
  id: request._id,
  studentId: request.studentId?._id || request.studentId,
  studentName: request.studentId?.name || "Student",
  studentEmail: request.studentId?.email || "",
  currentCGPA: Number(request.currentCGPA) || 0,
  requestedCGPA: Number(request.requestedCGPA) || 0,
  status: request.status || "pending",
  createdAt: request.createdAt || null,
  reviewedAt: request.reviewedAt || null
});

const requestCGPAUpdate = async (studentId, requestedCGPAInput) => {
  await ensureRole(studentId, ["student"]);

  const requestedCGPA = toNumber(requestedCGPAInput);
  if (!Number.isFinite(requestedCGPA) || requestedCGPA < 0 || requestedCGPA > 10) {
    throw createError("requestedCGPA must be between 0 and 10.", 400);
  }

  const studentProfile = await Student.findOne({ userId: studentId }).select("cgpa");
  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const currentCGPA = Number(studentProfile.cgpa) || 0;
  const existingPending = await CGPAUpdateRequest.findOne({
    studentId,
    status: "pending"
  }).sort({ createdAt: -1 });

  if (existingPending) {
    throw createError("A CGPA update request is already pending.", 409);
  }

  const request = await CGPAUpdateRequest.create({
    studentId,
    currentCGPA,
    requestedCGPA,
    status: "pending"
  });

  return {
    success: true,
    message: "CGPA update request submitted successfully.",
    request: mapRequest(request)
  };
};

const getLatestCGPARequestForStudent = async (studentId) => {
  const latestRequest = await CGPAUpdateRequest.findOne({ studentId }).sort({ createdAt: -1 });
  return latestRequest ? mapRequest(latestRequest) : null;
};

const getCGPARequests = async (adminId) => {
  await ensureRole(adminId, ["admin"]);

  const requests = await CGPAUpdateRequest.find({})
    .populate("studentId", "name email")
    .sort({ createdAt: -1 });

  return {
    success: true,
    requests: requests.map(mapRequest)
  };
};

const reviewCGPARequest = async (adminId, requestId, status) => {
  await ensureRole(adminId, ["admin"]);

  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!["approved", "rejected"].includes(normalizedStatus)) {
    throw createError("status must be approved or rejected.", 400);
  }

  const request = await CGPAUpdateRequest.findById(requestId);
  if (!request) {
    throw createError("CGPA update request not found.", 404);
  }

  if (request.status !== "pending") {
    throw createError("This CGPA request has already been reviewed.", 409);
  }

  request.status = normalizedStatus;
  request.reviewedAt = new Date();
  await request.save();

  if (normalizedStatus === "approved") {
    await Student.findOneAndUpdate(
      { userId: request.studentId },
      { $set: { cgpa: request.requestedCGPA } },
      { new: true }
    );
  }

  const populated = await CGPAUpdateRequest.findById(request._id).populate("studentId", "name email");

  return {
    success: true,
    message: `CGPA request ${normalizedStatus} successfully.`,
    request: mapRequest(populated)
  };
};

module.exports = {
  requestCGPAUpdate,
  getLatestCGPARequestForStudent,
  getCGPARequests,
  reviewCGPARequest
};
