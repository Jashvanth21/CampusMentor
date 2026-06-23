const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const { getSystemAnalyticsGlobal, getDashboardSystemAnalytics } = require("../services/adminAnalyticsService");
const {
  createStudent,
  getStudents,
  getStudentPerformance,
  updateStudent,
  deleteStudent,
  assignMentor,
  createMentor,
  getMentors,
  getAvailableMentorsByBranch,
  updateMentor,
  deleteMentor,
  promoteAcademicYear,
  promoteBatch
} = require("../services/adminManagementService");
const {
  getAdminCGPARequestsController,
  reviewCGPARequestController
} = require("../controllers/cgpaRequestController");
const {
  createPlacementDrive,
  getAdminPlacementDrives,
  updatePlacementDrive,
  deletePlacementDrive,
  togglePlacementDriveStatus,
  updateApplicationStatus
} = require("../services/placementService");

const router = express.Router();

router.use(protect, allowRoles("admin"));

router.get("/analytics", async (req, res, next) => {
  try {
    const result = await getSystemAnalyticsGlobal(req.user.id, req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/system-analytics", async (req, res, next) => {
  try {
    const result = await getDashboardSystemAnalytics(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/students", async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      branch,
      year,
      section,
      batch,
      ...rest
    } = req.body || {};
    console.log("Create student req.body:", req.body);
    const result = await createStudent({
      name,
      email,
      password,
      branch,
      year,
      section,
      batch: batch === undefined || batch === null || batch === "" ? batch : Number(batch),
      ...rest
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/students", async (req, res, next) => {
  try {
    const result = await getStudents(req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/students/performance", async (req, res, next) => {
  try {
    const result = await getStudentPerformance(req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/students/:id", async (req, res, next) => {
  try {
    const result = await updateStudent(req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/students/:id", async (req, res, next) => {
  try {
    const result = await deleteStudent(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/students/promote-year", async (req, res, next) => {
  try {
    const result = await promoteAcademicYear();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/students/promote-batch", async (req, res, next) => {
  try {
    const result = await promoteBatch(req.body?.batch);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/cgpa-requests", getAdminCGPARequestsController);
router.put("/cgpa-requests/:id", reviewCGPARequestController);


router.put("/assign-mentor", async (req, res, next) => {
  try {
    const result = await assignMentor(req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/mentors", async (req, res, next) => {
  try {
    const result = await createMentor(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/mentors", async (req, res, next) => {
  try {
    const result = await getMentors(req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/mentors/available/:branch", async (req, res, next) => {
  try {
    const result = await getAvailableMentorsByBranch(req.params.branch);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/mentors/:id", async (req, res, next) => {
  try {
    const result = await updateMentor(req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/mentors/:id", async (req, res, next) => {
  try {
    const result = await deleteMentor(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/placement", async (req, res, next) => {
  try {
    const result = await createPlacementDrive(req.user.id, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/placement", async (req, res, next) => {
  try {
    const result = await getAdminPlacementDrives(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/placement/:id", async (req, res, next) => {
  try {
    const result = await updatePlacementDrive(req.user.id, req.params.id, req.body || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/placement/:id", async (req, res, next) => {
  try {
    const result = await deletePlacementDrive(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/placement/:id/toggle", async (req, res, next) => {
  try {
    const result = await togglePlacementDriveStatus(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/placement/:id/applications/:applicationId", async (req, res, next) => {
  try {
    const result = await updateApplicationStatus(
      req.user.id,
      req.params.id,
      req.params.applicationId,
      req.body?.status
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
