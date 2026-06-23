import QuestionCard from "./QuestionCard";

const CodingBuilder = ({ question, index, onChange, onRemove }) => {
  const testCases = Array.isArray(question.testCases) && question.testCases.length > 0
    ? question.testCases
    : [{ input: "", expectedOutput: "" }];

  const updateStarterCode = (language, value) => {
    onChange({
      ...question,
      starterCode: {
        ...question.starterCode,
        [language]: value
      }
    });
  };

  const updateTestCase = (caseIndex, patch) => {
    const nextTestCases = testCases.map((testCase, indexValue) =>
      indexValue === caseIndex ? { ...testCase, ...patch } : testCase
    );
    onChange({
      ...question,
      testCases: nextTestCases
    });
  };

  const addTestCase = () => {
    onChange({
      ...question,
      testCases: [...testCases, { input: "", expectedOutput: "" }]
    });
  };

  const removeTestCase = (caseIndex) => {
    if (testCases.length <= 1) {
      return;
    }
    onChange({
      ...question,
      testCases: testCases.filter((_, indexValue) => indexValue !== caseIndex)
    });
  };

  return (
    <QuestionCard title={`Coding ${index + 1}`} subtitle="Programming question" onRemove={onRemove}>
      <div className="admin-form-grid">
        <label>
          Title
          <input
            className="auth-input"
            value={question.title}
            onChange={(event) => onChange({ ...question, title: event.target.value })}
          />
        </label>
        <label>
          Topic
          <input
            className="auth-input"
            value={question.topic || ""}
            onChange={(event) => onChange({ ...question, topic: event.target.value })}
          />
        </label>
        <label>
          Marks
          <input
            type="number"
            min="1"
            className="auth-input"
            value={question.marks}
            onChange={(event) => onChange({ ...question, marks: Number(event.target.value) || 1 })}
          />
        </label>
      </div>

      <div className="admin-form-grid">
        <label>
          Description
          <textarea
            className="code-textarea"
            value={question.description}
            onChange={(event) => onChange({ ...question, description: event.target.value })}
          />
        </label>
        <label>
          Constraints
          <textarea
            className="code-textarea"
            value={question.constraints}
            onChange={(event) => onChange({ ...question, constraints: event.target.value })}
          />
        </label>
        <label>
          Sample Input
          <textarea
            className="code-textarea"
            value={question.sampleInput}
            onChange={(event) => onChange({ ...question, sampleInput: event.target.value })}
          />
        </label>
        <label>
          Sample Output
          <textarea
            className="code-textarea"
            value={question.sampleOutput}
            onChange={(event) => onChange({ ...question, sampleOutput: event.target.value })}
          />
        </label>
      </div>

      <div className="admin-starter-grid">
        {["javascript", "python", "java", "cpp"].map((language) => (
          <label key={`starter-${index}-${language}`}>
            Starter Code ({language})
            <textarea
              className="code-textarea"
              value={question.starterCode[language]}
              onChange={(event) => updateStarterCode(language, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="admin-testcases">
        <p>Test Cases</p>
        {testCases.map((testCase, caseIndex) => (
          <div className="admin-testcase-row" key={`coding-${index}-case-${caseIndex}`}>
            <label>
              Input
              <textarea
                className="code-textarea"
                value={testCase.input || ""}
                onChange={(event) => updateTestCase(caseIndex, { input: event.target.value })}
              />
            </label>
            <label>
              Expected Output
              <textarea
                className="code-textarea"
                value={testCase.expectedOutput || ""}
                onChange={(event) => updateTestCase(caseIndex, { expectedOutput: event.target.value })}
              />
            </label>
            <button
              type="button"
              className="topbar-logout"
              onClick={() => removeTestCase(caseIndex)}
              disabled={testCases.length <= 1}
            >
              Remove Test Case
            </button>
          </div>
        ))}
        <button type="button" className="topbar-logout" onClick={addTestCase}>
          Add Test Case
        </button>
      </div>
    </QuestionCard>
  );
};

export default CodingBuilder;
