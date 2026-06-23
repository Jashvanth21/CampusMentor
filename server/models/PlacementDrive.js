const mongoose = require("mongoose");

const placementDriveSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "companyName is required"],
      trim: true
    },
    role: {
      type: String,
      required: [true, "role is required"],
      trim: true
    },
    package: {
      type: Number,
      min: 0,
      default: 0
    },
    location: {
      type: String,
      trim: true,
      default: ""
    },
    cgpaCriteria: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    branchesEligible: {
      type: [String],
      default: []
    },
    eligibleBatches: {
      type: [Number],
      default: []
    },
    testType: {
      type: String,
      trim: true,
      default: ""
    },
    applicationDeadline: {
      type: Date,
      default: null
    },
    driveDate: {
      type: Date,
      default: null
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    applyLink: {
      type: String,
      trim: true,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true
    },
    minCGPA: {
      type: Number,
      min: 0,
      max: 10,
      default: 0
    },
    applicants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      default: []
    },
    selectedCandidates: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy is required"]
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

const PlacementDrive = mongoose.model("PlacementDrive", placementDriveSchema);

module.exports = PlacementDrive;
