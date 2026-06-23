import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../../../api/apiService";
import TestForm from "./components/TestForm";

const initialFormState = {
  title: "",
  description: "",
  subject: "Technical",
  duration: 60,
  startDate: "",
  endDate: "",
  isPublished: false,
  questions: []
};

const mapQuestionToApi = (question) => {
  if (question.type === "mcq") {
    return {
      questionText: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      topic: question.topic || "General"
    };
  }

  return {
    questionText: question.title || "Coding Question",
    problemStatement: question.description,
    inputFormat: question.inputFormat || "",
    outputFormat: question.outputFormat || "",
    constraints: question.constraints,
    sampleInput: question.sampleInput,
    sampleOutput: question.sampleOutput,
    languageId: 71,
    starterCode: question.starterCode || {
      javascript: "",
      python: "",
      java: "",
      cpp: ""
    },
    marks: Number(question.marks) || 1,
    topic: question.topic || "General",
    testCases: Array.isArray(question.testCases) && question.testCases.length > 0
      ? question.testCases.map((testCase) => ({
          input: String(testCase?.input ?? "").trim(),
          expectedOutput: String(testCase?.expectedOutput ?? "").trim()
        }))
      : [{ input: String(question.sampleInput || "").trim(), expectedOutput: String(question.sampleOutput || "").trim() }]
  };
};

const CreateTest = () => {
  const navigate = useNavigate();
  const [formState, setFormState] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const questionType = useMemo(() => {
    if (formState.questions.length === 0) return "";
    const first = formState.questions[0].type;
    return formState.questions.every((q) => q.type === first) ? first : "mixed";
  }, [formState.questions]);
  const isCodingType = (formState.subject || "Technical") === "Coding";

  const handleSubmit = async () => {
    if (!formState.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (isCodingType && formState.questions.filter((q) => q.type === "coding").length === 0) {
      setError("Add at least one coding question.");
      return;
    }

    if (!isCodingType && formState.questions.filter((q) => q.type === "mcq").length === 0) {
      setError("Add at least one MCQ question.");
      return;
    }

    if (questionType === "mixed") {
      setError("Current backend accepts one test type per test. Use only MCQ or only Coding questions.");
      return;
    }

    if (isCodingType) {
      const invalidQuestion = formState.questions.find((question) => {
        if (question.type !== "coding") {
          return false;
        }
        const testCases = Array.isArray(question.testCases) ? question.testCases : [];
        if (testCases.length === 0) {
          return true;
        }
        return testCases.some((testCase) => {
          const input = String(testCase?.input ?? "").trim();
          const expectedOutput = String(testCase?.expectedOutput ?? "").trim();
          return !input || !expectedOutput;
        });
      });

      if (invalidQuestion) {
        setError("Each coding question must include at least one test case with input and expected output.");
        return;
      }
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        title: formState.title.trim(),
        subject: formState.subject || "Technical",
        testType: isCodingType ? "CODING" : "MCQ",
        questions: formState.questions.map(mapQuestionToApi),
        // Additional UI fields are sent but ignored by current backend create service.
        description: formState.description,
        duration: Number(formState.duration),
        startDate: formState.startDate || null,
        endDate: formState.endDate || null,
        isPublished: formState.isPublished
      };

      await apiService.createTest(payload);
      setToast("Test created successfully.");

      window.setTimeout(() => {
        navigate("/admin/manage-tests", { replace: true });
      }, 700);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to create test.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Create Test</h2>
        <p>Build and publish a new test for students.</p>
      </section>

      {toast ? <div className="admin-toast success">{toast}</div> : null}
      {error ? <div className="admin-toast error">{error}</div> : null}

      <TestForm
        value={formState}
        onChange={setFormState}
        onSubmit={handleSubmit}
        submitting={loading}
        submitLabel="Create Test"
      />
    </div>
  );
};

export default CreateTest;
