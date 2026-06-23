import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiService from "../../../api/apiService";
import QuestionNavigator from "./QuestionNavigator";
import MCQQuestion from "./MCQQuestion";
import CodingQuestion from "./CodingQuestion";
import SubmitModal from "./SubmitModal";
import { getStarterCodeByLanguage } from "./coding/LanguageSelector";

const defaultCodingAnswer = {
  sourceCode: getStarterCodeByLanguage(71),
  languageId: 71
};

const getAttemptStorageKey = (testId) => `student_test_attempt_${testId}`;
const getResultStorageKey = (testId) => `student_test_result_${testId}`;
const getSubmissionLockKey = (testId) => `student_test_submitting_${testId}`;
const getAttemptId = (attempt) => attempt?.attemptId || attempt?._id || attempt?.id || null;

const deriveDurationSeconds = (test) => {
  if (Number.isFinite(Number(test?.durationMinutes)) && Number(test.durationMinutes) > 0) {
    return Number(test.durationMinutes) * 60;
  }

  const totalQuestions = Array.isArray(test?.questions) ? test.questions.length : 0;
  return Math.max(15 * 60, totalQuestions * 2 * 60);
};

const getQuestionId = (question, index) => question?.id || question?._id || `q-${index}`;

const normalizeRestoredAnswers = (rawAnswers, questions) => {
  if (!rawAnswers || typeof rawAnswers !== "object") {
    return {};
  }

  // Already in standardized model.
  if (!rawAnswers.mcq && !rawAnswers.coding) {
    return rawAnswers;
  }

  // Backward compatibility migration for old localStorage snapshot.
  const next = {};

  questions.forEach((question, index) => {
    const questionId = getQuestionId(question, index);
    const isMCQ = Array.isArray(question?.options) && question.options.length > 0;

    if (isMCQ) {
      const legacyValue = rawAnswers?.mcq?.[index];
      if (legacyValue !== undefined && legacyValue !== null && legacyValue !== "") {
        const optionIndex = question.options.findIndex((option) => option === legacyValue);
        next[questionId] = {
          type: "mcq",
          answer: optionIndex >= 0 ? optionIndex : legacyValue
        };
      }
      return;
    }

    if (rawAnswers?.coding?.sourceCode) {
      next[questionId] = {
        type: "coding",
        code: rawAnswers.coding.sourceCode,
        language: String(rawAnswers.coding.languageId || 71),
        languageId: Number(rawAnswers.coding.languageId) || 71
      };
    }
  });

  return next;
};

const mapAnswersForSubmission = (answerMap, test, questions) => {
  // Keep backend compatibility by mapping standardized answers to existing payload shape.
  if (test?.testType === "MCQ") {
    return {
      answers: questions.map((question, questionIndex) => {
        const questionId = getQuestionId(question, questionIndex);
        const answerRecord = answerMap?.[questionId];
        if (!answerRecord || answerRecord.type !== "mcq") return "";

        const selected = answerRecord.answer;
        if (typeof selected === "number") {
          return question?.options?.[selected] ?? "";
        }

        return selected || "";
      })
    };
  }

  const codingQuestionIndex = questions.findIndex(
    (question) => !(Array.isArray(question?.options) && question.options.length > 0)
  );
  const codingQuestionId =
    codingQuestionIndex >= 0 ? getQuestionId(questions[codingQuestionIndex], codingQuestionIndex) : null;
  const codingAnswer = codingQuestionId ? answerMap?.[codingQuestionId] : null;
  const sourceCode = codingAnswer?.code?.trim() ? codingAnswer.code : "";
  const languageId = Number(codingAnswer?.languageId) || Number(codingAnswer?.language) || 71;

  return {
    // Submit a safe placeholder source to avoid backend rejection on empty code.
    sourceCode: sourceCode || defaultCodingAnswer.sourceCode,
    languageId
  };
};

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeStandardizedAnswers = (rawAnswers) => {
  if (!isPlainObject(rawAnswers)) return {};

  return Object.entries(rawAnswers).reduce((acc, [questionId, answerValue]) => {
    if (!isPlainObject(answerValue)) return acc;

    if (answerValue.type === "mcq") {
      if (typeof answerValue.answer === "number" && Number.isFinite(answerValue.answer)) {
        acc[questionId] = {
          type: "mcq",
          answer: answerValue.answer
        };
      }
      return acc;
    }

    if (answerValue.type === "coding") {
      if (typeof answerValue.code === "string") {
        acc[questionId] = {
          type: "coding",
          code: answerValue.code,
          language: String(answerValue.language ?? answerValue.languageId ?? 71),
          languageId: Number(answerValue.languageId ?? answerValue.language ?? 71) || 71
        };
      }
    }

    return acc;
  }, {});
};

const isValidRestoredSnapshot = (snapshot, currentTestId) => {
  return (
    isPlainObject(snapshot) &&
    snapshot.testId === currentTestId &&
    isPlainObject(snapshot.answers) &&
    typeof snapshot.remainingTime === "number" &&
    Number.isFinite(snapshot.remainingTime) &&
    typeof snapshot.currentQuestionIndex === "number" &&
    Number.isFinite(snapshot.currentQuestionIndex)
  );
};

const StartTest = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [test, setTest] = useState(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [startLogged, setStartLogged] = useState(false);
  const [answers, setAnswers] = useState({});

  const [executionConfigByQuestion, setExecutionConfigByQuestion] = useState({});
  const [runResultsByQuestion, setRunResultsByQuestion] = useState({});
  const [runErrorsByQuestion, setRunErrorsByQuestion] = useState({});
  const [runLoadingQuestionId, setRunLoadingQuestionId] = useState("");
  const [submitCodeResultsByQuestion, setSubmitCodeResultsByQuestion] = useState({});
  const [submitCodeLoadingQuestionId, setSubmitCodeLoadingQuestionId] = useState("");

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [expiredOnLoad, setExpiredOnLoad] = useState(false);
  const timerIntervalRef = useRef(null);
  const hasAutoSubmittedRef = useRef(false);
  const hasExpirySubmittedRef = useRef(false);
  const saveDebounceRef = useRef(null);
  const hasSubmitStartedRef = useRef(false);
  const startLogInFlightRef = useRef(false);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await apiService.getMockTestById(testId);
        const fetchedTest = data?.test;

        if (!fetchedTest) {
          setError("Test data not found.");
          return;
        }

        // Initialize full test object from fetch-by-id endpoint.
        setTest(fetchedTest);
        const testEndDate = fetchedTest?.endDate ? new Date(fetchedTest.endDate) : null;
        const hasValidEndDate = testEndDate instanceof Date && !Number.isNaN(testEndDate.getTime());
        if (hasValidEndDate && Date.now() > testEndDate.getTime()) {
          // Defensive guard: if window already expired, prevent starting an attempt.
          setExpiredOnLoad(true);
          setIsExpired(true);
          setRemainingTime(0);
          return;
        }

        const durationSeconds = Number(fetchedTest?.duration) > 0
          ? Number(fetchedTest.duration) * 60
          : deriveDurationSeconds(fetchedTest);
        const savedRaw = localStorage.getItem(getAttemptStorageKey(testId));

        if (savedRaw) {
          let parsedData;
          try {
            // Defensive parse: malformed JSON should never crash test init.
            parsedData = JSON.parse(savedRaw);
          } catch (parseError) {
            localStorage.removeItem(getAttemptStorageKey(testId));
            parsedData = null;
          }

          if (parsedData) {
            if (!isValidRestoredSnapshot(parsedData, testId)) {
              localStorage.removeItem(getAttemptStorageKey(testId));
            } else {
              const normalizedAnswers = normalizeRestoredAnswers(
                parsedData.answers,
                fetchedTest.questions || []
              );
              const safeAnswers = sanitizeStandardizedAnswers(normalizedAnswers);
              const hasInvalidEntries =
                Object.keys(safeAnswers).length !== Object.keys(normalizedAnswers || {}).length;

              if (hasInvalidEntries) {
                // If any answer entry is invalid/corrupt, reset to avoid partial inconsistent restore.
                localStorage.removeItem(getAttemptStorageKey(testId));
              } else {
                setCurrentQuestionIndex(Math.max(0, Number(parsedData.currentQuestionIndex) || 0));
                setRemainingTime(
                  Math.min(durationSeconds, Math.max(0, Number(parsedData.remainingTime) || durationSeconds))
                );
                setStartedAt(parsedData.startedAt || Date.now());
                setStartLogged(Boolean(parsedData.startLogged));
                setAnswers(safeAnswers);
                return;
              }
            }
          }
        }

        setCurrentQuestionIndex(0);
        setRemainingTime(durationSeconds);
        setStartedAt(Date.now());
        setStartLogged(false);
        setAnswers({});
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Unable to start this test.");
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [testId]);

  useEffect(() => {
    // Debounced progress persistence:
    // write only essential fields and avoid writing on every render/tick burst.
    if (!test || loading || isSubmitting || remainingTime <= 0) return undefined;

    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }

    saveDebounceRef.current = window.setTimeout(() => {
      localStorage.setItem(
        getAttemptStorageKey(testId),
        JSON.stringify({
          testId,
          answers,
          remainingTime,
          currentQuestionIndex,
          startedAt,
          startLogged
        })
      );
      saveDebounceRef.current = null;
    }, 700);

    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [answers, currentQuestionIndex, isSubmitting, loading, remainingTime, startLogged, startedAt, test, testId]);

  useEffect(() => {
    if (!test || loading || !startedAt || startLogged || startLogInFlightRef.current) return undefined;

    startLogInFlightRef.current = true;

    const markStart = async () => {
      try {
        await apiService.startMockTest(testId, { startedAt: Number(startedAt) });
        setStartLogged(true);
      } catch (requestError) {
        // Keep test flow non-blocking; dashboard refresh can still recompute with later activity.
      } finally {
        startLogInFlightRef.current = false;
      }
    };

    markStart();
    return undefined;
  }, [loading, startLogged, startedAt, test, testId]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!test || isSubmitting) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSubmitting, test]);

  const questions = useMemo(() => (Array.isArray(test?.questions) ? test.questions : []), [test]);
  const safeCurrentQuestionIndex = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.min(Math.max(currentQuestionIndex, 0), questions.length - 1);
  }, [currentQuestionIndex, questions.length]);

  useEffect(() => {
    // Defensive clamp: keeps index valid if questions length or route state changes.
    if (safeCurrentQuestionIndex !== currentQuestionIndex) {
      setCurrentQuestionIndex(safeCurrentQuestionIndex);
    }
  }, [currentQuestionIndex, safeCurrentQuestionIndex]);

  const currentQuestion = questions[safeCurrentQuestionIndex] || null;
  const currentQuestionId = getQuestionId(currentQuestion, safeCurrentQuestionIndex);
  const isMCQQuestion =
    Array.isArray(currentQuestion?.options) && currentQuestion.options.length > 0 && test?.testType === "MCQ";

  const attemptedCount = useMemo(() => {
    return questions.reduce((count, question, index) => {
      const questionIsMCQ = Array.isArray(question?.options) && question.options.length > 0;
      const questionId = getQuestionId(question, index);
      const answerRecord = answers?.[questionId];
      if (questionIsMCQ) {
        return answerRecord?.type === "mcq" && answerRecord.answer !== "" && answerRecord.answer !== undefined
          ? count + 1
          : count;
      }
      return answerRecord?.type === "coding" && Boolean(answerRecord?.code?.trim()) ? count + 1 : count;
    }, 0);
  }, [answers, questions]);

  const unattemptedCount = Math.max(0, questions.length - attemptedCount);

  const onMCQSelect = useCallback((questionId, answerData) => {
    if (isExpired) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: answerData
    }));
  }, [isExpired]);

  const onCodingChange = useCallback((questionId, updates) => {
    if (isExpired) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        type: "coding",
        code: updates?.sourceCode ?? prev?.[questionId]?.code ?? defaultCodingAnswer.sourceCode,
        language: String(updates?.languageId ?? prev?.[questionId]?.languageId ?? defaultCodingAnswer.languageId),
        languageId: Number(
          updates?.languageId ?? prev?.[questionId]?.languageId ?? defaultCodingAnswer.languageId
        )
      }
    }));

    setSubmitCodeResultsByQuestion((prev) => ({
      ...prev,
      [questionId]: null
    }));
  }, [isExpired]);

  const onRunCode = useCallback(async () => {
    if (isExpired) return;

    try {
      setRunLoadingQuestionId(currentQuestionId);
      setRunErrorsByQuestion((prev) => ({
        ...prev,
        [currentQuestionId]: ""
      }));
      const answerRecord = answers?.[currentQuestionId];
      const executionConfig = executionConfigByQuestion?.[currentQuestionId] || {};
      const executionMode = executionConfig?.mode === "custom" ? "custom" : "sample";
      const response = await apiService.runCode({
        code: answerRecord?.code || "",
        language: answerRecord?.languageId || 71,
        input: executionMode === "custom" ? executionConfig?.customInput || "" : currentQuestion?.sampleInput || ""
      });
      setRunResultsByQuestion((prev) => ({
        ...prev,
        [currentQuestionId]: response
      }));
    } catch (requestError) {
      setRunErrorsByQuestion((prev) => ({
        ...prev,
        [currentQuestionId]: "Unable to run code right now."
      }));
    } finally {
      setRunLoadingQuestionId("");
    }
  }, [answers, currentQuestion?.sampleInput, currentQuestionId, executionConfigByQuestion, isExpired]);

  const onSubmitCode = useCallback(async () => {
    if (isExpired) return;

    try {
      setSubmitCodeLoadingQuestionId(currentQuestionId);
      const answerRecord = answers?.[currentQuestionId];
      const response = await apiService.evaluateCode({
        questionId: currentQuestionId,
        code: answerRecord?.code || "",
        language: answerRecord?.languageId || 71
      });
      setSubmitCodeResultsByQuestion((prev) => ({
        ...prev,
        [currentQuestionId]: response
      }));
    } catch (requestError) {
      setSubmitCodeResultsByQuestion((prev) => ({
        ...prev,
        [currentQuestionId]: {
          error: requestError?.response?.data?.message || "Unable to evaluate code right now."
        }
      }));
    } finally {
      setSubmitCodeLoadingQuestionId("");
    }
  }, [answers, currentQuestionId, isExpired]);

  const handleSubmit = useCallback(
    async (autoSubmitted = false) => {
      if (hasSubmitStartedRef.current || !test || isSubmitting) return;

      // Defensive validation: avoid invalid submit attempts while preserving backend payload contract.
      if (!Array.isArray(test?.questions) || test.questions.length === 0) {
        setError("No questions available for submission.");
        return;
      }

      const safeAnswers = isPlainObject(answers) ? answers : {};

      try {
        hasSubmitStartedRef.current = true;
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsSubmitting(true);
        setError("");
        localStorage.setItem(getSubmissionLockKey(testId), JSON.stringify({ startedAt: Date.now() }));

        // Isolated mapper keeps submission contract unchanged for backend compatibility.
        const payload =
          test?.testType === "CODING"
            ? {
                testId,
                answers: questions
                  .map((question, questionIndex) => {
                    const questionId = getQuestionId(question, questionIndex);
                    const answerRecord = safeAnswers?.[questionId];

                    return {
                      questionId,
                      code: answerRecord?.code || "",
                      language: Number(answerRecord?.languageId) || defaultCodingAnswer.languageId
                    };
                  })
                  .filter((item) => item.questionId)
              }
            : mapAnswersForSubmission(safeAnswers, test, questions);
        if (startedAt && Number.isFinite(Number(startedAt))) {
          payload.startedAt = Number(startedAt);
        }

        const response =
          test?.testType === "CODING"
            ? await apiService.submitCodingTest(payload)
            : await apiService.submitMockTest(testId, payload);
        const result = response?.result || null;
        const attemptId = response?.attemptId || getAttemptId(result);

        const enrichedResult = {
          ...result,
          autoSubmitted
        };

        localStorage.removeItem(getAttemptStorageKey(testId));
        localStorage.removeItem(getSubmissionLockKey(testId));
        localStorage.setItem(getResultStorageKey(testId), JSON.stringify(enrichedResult));
        apiService.markStudentAttemptUpdated();

        if (attemptId) {
          navigate(`/student/attempt-review/${attemptId}`, { replace: true });
          return;
        }

        navigate("/student/attempt-history", { replace: true });
      } catch (requestError) {
        localStorage.removeItem(getSubmissionLockKey(testId));
        hasSubmitStartedRef.current = false;
        setError(requestError?.response?.data?.message || "Submission failed. Please retry.");
      } finally {
        setIsSubmitting(false);
        setShowSubmitModal(false);
      }
    },
    [answers, isSubmitting, navigate, questions, startedAt, test, testId]
  );

  useEffect(() => {
    // Reset auto-submit guard when test route changes.
    hasAutoSubmittedRef.current = false;
    hasExpirySubmittedRef.current = false;
    hasSubmitStartedRef.current = false;
    startLogInFlightRef.current = false;
    setStartLogged(false);
    setIsExpired(false);
    setExpiredOnLoad(false);
    setExecutionConfigByQuestion({});
    setRunResultsByQuestion({});
    setRunErrorsByQuestion({});
    setRunLoadingQuestionId("");
    setSubmitCodeResultsByQuestion({});
    setSubmitCodeLoadingQuestionId("");
  }, [testId]);

  useEffect(() => {
    const recoverPendingSubmission = async () => {
      const lockRaw = localStorage.getItem(getSubmissionLockKey(testId));
      if (!lockRaw) return;

      let lockData = null;
      try {
        lockData = JSON.parse(lockRaw);
      } catch (parseError) {
        localStorage.removeItem(getSubmissionLockKey(testId));
        return;
      }

      const startedAtMs = Number(lockData?.startedAt) || 0;
      const isFreshLock = startedAtMs > 0 && Date.now() - startedAtMs < 2 * 60 * 1000;
      if (!isFreshLock) {
        localStorage.removeItem(getSubmissionLockKey(testId));
        return;
      }

      // Prevent duplicate re-submit after refresh; attempt recovery first.
      hasSubmitStartedRef.current = true;
      setIsSubmitting(true);

      try {
        const data = await apiService.getStudentDashboard();
        const scores = Array.isArray(data?.dashboard?.mockTestScores) ? data.dashboard.mockTestScores : [];
        const matched = scores
          .filter((item) => String(item?.testId) === String(testId))
          .sort((a, b) => new Date(b?.takenAt || 0).getTime() - new Date(a?.takenAt || 0).getTime())[0];

        if (matched) {
          localStorage.removeItem(getSubmissionLockKey(testId));
          localStorage.removeItem(getAttemptStorageKey(testId));
          localStorage.setItem(getResultStorageKey(testId), JSON.stringify(matched));
          const matchedAttemptId = getAttemptId(matched);
          if (matchedAttemptId) {
            navigate(`/student/attempt-review/${matchedAttemptId}`, { replace: true });
            return;
          }

          navigate("/student/attempt-history", { replace: true });
          return;
        }
      } catch (requestError) {
        // Keep silent and allow fresh submit path if recovery cannot be verified.
      }

      localStorage.removeItem(getSubmissionLockKey(testId));
      hasSubmitStartedRef.current = false;
      setIsSubmitting(false);
    };

    recoverPendingSubmission();
  }, [navigate, testId]);

  useEffect(() => {
    // Stable timer engine:
    // - start only when test is ready
    // - keep a single interval
    // - auto-submit exactly once at timeout
    if (!test || loading || isSubmitting) {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return undefined;
    }

    const testEndDate = test?.endDate ? new Date(test.endDate) : null;
    const hasValidEndDate = testEndDate instanceof Date && !Number.isNaN(testEndDate.getTime());
    if (hasValidEndDate && Date.now() > testEndDate.getTime()) {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setIsExpired(true);
      if (!hasExpirySubmittedRef.current) {
        hasExpirySubmittedRef.current = true;
        handleSubmit(true);
      }
      return undefined;
    }

    if (remainingTime <= 0) {
      if (!hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        handleSubmit(true);
      }
      return undefined;
    }

    if (timerIntervalRef.current) {
      return undefined;
    }

    timerIntervalRef.current = window.setInterval(() => {
      if (hasValidEndDate && Date.now() > testEndDate.getTime()) {
        if (timerIntervalRef.current) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsExpired(true);
        if (!hasExpirySubmittedRef.current) {
          hasExpirySubmittedRef.current = true;
          handleSubmit(true);
        }
        return;
      }

      setRemainingTime((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            window.clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [handleSubmit, isSubmitting, loading, remainingTime, test]);

  if (loading) {
    return (
      <section className="card">
        <p className="muted-text">Loading test...</p>
      </section>
    );
  }

  if (error && !test) {
    return (
      <section className="card">
        <p className="dashboard-inline-hint error-text">{error}</p>
      </section>
    );
  }

  if (expiredOnLoad) {
    return (
      <section className="card">
        <h3>Test Unavailable</h3>
        <p className="muted-text">This test is no longer available.</p>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="card">
        <h3>No Questions</h3>
        <p className="muted-text">This test has no questions configured.</p>
      </section>
    );
  }

  return (
    <div className="student-dashboard test-session-workspace">
      <section className="dashboard-header test-session-header test-header">
        <div>
          <h2>{test?.title || "Test"}</h2>
          <p>
            {test?.subject || "-"} | Questions: {questions.length}
          </p>
        </div>

        <div className="test-session-header-actions">
          {test?.testType === "CODING" ? (
            <button
              type="button"
              className="auth-button"
              disabled={isExpired || isSubmitting}
              onClick={() => setShowSubmitModal(true)}
            >
              Submit Test
            </button>
          ) : null}
        </div>
      </section>

      {error ? <p className="dashboard-inline-hint error-text">{error}</p> : null}
      {isExpired ? (
        <p className="dashboard-inline-hint error-text">Test time window has expired. Submitting...</p>
      ) : null}

      <QuestionNavigator
        questions={questions}
        currentIndex={safeCurrentQuestionIndex}
        answers={answers}
        getQuestionId={getQuestionId}
        disabled={isExpired || isSubmitting}
        remainingSeconds={remainingTime}
        onNavigate={(index) => {
          if (isExpired) return;
          setCurrentQuestionIndex(index);
        }}
      />

      <section className={`test-layout ${isMCQQuestion ? "test-layout-mcq" : "test-layout-coding"}`}>
        <div className={`card test-question-panel ${isMCQQuestion ? "test-question-panel-mcq" : "test-question-panel-coding"}`}>
          {isMCQQuestion ? (
            <MCQQuestion
              question={currentQuestion}
              questionIndex={safeCurrentQuestionIndex}
              selectedAnswer={
                typeof answers?.[currentQuestionId]?.answer === "number"
                  ? currentQuestion?.options?.[answers[currentQuestionId].answer] || ""
                  : answers?.[currentQuestionId]?.answer || ""
              }
              disabled={isExpired || isSubmitting}
              onSelect={(option) =>
                onMCQSelect(currentQuestionId, {
                  type: "mcq",
                  answer: currentQuestion?.options?.findIndex((item) => item === option)
                })
              }
            />
          ) : (
            <CodingQuestion
              question={currentQuestion}
              codingAnswer={{
                sourceCode: answers?.[currentQuestionId]?.code || defaultCodingAnswer.sourceCode,
                languageId: answers?.[currentQuestionId]?.languageId || defaultCodingAnswer.languageId
              }}
              executionMode={executionConfigByQuestion?.[currentQuestionId]?.mode || "sample"}
              customInput={executionConfigByQuestion?.[currentQuestionId]?.customInput || ""}
              runOutput={runResultsByQuestion?.[currentQuestionId] || null}
              runLoading={runLoadingQuestionId === currentQuestionId}
              runError={runErrorsByQuestion?.[currentQuestionId] || ""}
              submitResult={submitCodeResultsByQuestion?.[currentQuestionId] || null}
              submitLoading={submitCodeLoadingQuestionId === currentQuestionId}
              disabled={isExpired || isSubmitting}
              onChange={(updates) => onCodingChange(currentQuestionId, updates)}
              onExecutionModeChange={(mode) =>
                setExecutionConfigByQuestion((prev) => ({
                  ...prev,
                  [currentQuestionId]: {
                    ...(prev?.[currentQuestionId] || {}),
                    mode
                  }
                }))
              }
              onCustomInputChange={(value) =>
                setExecutionConfigByQuestion((prev) => ({
                  ...prev,
                  [currentQuestionId]: {
                    ...(prev?.[currentQuestionId] || {}),
                    mode: "custom",
                    customInput: value
                  }
                }))
              }
              onRunCode={onRunCode}
              onSubmitCode={onSubmitCode}
            />
          )}

          <div className="test-actions-row">
            <button
              type="button"
              className="topbar-logout"
              disabled={safeCurrentQuestionIndex === 0 || isExpired || isSubmitting}
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </button>

            {safeCurrentQuestionIndex < questions.length - 1 ? (
              <button
                type="button"
                className="auth-button"
                disabled={isExpired || isSubmitting}
                onClick={() =>
                  setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
                }
              >
                Next
              </button>
            ) : test?.testType === "CODING" ? null : (
              <button
                type="button"
                className="auth-button"
                disabled={isExpired || isSubmitting}
                onClick={() => setShowSubmitModal(true)}
              >
                Submit Test
              </button>
            )}
          </div>
        </div>
      </section>

      <SubmitModal
        open={showSubmitModal}
        attempted={attemptedCount}
        unattempted={unattemptedCount}
        submitting={isSubmitting}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={() => handleSubmit(false)}
      />
    </div>
  );
};

export default StartTest;
