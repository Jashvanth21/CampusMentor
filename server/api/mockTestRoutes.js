const express = require("express");
const { protect, allowRoles } = require("../middleware/authMiddleware");
const MockTest = require("../models/MockTest");
const {
  createMockTest,
  listMockTests,
  getMockTestById,
  markMockTestStarted,
  submitMockTest,
  deleteMockTest,
  toggleMockTestPublish
} = require("../services/mockTestService");

const router = express.Router();
const ALLOWED_SUBJECTS = ["Technical", "Aptitude", "Coding"];

const normalizeSubject = (rawSubject) => {
  const subject = String(rawSubject || "").trim();
  if (!subject) return "Technical";
  if (subject === "DSA") return "Technical";
  return ALLOWED_SUBJECTS.includes(subject) ? subject : "Technical";
};

router.post("/", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const result = await createMockTest(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, allowRoles("student", "mentor", "admin"), async (req, res, next) => {
  try {
    // Prevent cached/stale test metadata from being reused after publish toggles.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
    const result = await listMockTests();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/public", async (req, res, next) => {
  try {
    // Public listing for student discovery view: only currently published tests.
    const tests = await MockTest.collection
      .find(
        { isPublished: true },
        {
          projection: {
            title: 1,
            description: 1,
            duration: 1,
            startDate: 1,
            endDate: 1,
            isPublished: 1,
            subject: 1,
            testType: 1,
            questions: 1,
            createdAt: 1
          }
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    const formattedTests = tests.map((test) => ({
      _id: test._id,
      id: test._id,
      title: test.title,
      description: test.description || "",
      duration: test.duration ?? null,
      startDate: test.startDate || null,
      endDate: test.endDate || null,
      isPublished: Boolean(test.isPublished),
      subject: normalizeSubject(test.subject),
      testType: test.testType,
      questionsCount: Array.isArray(test.questions) ? test.questions.length : 0,
      questions: Array.isArray(test.questions) ? test.questions : [],
      createdAt: test.createdAt
    }));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");

    return res.status(200).json({
      success: true,
      tests: formattedTests
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", protect, allowRoles("student", "mentor", "admin"), async (req, res, next) => {
  try {
    const result = await getMockTestById(req.params.id, { includeAnswers: req.user.role === "admin" });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const body = req.body || {};
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const isCodingType =
      String(body.testType || "").toUpperCase() === "CODING" ||
      questions.some((question) => Array.isArray(question?.testCases));

    if (isCodingType) {
      for (let qIndex = 0; qIndex < questions.length; qIndex += 1) {
        const testCases = questions[qIndex]?.testCases;
        if (!Array.isArray(testCases) || testCases.length === 0) {
          return res.status(400).json({
            success: false,
            message: `Coding question ${qIndex + 1} must include at least one test case.`
          });
        }

        for (let cIndex = 0; cIndex < testCases.length; cIndex += 1) {
          const input = String(testCases[cIndex]?.input ?? "").trim();
          const expectedOutput = String(testCases[cIndex]?.expectedOutput ?? "").trim();
          if (!input || !expectedOutput) {
            return res.status(400).json({
              success: false,
              message: `Coding question ${qIndex + 1}, test case ${cIndex + 1} requires input and expected output.`
            });
          }
        }
      }
    }

    const updatePayload = { ...body };
    updatePayload.subject = normalizeSubject(body.subject);
    if (body.isPublished !== undefined || body.publish !== undefined) {
      const publishFlag = body.isPublished !== undefined ? body.isPublished : body.publish;
      updatePayload.isPublished = Boolean(publishFlag);
    }
    delete updatePayload.publish;

    const updated = await MockTest.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      {
        new: true,
        runValidators: true,
        strict: false
      }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Test updated successfully.",
      test: {
        id: updated._id,
        title: updated.title,
        description: updated.description || "",
        duration: updated.duration ?? null,
        startDate: updated.startDate || null,
        endDate: updated.endDate || null,
        isPublished: Boolean(updated.isPublished),
        subject: updated.subject,
        testType: updated.testType,
        questions: updated.questions || [],
        createdAt: updated.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/submit", protect, allowRoles("student"), async (req, res, next) => {
  try {
    const result = await submitMockTest(req.user.id, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/start", protect, allowRoles("student"), async (req, res, next) => {
  try {
    const result = await markMockTestStarted(req.user.id, req.params.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const result = await deleteMockTest(adminId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/toggle", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    const result = await toggleMockTestPublish(adminId, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/toggle-publish", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const test = await MockTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: "Test not found" });
    }

    const nextPublishState = !Boolean(test.get("isPublished"));
    const updated = await MockTest.findByIdAndUpdate(
      req.params.id,
      { isPublished: nextPublishState },
      { new: true, runValidators: false, strict: false }
    );

    return res.status(200).json({
      success: true,
      isPublished: Boolean(updated?.get("isPublished"))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
