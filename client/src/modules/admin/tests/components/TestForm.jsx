import MCQBuilder from "./MCQBuilder";
import CodingBuilder from "./CodingBuilder";

const createMCQQuestion = () => ({
  type: "mcq",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  marks: 1,
  topic: ""
});

const createCodingQuestion = () => ({
  type: "coding",
  title: "",
  description: "",
  constraints: "",
  sampleInput: "",
  sampleOutput: "",
  inputFormat: "",
  outputFormat: "",
  starterCode: {
    javascript: "",
    python: "",
    java: "",
    cpp: ""
  },
  testCases: [{ input: "", expectedOutput: "" }],
  marks: 1,
  topic: ""
});

const TestForm = ({ value, onChange, onSubmit, submitting, submitLabel = "Create Test" }) => {
  const mcqQuestions = value.questions.filter((q) => q.type === "mcq");
  const codingQuestions = value.questions.filter((q) => q.type === "coding");
  const selectedType = value.subject || "Technical";
  const isCodingType = selectedType === "Coding";

  const setField = (field, fieldValue) => {
    if (field === "subject") {
      const nextType = fieldValue;
      const keepType = nextType === "Coding" ? "coding" : "mcq";
      const normalizedQuestions = value.questions.filter((question) => question.type === keepType);
      onChange({ ...value, [field]: fieldValue, questions: normalizedQuestions });
      return;
    }
    onChange({ ...value, [field]: fieldValue });
  };

  const updateQuestionAt = (questionIndex, updatedQuestion) => {
    const nextQuestions = value.questions.map((question, index) =>
      index === questionIndex ? updatedQuestion : question
    );
    onChange({ ...value, questions: nextQuestions });
  };

  const removeQuestionAt = (questionIndex) => {
    onChange({
      ...value,
      questions: value.questions.filter((_, index) => index !== questionIndex)
    });
  };

  return (
    <section className="card admin-form">
      <div className="admin-form-grid admin-test-layout-grid">
        <label>
          Type
          <select
            className="auth-input"
            value={value.subject || "Technical"}
            onChange={(event) => setField("subject", event.target.value)}
          >
            <option value="Aptitude">Aptitude</option>
            <option value="Technical">Technical</option>
            <option value="Coding">Coding</option>
          </select>
        </label>

        <label>
          Title
          <input
            className="auth-input"
            value={value.title}
            onChange={(event) => setField("title", event.target.value)}
          />
        </label>

        <label>
          Duration
          <input
            type="number"
            min="1"
            className="auth-input"
            value={value.duration}
            onChange={(event) => setField("duration", Number(event.target.value) || 1)}
          />
        </label>

        <label>
          Start Date
          <input
            type="datetime-local"
            className="auth-input"
            value={value.startDate}
            onChange={(event) => setField("startDate", event.target.value)}
          />
        </label>

        <label>
          End Date
          <input
            type="datetime-local"
            className="auth-input"
            value={value.endDate}
            onChange={(event) => setField("endDate", event.target.value)}
          />
        </label>

        <label className="admin-toggle">
          <input
            type="checkbox"
            checked={value.isPublished}
            onChange={(event) => setField("isPublished", event.target.checked)}
          />
            <span>Publish</span>
          </label>

        <label className="admin-field-full">
          Description
          <textarea
            className="code-textarea admin-description-textarea"
            value={value.description}
            onChange={(event) => setField("description", event.target.value)}
          />
        </label>
      </div>

      <div className="admin-action-row">
        {!isCodingType ? (
          <button
            type="button"
            className="topbar-logout"
            onClick={() => onChange({ ...value, questions: [...value.questions, createMCQQuestion()] })}
          >
            Add MCQ Question
          </button>
        ) : null}
        {isCodingType ? (
          <button
            type="button"
            className="topbar-logout"
            onClick={() => onChange({ ...value, questions: [...value.questions, createCodingQuestion()] })}
          >
            Add Coding Question
          </button>
        ) : null}
      </div>

      {!isCodingType ? (
        <section className="admin-section">
          <h3>MCQ Questions ({mcqQuestions.length})</h3>
          {value.questions.map((question, index) =>
            question.type === "mcq" ? (
              <MCQBuilder
                key={`mcq-${index}`}
                question={question}
                index={mcqQuestions.findIndex((item) => item === question)}
                onChange={(updatedQuestion) => updateQuestionAt(index, updatedQuestion)}
                onRemove={() => removeQuestionAt(index)}
              />
            ) : null
          )}
        </section>
      ) : null}

      {isCodingType ? (
        <section className="admin-section">
          <h3>Coding Questions ({codingQuestions.length})</h3>
          {value.questions.map((question, index) =>
            question.type === "coding" ? (
              <CodingBuilder
                key={`coding-${index}`}
                question={question}
                index={codingQuestions.findIndex((item) => item === question)}
                onChange={(updatedQuestion) => updateQuestionAt(index, updatedQuestion)}
                onRemove={() => removeQuestionAt(index)}
              />
            ) : null
          )}
        </section>
      ) : null}

      <div className="admin-submit-row admin-submit-row-full">
        <button type="button" className="auth-button" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </section>
  );
};

export default TestForm;
