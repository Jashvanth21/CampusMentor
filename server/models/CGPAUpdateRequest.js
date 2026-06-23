const mongoose = require("mongoose");

const cgpaUpdateRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    currentCGPA: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    requestedCGPA: {
      type: Number,
      required: true,
      min: 0,
      max: 10
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    versionKey: false
  }
);

const CGPAUpdateRequest = mongoose.model("CGPAUpdateRequest", cgpaUpdateRequestSchema);

module.exports = CGPAUpdateRequest;
