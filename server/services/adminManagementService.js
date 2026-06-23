const mongoose = require("mongoose");
const User = require("../models/User");
const Student = require("../models/Student");
const PlacementDrive = require("../models/PlacementDrive");
const PlacementApplication = require("../models/PlacementApplication");
const TestAttempt = require("../models/TestAttempt");
const { normalizeBranch: normalizeSupportedBranch } = require("../constants/branches");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeString = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const roundMetric = (value) => {
  const numeric = toNumberOrNull(value);
  return numeric === null ? 0 : Math.round(numeric * 10) / 10;
};

const sanitizeStudentPayload = (payload = {}) => ({
  name: normalizeString(payload.name),
  email: String(payload.email || "").toLowerCase().trim(),
  password: String(payload.password || ""),
  branch: Object.prototype.hasOwnProperty.call(payload, "branch")
    ? normalizeSupportedBranch(payload.branch) || null
    : undefined,
  year: payload.year !== undefined && payload.year !== null && payload.year !== ""
    ? Number(payload.year)
    : null,
  batch: payload.batch !== undefined && payload.batch !== null && payload.batch !== ""
    ? Number(payload.batch)
    : null,
  section: normalizeString(payload.section),
  rollNumber: normalizeString(payload.rollNumber),
  status: payload.status !== undefined ? String(payload.status || "").trim() : undefined,
  cgpa: payload.cgpa !== undefined && payload.cgpa !== null && payload.cgpa !== ""
    ? Number(payload.cgpa)
    : null,
  mentorId: normalizeString(payload.mentorId)
});

const sanitizeMentorPayload = (payload = {}) => ({
  name: normalizeString(payload.name),
  email: String(payload.email || "").toLowerCase().trim(),
  password: String(payload.password || ""),
  department: Object.prototype.hasOwnProperty.call(payload, "department")
    ? normalizeSupportedBranch(payload.department) || null
    : undefined
});

const ensureValidId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw createError(`Invalid ${label}.`, 400);
  }
};

const validateStudentCreatePayload = (payload) => {
  if (!payload.name || !payload.email || !payload.password) {
    throw createError("name, email, and password are required.", 400);
  }
  if (!payload.rollNumber) {
    throw createError("rollNumber is required.", 400);
  }
  if (payload.batch === null) {
    throw createError("batch is required.", 400);
  }
  if (payload.password.length < 8) {
    throw createError("Password must be at least 8 characters.", 400);
  }
  if (payload.cgpa !== null && (!Number.isFinite(payload.cgpa) || payload.cgpa < 0 || payload.cgpa > 10)) {
    throw createError("CGPA must be between 0 and 10.", 400);
  }
  if (payload.batch !== null && (!Number.isFinite(payload.batch) || payload.batch < 2000 || payload.batch > 2100)) {
    throw createError("Batch must be between 2000 and 2100.", 400);
  }
};

const ensureUniqueRollNumber = async (rollNumber, excludeStudentUserId = null) => {
  if (!rollNumber) {
    return;
  }

  const studentQuery = { rollNumber };
  if (excludeStudentUserId) {
    studentQuery.userId = { $ne: excludeStudentUserId };
  }

  const existingStudentProfile = await Student.findOne(studentQuery).select("_id userId").lean();
  if (existingStudentProfile) {
    throw createError("Roll number already exists", 400);
  }

  const userQuery = {
    role: "student",
    rollNumber
  };
  if (excludeStudentUserId) {
    userQuery._id = { $ne: excludeStudentUserId };
  }

  const existingStudentUser = await User.findOne(userQuery).select("_id").lean();
  if (existingStudentUser) {
    throw createError("Roll number already exists", 400);
  }
};

const validateMentorCreatePayload = (payload) => {
  if (!payload.name || !payload.email || !payload.password) {
    throw createError("name, email, and password are required.", 400);
  }
  if (payload.password.length < 8) {
    throw createError("Password must be at least 8 characters.", 400);
  }
};

const ensureMentorUser = async (mentorId) => {
  if (!mentorId) {
    return null;
  }
  ensureValidId(mentorId, "mentorId");

  const mentor = await User.findById(mentorId);
  if (!mentor) {
    throw createError("Mentor not found.", 404);
  }
  if (mentor.role !== "mentor") {
    throw createError("Provided user is not a mentor.", 400);
  }

  return mentor;
};

const studentProjection = {
  _id: 1,
  name: 1,
  email: 1,
  branch: 1,
  year: 1,
  batch: 1,
  section: 1,
  rollNumber: 1,
  mentorId: 1,
  role: 1,
  createdAt: 1
};

const toStudentResponse = (studentUser, cgpa = null, status = "Active") => ({
  id: studentUser._id,
  name: studentUser.name,
  email: studentUser.email,
  branch: studentUser.branch || null,
  year: studentUser.year ?? null,
  batch: studentUser.batch ?? null,
  section: studentUser.section || null,
  rollNumber: studentUser.rollNumber || null,
  cgpa: cgpa !== undefined ? cgpa : null,
  status: status || "Active",
  mentorId: studentUser.mentorId?._id || studentUser.mentorId || null,
  mentorName: studentUser.mentorId?.name || null,
  mentorEmail: studentUser.mentorId?.email || null
});

const resolveAnalyticsSource = (profile = {}) => {
  const legacyData = profile?.analyticsAI?.data || profile?.analyticsAI;
  if (legacyData && typeof legacyData === "object" && Object.keys(legacyData).length > 0) {
    return legacyData;
  }

  const cache = profile?.aiAnalyticsCache;
  if (cache && typeof cache === "object" && Object.keys(cache).length > 0) {
    return cache;
  }

  return null;
};

const readSectionScore = (source, sectionKey) =>
  toNumberOrNull(source?.sectionScores?.[sectionKey] ?? source?.sections?.[sectionKey]?.score);

const readAttemptCount = (source, fallbackCount = 0) => {
  const count =
    toNumberOrNull(source?.signature?.attemptCount) ??
    toNumberOrNull(source?.promptData?.overall?.testsAttempted) ??
    toNumberOrNull(source?.promptData?.totalAttempts) ??
    toNumberOrNull(source?.totalAttempts);

  return count !== null && count > 0 ? Math.trunc(count) : fallbackCount;
};

const readCachedAccuracy = (source) =>
  toNumberOrNull(
    source?.promptData?.overall?.averageScore ??
      source?.promptData?.overallAverage ??
      source?.overall?.averageScore ??
      source?.overallAverage
  );

const getPlacementStatus = (summary = {}) => {
  if (summary.hasPlaced) return "placed";
  if (summary.hasApplied) return "applied";
  if (summary.hasRejected) return "rejected";
  return "not_applied";
};

const getPlacementLabel = (status) => {
  if (status === "placed") return "Placed";
  if (status === "applied") return "Applied";
  if (status === "rejected") return "Rejected";
  return "Not Applied";
};

const normalizePerformanceSort = (value) => {
  if (["overallScore", "codingScore", "accuracy", "testsAttempted"].includes(value)) {
    return value;
  }
  return "overallScore";
};

const normalizeScoreRange = (value) => {
  const range = String(value || "all").trim().toLowerCase();
  if (["critical", "0-25", "25-50", "50-75", "75-100"].includes(range)) {
    return range;
  }
  return "all";
};

const matchesScoreRange = (student, scoreRange) => {
  const overallScore = Number(student?.overallScore) || 0;
  if (scoreRange === "critical") {
    return (
      overallScore < 25 ||
      (Number(student?.codingScore) || 0) < 20 ||
      (Number(student?.aptitudeScore) || 0) < 20 ||
      (Number(student?.technicalScore) || 0) < 20
    );
  }
  if (scoreRange === "0-25") return overallScore < 25;
  if (scoreRange === "25-50") return overallScore >= 25 && overallScore < 50;
  if (scoreRange === "50-75") return overallScore >= 50 && overallScore < 75;
  if (scoreRange === "75-100") return overallScore >= 75;
  return true;
};

const isCriticalPerformanceStudent = (student) =>
  (Number(student?.overallScore) || 0) < 25 ||
  (Number(student?.codingScore) || 0) < 20 ||
  (Number(student?.aptitudeScore) || 0) < 20 ||
  (Number(student?.technicalScore) || 0) < 20;

const buildPerformanceSummary = (students = []) => {
  const total = students.length;
  if (total === 0) {
    return {
      totalStudents: 0,
      averageOverall: 0,
      averageAccuracy: 0,
      totalAttempts: 0,
      criticalStudents: 0
    };
  }

  const totals = students.reduce(
    (accumulator, student) => {
      accumulator.overall += Number(student?.overallScore) || 0;
      accumulator.accuracy += Number(student?.accuracy) || 0;
      accumulator.attempts += Number(student?.testsAttempted) || 0;
      if (isCriticalPerformanceStudent(student)) {
        accumulator.critical += 1;
      }
      return accumulator;
    },
    {
      overall: 0,
      accuracy: 0,
      attempts: 0,
      critical: 0
    }
  );

  return {
    totalStudents: total,
    averageOverall: roundMetric(totals.overall / total),
    averageAccuracy: roundMetric(totals.accuracy / total),
    totalAttempts: totals.attempts,
    criticalStudents: totals.critical
  };
};

const buildPerformanceAttemptSummary = async (studentIds = []) => {
  if (studentIds.length === 0) {
    return new Map();
  }

  const attemptRows = await TestAttempt.aggregate([
    {
      $match: {
        studentId: { $in: studentIds }
      }
    },
    {
      $lookup: {
        from: "mocktests",
        localField: "testId",
        foreignField: "_id",
        as: "test"
      }
    },
    {
      $unwind: {
        path: "$test",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        studentId: 1,
        type: 1,
        subjectRaw: {
          $ifNull: ["$subject", "$test.subject"]
        },
        scoreValue: {
          $cond: [
            { $gt: [{ $ifNull: ["$maxScore", 0] }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    { $ifNull: ["$totalScore", 0] },
                    "$maxScore"
                  ]
                },
                100
              ]
            },
            {
              $ifNull: ["$percentage", { $ifNull: ["$score", 0] }]
            }
          ]
        }
      }
    },
    {
      $addFields: {
        subjectKey: {
          $switch: {
            branches: [
              {
                case: { $eq: [{ $toLower: { $ifNull: ["$subjectRaw", ""] } }, "coding"] },
                then: "coding"
              },
              {
                case: { $eq: [{ $toLower: { $ifNull: ["$subjectRaw", ""] } }, "aptitude"] },
                then: "aptitude"
              },
              {
                case: {
                  $in: [
                    { $toLower: { $ifNull: ["$subjectRaw", ""] } },
                    ["technical", "dsa"]
                  ]
                },
                then: "technical"
              }
            ],
            default: {
              $cond: [{ $eq: ["$type", "CODING"] }, "coding", "technical"]
            }
          }
        }
      }
    },
    {
      $group: {
        _id: "$studentId",
        testsAttempted: { $sum: 1 },
        scoreTotal: { $sum: "$scoreValue" },
        codingTotal: {
          $sum: {
            $cond: [{ $eq: ["$subjectKey", "coding"] }, "$scoreValue", 0]
          }
        },
        codingCount: {
          $sum: {
            $cond: [{ $eq: ["$subjectKey", "coding"] }, 1, 0]
          }
        },
        aptitudeTotal: {
          $sum: {
            $cond: [{ $eq: ["$subjectKey", "aptitude"] }, "$scoreValue", 0]
          }
        },
        aptitudeCount: {
          $sum: {
            $cond: [{ $eq: ["$subjectKey", "aptitude"] }, 1, 0]
          }
        },
        technicalTotal: {
          $sum: {
            $cond: [{ $eq: ["$subjectKey", "technical"] }, "$scoreValue", 0]
          }
        },
        technicalCount: {
          $sum: {
            $cond: [{ $eq: ["$subjectKey", "technical"] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        testsAttempted: 1,
        accuracy: {
          $cond: [
            { $gt: ["$testsAttempted", 0] },
            { $divide: ["$scoreTotal", "$testsAttempted"] },
            0
          ]
        },
        codingScore: {
          $cond: [
            { $gt: ["$codingCount", 0] },
            { $divide: ["$codingTotal", "$codingCount"] },
            null
          ]
        },
        aptitudeScore: {
          $cond: [
            { $gt: ["$aptitudeCount", 0] },
            { $divide: ["$aptitudeTotal", "$aptitudeCount"] },
            null
          ]
        },
        technicalScore: {
          $cond: [
            { $gt: ["$technicalCount", 0] },
            { $divide: ["$technicalTotal", "$technicalCount"] },
            null
          ]
        }
      }
    }
  ]);

  return new Map(attemptRows.map((row) => [String(row._id), row]));
};

const buildPlacementStatusSummary = async (studentIds = []) => {
  if (studentIds.length === 0) {
    return new Map();
  }

  const applicationRows = await PlacementApplication.aggregate([
    {
      $match: {
        studentId: { $in: studentIds }
      }
    },
    {
      $group: {
        _id: "$studentId",
        hasPlaced: {
          $max: {
            $cond: [{ $eq: ["$status", "placed"] }, 1, 0]
          }
        },
        hasApplied: {
          $max: {
            $cond: [{ $eq: ["$status", "applied"] }, 1, 0]
          }
        },
        hasRejected: {
          $max: {
            $cond: [{ $eq: ["$status", "rejected"] }, 1, 0]
          }
        }
      }
    }
  ]);

  return new Map(
    applicationRows.map((row) => [
      String(row._id),
      {
        hasPlaced: Boolean(row.hasPlaced),
        hasApplied: Boolean(row.hasApplied),
        hasRejected: Boolean(row.hasRejected)
      }
    ])
  );
};

const createStudent = async (payload) => {
  const data = sanitizeStudentPayload(payload);
  validateStudentCreatePayload(data);

  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw createError("A user with this email already exists.", 409);
  }

  await ensureMentorUser(data.mentorId);
  await ensureUniqueRollNumber(data.rollNumber);

  const created = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    role: "student",
    branch: data.branch,
    year: data.year,
    batch: data.batch,
    section: data.section,
    rollNumber: data.rollNumber,
    mentorId: data.mentorId
  });

  await Student.create({
    userId: created._id,
    mentorId: data.mentorId,
    branch: data.branch,
    year: data.year,
    rollNumber: data.rollNumber,
    batch: data.batch,
    cgpa: data.cgpa
  });

  const student = await User.findById(created._id, studentProjection).populate("mentorId", "name email");
  const studentProfile = await Student.findOne({ userId: created._id }).select("cgpa batch status").lean();

  return {
    success: true,
    message: "Student created successfully.",
    student: toStudentResponse(
      { ...student.toObject(), batch: studentProfile?.batch ?? null },
      studentProfile?.cgpa ?? null,
      studentProfile?.status || "Active"
    )
  };
};

const getStudents = async (filters = {}) => {
  const branchInput = normalizeString(filters.branch);
  const branch = normalizeSupportedBranch(branchInput);
  const yearInput = filters.year;
  const mentorFilter = normalizeString(filters.mentor);

  const query = { role: "student" };
  if (branchInput && String(branchInput).toLowerCase() !== "all" && !branch) {
    return {
      success: true,
      students: []
    };
  }
  if (branch) {
    query.branch = new RegExp(`^${escapeRegex(branch)}$`, "i");
  }
  if (yearInput !== undefined && yearInput !== null && yearInput !== "" && String(yearInput).toLowerCase() !== "all") {
    const numericYear = Number(yearInput);
    if (!Number.isFinite(numericYear)) {
      throw createError("Invalid year filter.", 400);
    }
    query.year = numericYear;
  }
  if (mentorFilter) {
    const normalizedMentorFilter = String(mentorFilter).toLowerCase();
    if (normalizedMentorFilter === "assigned") {
      query.mentorId = { $ne: null };
    } else if (normalizedMentorFilter === "unassigned") {
      query.$or = [{ mentorId: null }, { mentorId: { $exists: false } }];
    }
  }

  const students = await User.find(query, studentProjection)
    .sort({ createdAt: -1 })
    .populate("mentorId", "name email");

  const userIds = students.map((student) => student._id);
  const profiles = await Student.find({ userId: { $in: userIds } }).select("userId cgpa batch status").lean();
  const cgpaMap = new Map(profiles.map((profile) => [String(profile.userId), profile.cgpa ?? null]));
  const batchMap = new Map(profiles.map((profile) => [String(profile.userId), profile.batch ?? null]));
  const statusMap = new Map(profiles.map((profile) => [String(profile.userId), profile.status || "Active"]));

  return {
    success: true,
    students: students.map((student) =>
      toStudentResponse(
        { ...student.toObject(), batch: batchMap.get(String(student._id)) ?? null },
        cgpaMap.get(String(student._id)) ?? null,
        statusMap.get(String(student._id)) || "Active"
      )
    )
  };
};

const getStudentPerformance = async (filters = {}) => {
  const branchInput = normalizeString(filters.branch);
  const branch = normalizeSupportedBranch(branchInput);
  const yearInput = filters.year;
  const placementFilter = String(filters.placementStatus || filters.placement || "all").trim().toLowerCase();
  const search = normalizeString(filters.search);
  const sortBy = normalizePerformanceSort(filters.sortBy);
  const sortOrder = String(filters.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  const scoreRange = normalizeScoreRange(filters.scoreRange);

  const query = { role: "student" };
  if (branchInput && String(branchInput).toLowerCase() !== "all" && !branch) {
    return {
      success: true,
      students: [],
      filters: {
        branch: branchInput,
        year: yearInput || "All",
        placementStatus: placementFilter || "all",
        search: search || "",
        scoreRange
      },
      sort: {
        sortBy,
        sortOrder
      },
      summary: buildPerformanceSummary([]),
      topStudents: [],
      criticalStudents: []
    };
  }
  if (branch) {
    query.branch = new RegExp(`^${escapeRegex(branch)}$`, "i");
  }
  if (yearInput !== undefined && yearInput !== null && yearInput !== "" && String(yearInput).toLowerCase() !== "all") {
    const numericYear = Number(yearInput);
    if (!Number.isFinite(numericYear)) {
      throw createError("Invalid year filter.", 400);
    }
    query.year = numericYear;
  }
  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { rollNumber: searchRegex },
      { branch: searchRegex }
    ];
  }

  const users = await User.find(query, {
    _id: 1,
    name: 1,
    email: 1,
    branch: 1,
    year: 1,
    rollNumber: 1
  })
    .sort({ name: 1 })
    .lean();
  const studentIds = users.map((student) => student._id).filter(Boolean);

  if (studentIds.length === 0) {
    return {
      success: true,
      students: [],
      filters: {
        branch: branch || "All",
        year: yearInput || "All",
        placementStatus: placementFilter || "all",
        search: search || "",
        scoreRange
      },
      sort: {
        sortBy,
        sortOrder
      },
      summary: buildPerformanceSummary([]),
      topStudents: [],
      criticalStudents: []
    };
  }

  const [profiles, attemptSummaryMap, placementSummaryMap] = await Promise.all([
    Student.collection
      .find({ userId: { $in: studentIds } })
      .project({
        userId: 1,
        branch: 1,
        year: 1,
        rollNumber: 1,
        status: 1,
        aiAnalyticsCache: 1,
        analyticsAI: 1
      })
      .toArray(),
    buildPerformanceAttemptSummary(studentIds),
    buildPlacementStatusSummary(studentIds)
  ]);

  const profileByUserId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

  const performanceRows = users
    .map((user) => {
      const userId = String(user?._id || "");
      const profile = profileByUserId.get(userId) || {};
      const source = resolveAnalyticsSource(profile);
      const attempts = attemptSummaryMap.get(userId) || {};
      const placementStatus = getPlacementStatus(placementSummaryMap.get(userId));

      const codingScore = readSectionScore(source, "coding") ?? toNumberOrNull(attempts.codingScore) ?? 0;
      const aptitudeScore = readSectionScore(source, "aptitude") ?? toNumberOrNull(attempts.aptitudeScore) ?? 0;
      const technicalScore = readSectionScore(source, "technical") ?? toNumberOrNull(attempts.technicalScore) ?? 0;
      const overallScore = (codingScore + aptitudeScore + technicalScore) / 3;
      const testsAttempted = readAttemptCount(source, Number(attempts.testsAttempted) || 0);
      const attemptAccuracy = Number(attempts.testsAttempted) > 0 ? toNumberOrNull(attempts.accuracy) : null;
      const accuracy = attemptAccuracy ?? readCachedAccuracy(source) ?? overallScore;

      return {
        id: userId,
        name: user?.name || "Student",
        rollNumber: user?.rollNumber || profile?.rollNumber || "-",
        branch: user?.branch || profile?.branch || "-",
        year: user?.year ?? profile?.year ?? "-",
        overallScore: roundMetric(overallScore),
        codingScore: roundMetric(codingScore),
        aptitudeScore: roundMetric(aptitudeScore),
        technicalScore: roundMetric(technicalScore),
        accuracy: roundMetric(accuracy),
        testsAttempted,
        placementStatus,
        placementStatusLabel: getPlacementLabel(placementStatus)
      };
    })
    .filter((student) => {
      if (!placementFilter || placementFilter === "all") {
        return true;
      }
      return student.placementStatus === placementFilter;
    })
    .filter((student) => {
      return matchesScoreRange(student, scoreRange);
    })
    .sort((left, right) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      const leftValue = Number(left[sortBy]) || 0;
      const rightValue = Number(right[sortBy]) || 0;
      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * direction;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  const topStudents = [...performanceRows]
    .sort((left, right) => Number(right.overallScore || 0) - Number(left.overallScore || 0))
    .slice(0, 5);
  const criticalStudentIds = new Set();
  const criticalStudents = [...performanceRows]
    .filter(isCriticalPerformanceStudent)
    .sort((left, right) => Number(left.overallScore || 0) - Number(right.overallScore || 0))
    .filter((student) => {
      const studentId = String(student?.id || "").trim();
      if (!studentId || criticalStudentIds.has(studentId)) {
        return false;
      }
      criticalStudentIds.add(studentId);
      return true;
    });

  return {
    success: true,
    students: performanceRows,
    summary: buildPerformanceSummary(performanceRows),
    topStudents,
    criticalStudents,
    filters: {
      branch: branch || "All",
      year: yearInput || "All",
      placementStatus: placementFilter || "all",
      search: search || "",
      scoreRange
    },
    sort: {
      sortBy,
      sortOrder
    }
  };
};

const updateStudent = async (studentId, payload) => {
  ensureValidId(studentId, "studentId");
  const data = sanitizeStudentPayload(payload);
  const studentUser = await User.findOne({ _id: studentId, role: "student" });
  if (!studentUser) {
    throw createError("Student not found.", 404);
  }
  const previousYear = studentUser.year;

  if (data.email && data.email !== studentUser.email) {
    const existing = await User.findOne({ email: data.email, _id: { $ne: studentId } });
    if (existing) {
      throw createError("A user with this email already exists.", 409);
    }
    studentUser.email = data.email;
  }

  await ensureMentorUser(data.mentorId);

  if (payload.rollNumber !== undefined) {
    if (!data.rollNumber) {
      throw createError("rollNumber is required.", 400);
    }
    if (data.rollNumber !== studentUser.rollNumber) {
      await ensureUniqueRollNumber(data.rollNumber, studentId);
    }
  }

  if (data.name) studentUser.name = data.name;
  if (data.branch !== undefined) studentUser.branch = data.branch;
  if (data.year !== undefined) studentUser.year = data.year;
  if (payload.batch !== undefined) studentUser.batch = data.batch;
  if (data.section !== undefined) studentUser.section = data.section;
  if (data.rollNumber !== undefined) studentUser.rollNumber = data.rollNumber;
  if (payload.mentorId !== undefined) {
    studentUser.mentorId = data.mentorId;
  }
  if (data.password) {
    if (data.password.length < 8) {
      throw createError("Password must be at least 8 characters.", 400);
    }
    studentUser.password = data.password;
  }
  if (data.cgpa !== null && (!Number.isFinite(data.cgpa) || data.cgpa < 0 || data.cgpa > 10)) {
    throw createError("CGPA must be between 0 and 10.", 400);
  }
  if (data.batch !== null && (!Number.isFinite(data.batch) || data.batch < 2000 || data.batch > 2100)) {
    throw createError("Batch must be between 2000 and 2100.", 400);
  }
  if (payload.status !== undefined && !["Active", "Graduated"].includes(data.status)) {
    throw createError("Status must be either Active or Graduated.", 400);
  }

  await studentUser.save();

  const profileUpdate = {
    mentorId: studentUser.mentorId || null,
    branch: studentUser.branch || null,
    year: studentUser.year ?? null,
    rollNumber: studentUser.rollNumber || null
  };
  const yearFieldProvided = payload.year !== undefined;
  const yearChanged = yearFieldProvided && Number(data.year) !== Number(previousYear);
  if (payload.status !== undefined) {
    profileUpdate.status = data.status;
  } else if (yearChanged && Number.isFinite(Number(data.year))) {
    // Admin year edits should keep status consistent; only promotion flow sets "Graduated".
    profileUpdate.status = "Active";
  }
  if (payload.batch !== undefined) {
    profileUpdate.batch = data.batch;
  }
  if (payload.cgpa !== undefined) {
    profileUpdate.cgpa = data.cgpa;
  }

  const updatedProfile = await Student.findOneAndUpdate(
    { userId: studentId },
    { $set: profileUpdate },
    { upsert: true, new: true }
  );

  const updated = await User.findById(studentId, studentProjection).populate("mentorId", "name email");
  return {
    success: true,
    message: "Student updated successfully.",
    student: toStudentResponse(
      { ...updated.toObject(), batch: updatedProfile?.batch ?? null },
      updatedProfile?.cgpa ?? null,
      updatedProfile?.status || "Active"
    )
  };
};

const deleteStudent = async (studentId) => {
  ensureValidId(studentId, "studentId");
  const studentUser = await User.findOne({ _id: studentId, role: "student" });
  if (!studentUser) {
    throw createError("Student not found.", 404);
  }

  await Promise.all([
    PlacementApplication.deleteMany({ studentId }),
    PlacementDrive.updateMany(
      {},
      {
        $pull: {
          applicants: studentId,
          selectedCandidates: studentId
        }
      }
    ),
    User.updateMany({ role: "student", mentorId: studentId }, { $set: { mentorId: null } }),
    User.findByIdAndDelete(studentId),
    Student.findOneAndDelete({ userId: studentId })
  ]);

  return {
    success: true,
    message: "Student deleted successfully."
  };
};

const assignMentor = async ({ studentId, mentorId }) => {
  if (!studentId || !mentorId) {
    throw createError("studentId and mentorId are required.", 400);
  }
  ensureValidId(studentId, "studentId");
  ensureValidId(mentorId, "mentorId");

  const [studentUser, mentorUser] = await Promise.all([
    User.findOne({ _id: studentId, role: "student" }),
    User.findOne({ _id: mentorId, role: "mentor" })
  ]);

  if (!studentUser) {
    throw createError("Student not found.", 404);
  }
  if (!mentorUser) {
    throw createError("Mentor not found.", 404);
  }

  studentUser.mentorId = mentorId;
  await studentUser.save();

  await Student.findOneAndUpdate(
    { userId: studentId },
    {
      $set: {
        mentorId,
        branch: studentUser.branch || null,
        year: studentUser.year ?? null,
        batch: studentUser.batch ?? null,
        rollNumber: studentUser.rollNumber || null
      }
    },
    { upsert: true, new: true }
  );

  return {
    success: true,
    message: "Mentor assigned successfully."
  };
};

const createMentor = async (payload) => {
  const data = sanitizeMentorPayload(payload);
  validateMentorCreatePayload(data);

  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw createError("A user with this email already exists.", 409);
  }

  const mentor = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    role: "mentor",
    department: data.department
  });

  return {
    success: true,
    message: "Mentor created successfully.",
    mentor: {
      id: mentor._id,
      name: mentor.name,
      email: mentor.email,
      department: mentor.department || null
    }
  };
};

const getMentors = async (filters = {}) => {
  const departmentInput = normalizeString(filters.department);
  const department = normalizeSupportedBranch(departmentInput);
  const query = { role: "mentor" };
  if (departmentInput && String(departmentInput).toLowerCase() !== "all" && !department) {
    return {
      success: true,
      mentors: []
    };
  }
  if (department) {
    query.department = new RegExp(`^${escapeRegex(department)}$`, "i");
  }

  const mentors = await User.find(query, {
    _id: 1,
    name: 1,
    email: 1,
    department: 1
  }).sort({ createdAt: -1 });

  const mentorIds = mentors.map((mentor) => mentor._id);
  const studentCounts = await Student.aggregate([
    { $match: { mentorId: { $in: mentorIds } } },
    { $group: { _id: "$mentorId", count: { $sum: 1 } } }
  ]);

  const countMap = new Map(studentCounts.map((row) => [String(row._id), row.count]));

  return {
    success: true,
    mentors: mentors.map((mentor) => ({
      id: mentor._id,
      name: mentor.name,
      email: mentor.email,
      department: mentor.department || null,
      studentsAssigned: countMap.get(String(mentor._id)) || 0
    }))
  };
};

const getAvailableMentorsByBranch = async (branch) => {
  const normalizedBranch = normalizeSupportedBranch(branch);
  if (!normalizedBranch) {
    return {
      success: true,
      mentors: []
    };
  }

  const mentors = await User.find(
    {
      role: "mentor",
      department: new RegExp(`^${escapeRegex(normalizedBranch)}$`, "i")
    },
    {
      _id: 1,
      name: 1,
      email: 1,
      department: 1
    }
  ).sort({ createdAt: -1 });

  return {
    success: true,
    mentors: mentors.map((mentor) => ({
      id: mentor._id,
      name: mentor.name,
      email: mentor.email,
      department: mentor.department || null
    }))
  };
};

const updateMentor = async (mentorId, payload) => {
  ensureValidId(mentorId, "mentorId");
  const data = sanitizeMentorPayload(payload);
  const mentor = await User.findOne({ _id: mentorId, role: "mentor" });

  if (!mentor) {
    throw createError("Mentor not found.", 404);
  }

  if (data.email && data.email !== mentor.email) {
    const existing = await User.findOne({ email: data.email, _id: { $ne: mentorId } });
    if (existing) {
      throw createError("A user with this email already exists.", 409);
    }
    mentor.email = data.email;
  }

  if (data.name) mentor.name = data.name;
  if (data.department !== undefined) mentor.department = data.department;
  if (data.password) {
    if (data.password.length < 8) {
      throw createError("Password must be at least 8 characters.", 400);
    }
    mentor.password = data.password;
  }

  await mentor.save();

  return {
    success: true,
    message: "Mentor updated successfully.",
    mentor: {
      id: mentor._id,
      name: mentor.name,
      email: mentor.email,
      department: mentor.department || null
    }
  };
};

const deleteMentor = async (mentorId) => {
  ensureValidId(mentorId, "mentorId");
  const mentor = await User.findOne({ _id: mentorId, role: "mentor" });

  if (!mentor) {
    throw createError("Mentor not found.", 404);
  }

  await Promise.all([
    User.findByIdAndDelete(mentorId),
    User.updateMany({ role: "student", mentorId }, { $set: { mentorId: null } }),
    Student.updateMany({ mentorId }, { $set: { mentorId: null } })
  ]);

  return {
    success: true,
    message: "Mentor deleted successfully."
  };
};

const promoteAcademicYear = async () => {
  const graduatedStudents = await Student.updateMany(
    { year: { $gte: 4 } },
    { $set: { status: "Graduated" } }
  );

  const [promotedStudents, promotedUsers] = await Promise.all([
    Student.updateMany(
      { year: { $lt: 4 } },
      { $inc: { year: 1 }, $set: { status: "Active" } }
    ),
    User.updateMany(
      { role: "student", year: { $lt: 4 } },
      { $inc: { year: 1 } }
    )
  ]);

  return {
    success: true,
    message: "Students promoted successfully.",
    summary: {
      promotedStudentProfiles: promotedStudents?.modifiedCount || 0,
      promotedStudentUsers: promotedUsers?.modifiedCount || 0,
      graduatedStudentProfiles: graduatedStudents?.modifiedCount || 0
    }
  };
};

const promoteBatch = async (batchInput) => {
  const batch = Number(batchInput);
  if (!Number.isFinite(batch)) {
    throw createError("Valid batch is required.", 400);
  }

  const studentProfiles = await Student.find({ batch }).select("userId").lean();
  const studentIds = studentProfiles.map((student) => student.userId).filter(Boolean);

  if (studentIds.length === 0) {
    return {
      success: true,
      message: "Batch promoted successfully.",
      summary: {
        promotedStudentProfiles: 0,
        promotedStudentUsers: 0,
        graduatedStudentProfiles: 0
      }
    };
  }

  const yearFourProfiles = await Student.find({
    userId: { $in: studentIds },
    year: 4
  }).select("userId").lean();
  const yearFourIds = yearFourProfiles.map((student) => student.userId).filter(Boolean);

  const [promotedStudentProfiles, promotedStudentUsers] = await Promise.all([
    Student.updateMany(
      { userId: { $in: studentIds }, year: { $lt: 4 } },
      { $inc: { year: 1 }, $set: { status: "Active" } }
    ),
    User.updateMany(
      { _id: { $in: studentIds }, role: "student", year: { $lt: 4 } },
      { $inc: { year: 1 } }
    )
  ]);

  const graduatedStudentProfiles = yearFourIds.length > 0
    ? await Student.updateMany(
      { userId: { $in: yearFourIds } },
      { $set: { status: "Graduated" } }
    )
    : { modifiedCount: 0 };

  return {
    success: true,
    message: "Batch promoted successfully.",
    summary: {
      promotedStudentProfiles: promotedStudentProfiles?.modifiedCount || 0,
      promotedStudentUsers: promotedStudentUsers?.modifiedCount || 0,
      graduatedStudentProfiles: graduatedStudentProfiles?.modifiedCount || 0
    }
  };
};

module.exports = {
  createStudent,
  getStudents,
  getStudentPerformance,
  updateStudent,
  deleteStudent,
  assignMentor,
  createMentor,
  getMentors,
  getAvailableMentorsByBranch,
  updateMentor,
  deleteMentor,
  promoteAcademicYear,
  promoteBatch
};
