const User = require("../models/User");
const Student = require("../models/Student");
const MockTest = require("../models/MockTest");
const { registerUser } = require("../services/authService");
const { createStudentProfile, getStudentDashboard } = require("../services/studentService");
const { createMockTest, submitMockTest } = require("../services/mockTestService");

const ADMIN_EMAIL = "admin@test.com";
const STUDENT_EMAIL = "student@test.com";
const DEV_PASSWORD = "Password@123";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const ensureUser = async ({ name, email, role }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== role) {
      throw createError(`Existing user ${email} has role ${existing.role}, expected ${role}.`, 400);
    }
    return existing;
  }

  const registration = await registerUser({
    name,
    email,
    password: DEV_PASSWORD,
    role
  });

  return User.findById(registration.user.id);
};

const ensureStudentProfile = async (studentUserId) => {
  const existing = await Student.findOne({ userId: studentUserId });
  if (existing) {
    return existing;
  }

  const created = await createStudentProfile(studentUserId, {
    branch: "CSE",
    year: 3,
    cgpa: 8.2,
    skills: ["Python", "Problem Solving"]
  });

  return Student.findById(created.profile.id);
};

const ensureMockTest = async (adminId, { title, subject, testType, questions }) => {
  const existing = await MockTest.findOne({ title, subject, testType });
  if (existing) {
    return existing;
  }

  const created = await createMockTest(adminId, {
    title,
    subject,
    testType,
    questions
  });

  return MockTest.findById(created.test.id);
};

const runMockTestFull = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") {
      throw createError("This endpoint is disabled in production.", 403);
    }

    const adminUser = await ensureUser({
      name: "Dev Admin",
      email: ADMIN_EMAIL,
      role: "admin"
    });

    const studentUser = await ensureUser({
      name: "Dev Student",
      email: STUDENT_EMAIL,
      role: "student"
    });

    await ensureStudentProfile(studentUser._id);

    const mcqTest = await ensureMockTest(adminUser._id, {
      title: "Dev MCQ Test",
      subject: "Aptitude",
      testType: "MCQ",
      questions: [
        {
          questionText: "What is 12 + 8?",
          options: ["18", "19", "20", "21"],
          correctAnswer: "20",
          topic: "Arithmetic"
        }
      ]
    });

    const mcqSubmission = await submitMockTest(studentUser._id, mcqTest._id, {
      answers: ["20"]
    });
    const mcqResult = mcqSubmission.result;

    const codingTest = await ensureMockTest(adminUser._id, {
      title: "Dev Coding Test",
      subject: "Coding",
      testType: "CODING",
      questions: [
        {
          problemStatement: "Read two integers and print their sum.",
          inputFormat: "Two space-separated integers",
          outputFormat: "Single integer sum",
          constraints: "-10^9 <= a,b <= 10^9",
          sampleInput: "2 3",
          sampleOutput: "5",
          languageId: 71,
          testCases: [
            { input: "2 3", expectedOutput: "5" },
            { input: "100 250", expectedOutput: "350" }
          ]
        }
      ]
    });

    let codingResult = null;
    let error = null;

    try {
      const codingSubmission = await submitMockTest(studentUser._id, codingTest._id, {
        sourceCode: "a,b=map(int,input().split());print(a+b)"
      });
      codingResult = codingSubmission.result;
    } catch (codingError) {
      error = codingError.message;
    }

    const dashboard = await getStudentDashboard(studentUser._id);
    const studentMockTestScores = dashboard.dashboard.mockTestScores || [];
    const totalTestsTaken = studentMockTestScores.length;

    return res.status(200).json({
      success: true,
      mcqResult,
      codingResult,
      studentMockTestScores,
      totalTestsTaken,
      ...(error ? { error } : {})
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  runMockTestFull
};
