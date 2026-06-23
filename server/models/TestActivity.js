const mongoose = require("mongoose");

const testActivitySchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["STARTED", "SUBMITTED"],
      default: "STARTED"
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: {
      type: Date,
      default: null
    }
  },
  {
    versionKey: false
  }
);

testActivitySchema.index({ studentId: 1, startedAt: -1 });
testActivitySchema.index({ studentId: 1, testId: 1, startedAt: -1 });

module.exports = mongoose.model("TestActivity", testActivitySchema);
