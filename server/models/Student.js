const mongoose = require("mongoose");

const feedbackEntrySchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    comment: {
      type: String,
      trim: true,
      default: ""
    },
    sincerityScore: {
      type: Number,
      default: null,
      min: 1,
      max: 10
    },
    focusArea: {
      type: String,
      trim: true,
      default: ""
    },
    weakAreas: {
      type: [String],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const topicStatSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: true,
      trim: true
    },
    total: {
      type: Number,
      default: 0,
      min: 0
    },
    correct: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    _id: false
  }
);

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      unique: true,
      index: true
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    branch: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      min: 1,
      max: 8
    },
    batch: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100
    },
    rollNumber: {
      type: String,
      trim: true,
      default: null,
      unique: true,
      sparse: true
    },
    cgpa: {
      type: Number,
      default: null,
      min: 0,
      max: 10
    },
    status: {
      type: String,
      enum: ["Active", "Graduated"],
      default: "Active"
    },
    skills: {
      type: [String],
      default: []
    },
    topicStats: {
      type: [topicStatSchema],
      default: []
    },
    careerGoal: {
      type: String,
      trim: true,
      default: ""
    },
    appliedDrives: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PlacementDrive"
        }
      ],
      default: []
    },
    sincerityScore: {
      type: Number,
      default: 0,
      min: 0
    },
    careerRecommendations: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    aiAnalyticsCache: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    aiAnalyticsLastUpdated: {
      type: Date,
      default: null
    },
    mentorFeedback: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        feedback: "",
        sincerityScore: null,
        weakAreas: [],
        reviewed: false,
        focusArea: "",
        updatedAt: null
      })
    },
    feedback: {
      type: [feedbackEntrySchema],
      default: []
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

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;
