const Student = require("../models/Student");
const User = require("../models/User");
const PlacementDrive = require("../models/PlacementDrive");
const PlacementApplication = require("../models/PlacementApplication");
const { loadStudentWithTestData } = require("./studentTestDataService");
const { filterValidBranches } = require("../constants/branches");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureRole = async (userId, allowedRoles) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createError("User account not found.", 404);
  }

  if (!allowedRoles.includes(user.role)) {
    throw createError("Access denied for this role.", 403);
  }

  return user;
};

const isObjectIdInList = (list, value) => {
  const valueStr = String(value);
  return (list || []).some((item) => String(item) === valueStr);
};

const normalizeBranches = (branches) => {
  return filterValidBranches(branches);
};

const normalizeBatches = (batches) => {
  if (!Array.isArray(batches)) return [];
  return batches
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

const toDateSafe = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDriveStatus = (drive) => (drive?.isActive === false ? "Inactive" : "Active");

const isDriveActive = (drive) => drive?.isActive !== false;

const normalizeApplicationStatus = (status) => {
  const normalizedStatus = String(status || "applied").trim().toLowerCase();
  if (normalizedStatus === "shortlisted") {
    return "applied";
  }

  if (normalizedStatus === "placed" || normalizedStatus === "selected") {
    return "selected";
  }

  if (["applied", "rejected"].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return "applied";
};

const isStudentVisibleForDrive = (studentProfile, drive) => {
  const studentBranch = String(studentProfile?.branch || "").trim().toLowerCase();
  const studentBatchRaw = studentProfile?.batch;
  const studentBatch = Number.isFinite(Number(studentBatchRaw)) ? Number(studentBatchRaw) : null;
  const branchesEligible = normalizeBranches(drive?.branchesEligible ?? drive?.eligibleBranches);
  const eligibleBatches = normalizeBatches(drive?.eligibleBatches);
  const branchEligible =
    branchesEligible.length === 0 ||
    branchesEligible.map((branch) => branch.toLowerCase()).includes(studentBranch);
  const batchEligible =
    eligibleBatches.length === 0 || (studentBatch !== null && eligibleBatches.includes(studentBatch));

  return {
    branchEligible,
    batchEligible,
    visible: branchEligible && batchEligible
  };
};

const buildStudentMetaMap = async (applications) => {
  const studentIds = Array.from(
    new Set(
      (applications || [])
        .map((application) => application?.studentId?._id || application?.studentId)
        .filter(Boolean)
        .map((value) => String(value))
    )
  );

  if (studentIds.length === 0) {
    return new Map();
  }

  const profiles = await Student.find({ userId: { $in: studentIds } })
    .select("userId cgpa branch year")
    .lean();

  return new Map(
    profiles.map((profile) => [
      String(profile.userId),
      {
        cgpa: Number.isFinite(Number(profile?.cgpa)) ? Number(profile.cgpa) : null,
        branch: profile?.branch || "-",
        year: profile?.year || "-"
      }
    ])
  );
};

const toApplicationSummary = (application, studentMetaMap = new Map()) => {
  const studentId = String(application?.studentId?._id || application?.studentId || "");
  const studentMeta = studentMetaMap.get(studentId) || {};
  const normalizedStatus = normalizeApplicationStatus(application?.status);

  return {
    id: application?._id,
    studentId,
    status: normalizedStatus,
    studentName: application?.studentId?.name || "Student",
    branch: application?.studentId?.branch || studentMeta.branch || "-",
    year: application?.studentId?.year || studentMeta.year || "-",
    cgpa: studentMeta.cgpa,
    updatedAt: application?.updatedAt || application?.createdAt || null,
    createdAt: application?.createdAt || null
  };
};

const buildDriveApplicationData = async (drives = []) => {
  const driveIds = drives.map((drive) => drive._id);
  const applications = driveIds.length
    ? await PlacementApplication.find({ driveId: { $in: driveIds } })
      .populate("studentId", "name branch year")
      .sort({ updatedAt: -1, createdAt: -1 })
    : [];

  const studentMetaMap = await buildStudentMetaMap(applications);
  const applicationsByDriveId = new Map();

  applications.forEach((application) => {
    const driveId = String(application.driveId);
    const current = applicationsByDriveId.get(driveId) || [];
    current.push(toApplicationSummary(application, studentMetaMap));
    applicationsByDriveId.set(driveId, current);
  });

  const placedApplications = applications
    .filter((application) => normalizeApplicationStatus(application?.status) === "selected")
    .map((application) => ({
      driveId: String(application.driveId),
      ...toApplicationSummary(application, studentMetaMap)
    }))
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());

  return {
    applicationsByDriveId,
    placedApplications
  };
};

const buildPlacementSummary = (drives = [], applicationsByDriveId = new Map(), placedApplications = []) => {
  const allApplications = Array.from(applicationsByDriveId.values()).flat();
  const uniquePlacedStudentIds = new Set(placedApplications.map((application) => application.studentId).filter(Boolean));

  return {
    totalDrives: drives.length,
    activeDrives: drives.filter((drive) => isDriveActive(drive)).length,
    totalApplications: allApplications.length,
    totalPlaced: placedApplications.length,
    totalPlacedStudents: uniquePlacedStudentIds.size,
    recentPlacements: placedApplications.slice(0, 5).map((application) => {
      const drive = drives.find((item) => String(item._id) === String(application.driveId));
      return {
        id: application.id,
        studentId: application.studentId,
        studentName: application.studentName,
        branch: application.branch,
        year: application.year,
        companyName: drive?.companyName || "Company",
        role: drive?.role || "Role",
        placedAt: application.updatedAt
      };
    })
  };
};

const toDrivePayload = (drive, options = {}) => {
  const cgpaCriteria = Number.isFinite(Number(drive?.cgpaCriteria))
    ? Number(drive.cgpaCriteria)
    : Number(drive?.minCGPA) || 0;
  const applications = (Array.isArray(options.applications) ? options.applications : []).map((application) => ({
    ...application,
    status: normalizeApplicationStatus(application?.status)
  }));
  const appliedStudents = applications.filter((item) => item.status === "applied");
  const placedStudents = applications.filter((item) => item.status === "selected");
  const rejectedStudents = applications.filter((item) => item.status === "rejected");
  const status = getDriveStatus(drive);

  return {
    id: drive?._id,
    companyName: drive?.companyName || "",
    role: drive?.role || "",
    package: Number(drive?.package) || 0,
    location: drive?.location || "",
    cgpaCriteria,
    branchesEligible: normalizeBranches(drive?.branchesEligible ?? drive?.eligibleBranches),
    eligibleBatches: normalizeBatches(drive?.eligibleBatches),
    testType: drive?.testType || "",
    applicationDeadline: drive?.applicationDeadline || null,
    driveDate: drive?.driveDate || null,
    description: drive?.description || "",
    applyLink: drive?.applyLink || "",
    status,
    isActive: isDriveActive(drive),
    totalApplications: applications.length,
    applicantsCount: appliedStudents.length,
    selectedCandidatesCount: placedStudents.length,
    rejectedCount: rejectedStudents.length,
    applications,
    appliedStudents,
    placedStudents,
    placedStudentsPreview: placedStudents.slice(0, 5),
    createdBy: drive?.createdBy || null,
    createdAt: drive?.createdAt || null
  };
};

const sanitizeDriveInput = (data = {}) => {
  const cgpaCriteria = Number(data?.cgpaCriteria ?? data?.minCGPA);
  return {
    companyName: String(data?.companyName || "").trim(),
    role: String(data?.role || "").trim(),
    package: Number(data?.package) || 0,
    location: String(data?.location || "").trim(),
    cgpaCriteria: Number.isFinite(cgpaCriteria) ? cgpaCriteria : 0,
    branchesEligible: normalizeBranches(data?.branchesEligible ?? data?.eligibleBranches),
    eligibleBatches: normalizeBatches(data?.eligibleBatches),
    testType: String(data?.testType || "").trim(),
    applicationDeadline: data?.applicationDeadline || null,
    driveDate: data?.driveDate || null,
    description: String(data?.description || "").trim(),
    applyLink: String(data?.applyLink || "").trim()
  };
};

const createPlacementDrive = async (adminId, data) => {
  await ensureRole(adminId, ["admin"]);
  const payload = sanitizeDriveInput(data);

  if (!payload.companyName) {
    throw createError("companyName is required.", 400);
  }
  if (!payload.role) {
    throw createError("role is required.", 400);
  }

  const drive = await PlacementDrive.create({
    ...payload,
    isActive: data?.isActive === false ? false : true,
    minCGPA: payload.cgpaCriteria,
    createdBy: adminId
  });

  return {
    success: true,
    message: "Placement drive created successfully.",
    drive: toDrivePayload(drive)
  };
};

const getAdminPlacementDrives = async (adminId) => {
  await ensureRole(adminId, ["admin"]);

  const drives = await PlacementDrive.find({}).sort({ createdAt: -1 }).lean();
  const { applicationsByDriveId, placedApplications } = await buildDriveApplicationData(drives);

  return {
    success: true,
    summary: buildPlacementSummary(drives, applicationsByDriveId, placedApplications),
    drives: drives.map((drive) =>
      toDrivePayload(drive, {
        applications: applicationsByDriveId.get(String(drive._id)) || []
      })
    )
  };
};

const updatePlacementDrive = async (adminId, driveId, data) => {
  await ensureRole(adminId, ["admin"]);
  const payload = sanitizeDriveInput(data);

  const drive = await PlacementDrive.findById(driveId);
  if (!drive) {
    throw createError("Placement drive not found.", 404);
  }

  Object.assign(drive, payload, { minCGPA: payload.cgpaCriteria });
  await drive.save();

  return {
    success: true,
    message: "Placement drive updated successfully.",
    drive: toDrivePayload(drive)
  };
};

const deletePlacementDrive = async (adminId, driveId) => {
  await ensureRole(adminId, ["admin"]);

  const drive = await PlacementDrive.findByIdAndDelete(driveId);
  if (!drive) {
    throw createError("Placement drive not found.", 404);
  }

  await PlacementApplication.deleteMany({ driveId });

  return {
    success: true,
    message: "Placement drive deleted successfully."
  };
};

const togglePlacementDriveStatus = async (adminId, driveId) => {
  await ensureRole(adminId, ["admin"]);

  const drive = await PlacementDrive.findById(driveId);
  if (!drive) {
    throw createError("Placement drive not found.", 404);
  }

  drive.isActive = !isDriveActive(drive);
  await drive.save();

  return {
    success: true,
    message: `Placement drive marked as ${drive.isActive ? "active" : "inactive"}.`,
    drive: toDrivePayload(drive)
  };
};

const evaluatePlacementEligibility = (studentProfile, drive) => {
  const studentCgpaRaw = studentProfile?.cgpa;
  const studentCgpa = Number.isFinite(Number(studentCgpaRaw)) ? Number(studentCgpaRaw) : 0;
  const studentStatus = String(studentProfile?.status || "Active").trim();
  const graduated = studentStatus.toLowerCase() === "graduated";
  const visibility = isStudentVisibleForDrive(studentProfile, drive);
  const cgpaCriteria = Number.isFinite(Number(drive?.cgpaCriteria))
    ? Number(drive.cgpaCriteria)
    : Number(drive?.minCGPA) || 0;

  const cgpaEligible = studentCgpa >= cgpaCriteria;
  const driveActive = isDriveActive(drive);
  const statusEligible = !graduated;
  const eligible = statusEligible && cgpaEligible && visibility.visible && driveActive;

  let reason = "";
  if (!statusEligible) {
    reason = "Graduated students are not eligible for placement drives";
  } else if (!cgpaEligible) {
    reason = "Not eligible (CGPA requirement not met)";
  } else if (!visibility.branchEligible) {
    reason = "Your branch is not eligible for this drive";
  } else if (!visibility.batchEligible) {
    reason = "Your batch is not eligible for this drive";
  } else if (!driveActive) {
    reason = "This drive is inactive";
  }

  return {
    eligible,
    eligibilityStatus: eligible ? "Eligible" : "Not Eligible",
    reason,
    cgpaEligible,
    branchEligible: visibility.branchEligible,
    batchEligible: visibility.batchEligible,
    status: getDriveStatus(drive)
  };
};

const getStudentPlacements = async (studentId) => {
  await ensureRole(studentId, ["student"]);

  const [studentProfile, drives, applications] = await Promise.all([
    Student.findOne({ userId: studentId }).lean(),
    PlacementDrive.find({}).sort({ driveDate: 1, createdAt: -1 }).lean(),
    PlacementApplication.find({ studentId }).sort({ updatedAt: -1, createdAt: -1 }).lean()
  ]);

  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const applicationByDriveId = new Map(applications.map((application) => [String(application.driveId), application]));
  const visibleDrives = drives.filter(
    (drive) => isDriveActive(drive) && isStudentVisibleForDrive(studentProfile, drive).visible
  );

  const placements = visibleDrives.map((drive) => {
    const eligibility = evaluatePlacementEligibility(studentProfile, drive);
    const normalized = toDrivePayload(drive);
    const application = applicationByDriveId.get(String(drive._id));
    const applicationStatus = normalizeApplicationStatus(application?.status);
    const alreadyApplied = Boolean(application);

    return {
      id: normalized.id,
      companyName: normalized.companyName,
      role: normalized.role,
      package: normalized.package,
      location: normalized.location,
      driveDate: normalized.driveDate,
      applicationDeadline: normalized.applicationDeadline,
      cgpaCriteria: normalized.cgpaCriteria,
      branchesEligible: normalized.branchesEligible,
      eligibleBatches: normalized.eligibleBatches,
      testType: normalized.testType,
      description: normalized.description,
      applyLink: normalized.applyLink,
      status: normalized.status,
      eligibilityStatus: eligibility.eligibilityStatus,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      cgpaEligible: eligibility.cgpaEligible,
      applicationId: application?._id || null,
      applicationStatus: alreadyApplied ? applicationStatus : null,
      appliedAt: application?.createdAt || null,
      updatedAt: application?.updatedAt || null,
      alreadyApplied,
      canApply: eligibility.eligible && !alreadyApplied
    };
  });

  const myApplications = applications
    .map((application) => {
      const drive = drives.find((item) => String(item._id) === String(application.driveId));
      if (!drive) {
        return null;
      }

      return {
        id: application._id,
        driveId: drive._id,
        companyName: drive.companyName || "Company",
        role: drive.role || "-",
        package: Number(drive.package) || 0,
        location: drive.location || "-",
        driveDate: drive.driveDate || null,
        applicationDeadline: drive.applicationDeadline || null,
        driveStatus: getDriveStatus(drive),
        status: normalizeApplicationStatus(application.status),
        appliedAt: application.createdAt || null,
        updatedAt: application.updatedAt || null
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());

  return {
    success: true,
    placements,
    myApplications
  };
};

const evaluateEligibility = (studentProfile, drive) => {
  const { eligible, reason } = evaluatePlacementEligibility(studentProfile, drive);
  return {
    eligible,
    reasons: reason ? [reason] : []
  };
};

const getEligibleDrives = async (studentId) => {
  await ensureRole(studentId, ["student"]);

  const studentProfile = await loadStudentWithTestData({ userId: studentId }, { select: "userId branch year cgpa appliedDrives" });
  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  const [drives, applications] = await Promise.all([
    PlacementDrive.find({}),
    PlacementApplication.find({ studentId }).lean()
  ]);

  const applicationByDriveId = new Map(applications.map((application) => [String(application.driveId), application]));
  const driveSummaries = drives
    .filter((drive) => isDriveActive(drive))
    .map((drive) => {
    const { eligible, reasons } = evaluateEligibility(studentProfile, drive);
    const application = applicationByDriveId.get(String(drive._id));

    return {
      driveId: drive._id,
      companyName: drive.companyName,
      role: drive.role,
      eligible,
      reasons,
      minCGPA: drive.minCGPA ?? drive.cgpaCriteria ?? 0,
      applied: Boolean(application),
      applicationStatus: normalizeApplicationStatus(application?.status)
    };
    });

  return {
    success: true,
    drives: driveSummaries
  };
};

const syncDriveStatusCollections = async (drive, studentId, status) => {
  drive.applicants = Array.isArray(drive.applicants) ? drive.applicants.filter((item) => String(item) !== String(studentId)) : [];
  drive.selectedCandidates = Array.isArray(drive.selectedCandidates)
    ? drive.selectedCandidates.filter((item) => String(item) !== String(studentId))
    : [];

  if (status === "applied") {
    drive.applicants.push(studentId);
  }

  if (status === "placed" || status === "selected") {
    drive.selectedCandidates.push(studentId);
  }

  await drive.save();
};

const applyToDrive = async (studentId, driveId) => {
  await ensureRole(studentId, ["student"]);

  const [studentProfile, drive, existingApplication] = await Promise.all([
    Student.findOne({ userId: studentId }),
    PlacementDrive.findById(driveId),
    PlacementApplication.findOne({ studentId, driveId })
  ]);

  if (!studentProfile) {
    throw createError("Student profile not found.", 404);
  }

  if (!drive) {
    throw createError("Placement drive not found.", 404);
  }

  if (existingApplication) {
    return {
      success: true,
      message: "Application already exists for this drive.",
      application: {
        id: existingApplication._id,
        status: normalizeApplicationStatus(existingApplication.status),
        driveId: existingApplication.driveId,
        studentId: existingApplication.studentId
      }
    };
  }

  const eligibility = evaluatePlacementEligibility(studentProfile, drive);
  if (!eligibility.eligible) {
    throw createError(eligibility.reason || "Not eligible for this drive.", 400);
  }

  const application = await PlacementApplication.create({
    studentId,
    driveId,
    status: "applied"
  });

  if (!isObjectIdInList(studentProfile.appliedDrives, drive._id)) {
    studentProfile.appliedDrives.push(drive._id);
    await studentProfile.save();
  }

  await syncDriveStatusCollections(drive, studentId, "applied");

  return {
    success: true,
    message: "Application submitted successfully.",
    application: {
      id: application._id,
      status: application.status,
      driveId: application.driveId,
      studentId: application.studentId
    }
  };
};

const updateApplicationStatus = async (adminId, driveId, applicationId, status) => {
  await ensureRole(adminId, ["admin"]);

  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!["applied", "placed", "selected", "rejected"].includes(normalizedStatus)) {
    throw createError("status must be applied, selected, placed, or rejected.", 400);
  }

  const [drive, application] = await Promise.all([
    PlacementDrive.findById(driveId),
    PlacementApplication.findOne({ _id: applicationId, driveId })
  ]);

  if (!drive) {
    throw createError("Placement drive not found.", 404);
  }

  if (!application) {
    throw createError("Placement application not found.", 404);
  }

  if (normalizedStatus === "placed" || normalizedStatus === "selected") {
    const driveDate = toDateSafe(drive?.driveDate);
    if (driveDate && driveDate > new Date()) {
      throw createError("Students can only be marked as placed after the drive date.", 400);
    }
  }

  application.status = normalizedStatus === "selected" ? "placed" : normalizedStatus;
  await application.save();
  await syncDriveStatusCollections(drive, application.studentId, normalizedStatus);

  return {
    success: true,
    message: `Application marked as ${normalizedStatus}.`,
    application: {
      id: application._id,
      driveId: application.driveId,
      studentId: application.studentId,
      status: application.status,
      updatedAt: application.updatedAt
    }
  };
};

module.exports = {
  createPlacementDrive,
  getAdminPlacementDrives,
  updatePlacementDrive,
  deletePlacementDrive,
  togglePlacementDriveStatus,
  getStudentPlacements,
  evaluateEligibility,
  getEligibleDrives,
  applyToDrive,
  updateApplicationStatus
};
