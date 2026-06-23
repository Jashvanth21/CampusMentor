const mongoose = require("mongoose");

const TEST_SUBJECTS = ["Technical", "Aptitude", "Coding"];
const TEST_TYPES = ["MCQ", "CODING"];

const codingTestCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      validate: {
        validator: (value) => value !== null && value !== undefined,
        message: "Test case input is required"
      }
    },
    expectedOutput: {
      type: String,
      validate: {
        validator: (value) => value !== null && value !== undefined,
        message: "Test case expectedOutput is required"
      }
    }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      trim: true
    },
    options: {
      type: [String],
      default: []
    },
    correctAnswer: {
      type: String,
      trim: true
    },
    problemStatement: {
      type: String,
      trim: true
    },
    inputFormat: {
      type: String,
      trim: true
    },
    outputFormat: {
      type: String,
      trim: true
    },
    constraints: {
      type: String,
      trim: true
    },
    sampleInput: {
      type: String
    },
    sampleOutput: {
      type: String
    },
    starterCode: {
      javascript: { type: String, default: "" },
      python: { type: String, default: "" },
      java: { type: String, default: "" },
      cpp: { type: String, default: "" }
    },
    testCases: {
      type: [codingTestCaseSchema],
      default: []
    },
    languageId: {
      type: Number
    },
    marks: {
      type: Number,
      default: 1
    },
    topic: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const mockTestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    duration: {
      type: Number,
      min: 1,
      default: 60
    },
    passingCriteria: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    subject: {
      type: String,
      enum: TEST_SUBJECTS,
      required: [true, "subject is required"],
      default: "Technical"
    },
    testType: {
      type: String,
      enum: TEST_TYPES,
      required: [true, "testType is required"]
    },
    questions: {
      type: [questionSchema],
      default: [],
      validate: {
        validator: function validateQuestions(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one question is required"
      }
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

const MockTest = mongoose.model("MockTest", mockTestSchema);

module.exports = MockTest;
