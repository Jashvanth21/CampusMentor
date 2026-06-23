const mongoose = require("mongoose");

const placementApplicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "studentId is required"],
      index: true
    },
    driveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlacementDrive",
      required: [true, "driveId is required"],
      index: true
    },
    status: {
      type: String,
      enum: ["applied", "placed", "rejected"],
      default: "applied"
    }
  },
  {
    versionKey: false,
    timestamps: true
  }
);

placementApplicationSchema.index({ studentId: 1, driveId: 1 }, { unique: true });

const PlacementApplication = mongoose.model("PlacementApplication", placementApplicationSchema);

module.exports = PlacementApplication;
