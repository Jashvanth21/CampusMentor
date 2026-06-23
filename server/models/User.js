const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const VALID_ROLES = ["student", "mentor", "admin"];
const CAREER_PATH_OPTIONS = [
  "Software Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "AI/ML Engineer"
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: VALID_ROLES,
      required: [true, "Role is required"]
    },
    branch: {
      type: String,
      trim: true,
      default: null
    },
    year: {
      type: Number,
      min: 1,
      max: 8,
      default: null
    },
    batch: {
      type: Number,
      required: function requireBatch() {
        return this.role === "student";
      },
      min: 2000,
      max: 2100,
      default: null
    },
    section: {
      type: String,
      trim: true,
      default: null
    },
    rollNumber: {
      type: String,
      trim: true,
      default: null
    },
    department: {
      type: String,
      trim: true
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      validate: {
        validator(value) {
          if (value == null) return true;
          return this.role === "student";
        },
        message: "mentorId can only be assigned to students."
      }
    },
    careerPath: {
      type: String,
      enum: CAREER_PATH_OPTIONS
    },
    careerGoal: {
      type: String,
      trim: true,
      default: ""
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

// Keep roll numbers unique for student accounts while allowing null for legacy records.
userSchema.index(
  { rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "student",
      rollNumber: { $type: "string", $ne: "" }
    }
  }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
