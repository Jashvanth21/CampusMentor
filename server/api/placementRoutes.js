const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const {
  createPlacementDrive,
  getEligibleDrives,
  applyToDrive,
  togglePlacementDriveStatus
} = require("../services/placementService");

const router = express.Router();

router.post("/", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const result = await createPlacementDrive(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/eligible", protect, allowRoles("student"), async (req, res, next) => {
  try {
    const result = await getEligibleDrives(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/drives/:id/toggle", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const result = await togglePlacementDriveStatus(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/apply", protect, allowRoles("student"), async (req, res, next) => {
  try {
    const result = await applyToDrive(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
