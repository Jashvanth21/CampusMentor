const mongoose = require("mongoose");

const testAttemptSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    attemptId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
      index: true
    },
    isFirstAttempt: {
      type: Boolean,
      default: true
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest",
      required: true,
      index: true
    },
    subject: {
      type: String,
      enum: ["Technical", "Aptitude", "Coding"],
      default: null
    },
    type: {
      type: String,
      enum: ["MCQ", "CODING"],
      required: true
    },
    score: {
      type: Number,
      required: true,
      default: 0
    },
    totalScore: {
      type: Number,
      default: null
    },
    maxScore: {
      type: Number,
      default: null
    },
    percentage: {
      type: Number,
      default: null
    },
    passingPercentage: {
      type: Number,
      default: 50
    },
    status: {
      type: String,
      enum: ["Pass", "Fail"],
      default: "Fail"
    },
    startTime: {
      type: Date,
      default: null
    },
    endTime: {
      type: Date,
      default: null
    },
    timeTaken: {
      type: Number,
      default: 0,
      min: 0
    },
    questionWiseResults: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    detailedResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    aiAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    takenAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    versionKey: false
  }
);

testAttemptSchema.index({ studentId: 1, takenAt: -1 });
testAttemptSchema.index({ studentId: 1, testId: 1, takenAt: 1 });

module.exports = mongoose.model("TestAttempt", testAttemptSchema);
