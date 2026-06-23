const mongoose = require("mongoose");

const careerRoadmapSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    careerPath: {
      type: String,
      required: true
    },
    source: {
      type: String,
      enum: ["AI", "groq", "rule-based", "fallback"],
      default: "rule-based"
    },
    roadmap: {
      type: {
        careerPath: {
          type: String,
          default: ""
        },
        whyThisCareerFits: {
          type: String,
          default: ""
        },
        improvementAdvice: {
          type: [String],
          default: []
        },
        overallAnalysis: {
          type: String,
          default: ""
        },
        changesSummary: {
          type: String,
          default: ""
        },
        phases: {
          type: [
            {
              phase: {
                type: String,
                default: ""
              },
              phaseTitle: {
                type: String,
                default: ""
              },
              focus: {
                type: String,
                default: ""
              },
              goal: {
                type: String,
                default: ""
              },
              topics: {
                type: [String],
                default: []
              },
              focusAreas: {
                type: [String],
                default: []
              },
              tasks: {
                type: [String],
                default: []
              },
              duration: {
                type: String,
                default: ""
              }
            }
          ],
          default: []
        },
        note: {
          type: String,
          default: ""
        }
      },
      default: () => ({})
    },
    overallAnalysis: {
      type: String,
      default: ""
    },
    whyThisCareerFits: {
      type: String,
      default: ""
    },
    improvementAdvice: {
      type: [String],
      default: []
    },
    changesSummary: {
      type: String,
      default: ""
    },
    phases: {
      type: [
        {
          phase: {
            type: String,
            default: ""
          },
          phaseTitle: {
            type: String,
            default: ""
          },
          focus: {
            type: String,
            default: ""
          },
          goal: {
            type: String,
            default: ""
          },
          topics: {
            type: [String],
            default: []
          },
          focusAreas: {
            type: [String],
            default: []
          },
          tasks: {
            type: [String],
            default: []
          },
          duration: {
            type: String,
            default: ""
          }
        }
      ],
      default: []
    },
    analyticsSignature: {
      type: String,
      required: true
    },
    note: {
      type: String,
      default: ""
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

careerRoadmapSchema.pre("save", function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

const CareerRoadmap = mongoose.model("CareerRoadmap", careerRoadmapSchema);

module.exports = CareerRoadmap;
