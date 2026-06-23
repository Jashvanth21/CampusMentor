import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

const formatDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const mapApiQuestionToForm = (question, testType) => {
  const isMCQ = testType === "MCQ" || (Array.isArray(question?.options) && question.options.length > 0);
  if (isMCQ) {
    const options = Array.isArray(question?.options) ? question.options : ["", "", "", ""];
    return {
      type: "mcq",
      question: question?.questionText || "",
      options: options.length >= 4 ? options : [...options, ...Array(Math.max(0, 4 - options.length)).fill("")],
      correctAnswer: question?.correctAnswer || "",
      marks: Number(question?.marks) || 1,
      topic: question?.topic || ""
    };
  }

  return {
    type: "coding",
    title: question?.questionText || "Coding Question",
    description: question?.problemStatement || "",
    constraints: question?.constraints || "",
    sampleInput: question?.sampleInput || "",
    sampleOutput: question?.sampleOutput || "",
    inputFormat: question?.inputFormat || "",
    outputFormat: question?.outputFormat || "",
    starterCode: {
      javascript: question?.starterCode?.javascript || "",
      python: question?.starterCode?.python || "",
      java: question?.starterCode?.java || "",
      cpp: question?.starterCode?.cpp || ""
    },
    testCases: Array.isArray(question?.testCases) && question.testCases.length > 0
      ? question.testCases.map((testCase) => ({
          input: String(testCase?.input ?? ""),
          expectedOutput: String(testCase?.expectedOutput ?? "")
        }))
      : [{ input: "", expectedOutput: "" }],
    marks: Number(question?.marks) || 1,
    topic: question?.topic || ""
  };
};

const mapFormQuestionToApi = (question) => {
  if (question.type === "mcq") {
    return {
      questionText: question.question,
      options: question.options,
      correctAnswer: question.correctAnswer,
      topic: question.topic || "General",
      marks: Number(question.marks) || 1
    };
  }

  const testCases = Array.isArray(question.testCases) ? question.testCases : [];
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
    testCases: testCases.map((testCase) => ({
      input: String(testCase?.input ?? "").trim(),
      expectedOutput: String(testCase?.expectedOutput ?? "").trim()
    }))
  };
};

const EditTest = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formState, setFormState] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const questionType = useMemo(() => {
    if (formState.questions.length === 0) return "";
    const first = formState.questions[0].type;
    return formState.questions.every((question) => question.type === first) ? first : "mixed";
  }, [formState.questions]);

  useEffect(() => {
    const fetchTestById = async () => {
      try {
        setFetching(true);
        setError("");

        const response = await apiService.getMockTestById(id);
        const test = response?.test;
        if (!test) {
          setError("Test not found.");
          return;
        }

        const normalizedSubject = test.subject === "DSA" ? "Technical" : (test.subject || "Technical");
        setFormState({
          title: test.title || "",
          description: test.description || "",
          subject: normalizedSubject,
          duration: Number(test.duration) > 0 ? Number(test.duration) : 60,
          startDate: formatDateTimeLocal(test.startDate),
          endDate: formatDateTimeLocal(test.endDate),
          isPublished: Boolean(test.isPublished),
          questions: Array.isArray(test.questions)
            ? test.questions.map((question) => mapApiQuestionToForm(question, test.testType))
            : []
        });
      } catch (requestError) {
        setError(requestError?.response?.data?.message || "Unable to load test details.");
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchTestById();
    }
  }, [id]);

  const handleSubmit = async () => {
    if (!formState.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (formState.questions.length === 0) {
      setError("Add at least one question.");
      return;
    }

    if (questionType === "mixed") {
      setError("Current backend accepts one test type per test. Use only MCQ or only Coding questions.");
      return;
    }

    if (questionType === "coding") {
      const invalidQuestion = formState.questions.find((question) => {
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
        description: formState.description,
        duration: Number(formState.duration),
        startDate: formState.startDate || null,
        endDate: formState.endDate || null,
        isPublished: formState.isPublished,
        subject: formState.subject === "DSA" ? "Technical" : (formState.subject || "Technical"),
        testType: questionType === "mcq" ? "MCQ" : "CODING",
        questions: formState.questions.map(mapFormQuestionToApi)
      };

      await apiService.updateMockTest(id, payload);
      setToast("Test updated successfully.");

      window.setTimeout(() => {
        navigate("/admin/manage-tests", { replace: true });
      }, 700);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to update test.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <section className="card">
        <p className="muted-text">Loading test details...</p>
      </section>
    );
  }

  return (
    <div className="student-dashboard">
      <section className="dashboard-header">
        <h2>Edit Test</h2>
        <p>Update test details and questions.</p>
      </section>

      {toast ? <div className="admin-toast success">{toast}</div> : null}
      {error ? <div className="admin-toast error">{error}</div> : null}

      <TestForm
        value={formState}
        onChange={setFormState}
        onSubmit={handleSubmit}
        submitting={loading}
        submitLabel="Update Test"
      />
    </div>
  );
};

export default EditTest;
