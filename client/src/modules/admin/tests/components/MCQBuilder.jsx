import QuestionCard from "./QuestionCard";

const MCQBuilder = ({ question, index, onChange, onRemove }) => {
  const setOption = (optionIndex, value) => {
    const nextOptions = [...question.options];
    nextOptions[optionIndex] = value;
    onChange({ ...question, options: nextOptions });
  };

  return (
    <QuestionCard
      title={`MCQ ${index + 1}`}
      subtitle="Multiple choice question"
      onRemove={onRemove}
    >
      <div className="admin-form-grid">
        <label>
          Question
          <textarea
            className="code-textarea"
            value={question.question}
            onChange={(event) => onChange({ ...question, question: event.target.value })}
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

      <div className="admin-options-list">
        {question.options.map((option, optionIndex) => (
          <div className="admin-option-row" key={`mcq-${index}-option-${optionIndex}`}>
            <input
              type="radio"
              name={`mcq-correct-${index}`}
              checked={question.correctAnswer === option}
              onChange={() => onChange({ ...question, correctAnswer: option })}
            />
            <input
              className="auth-input"
              value={option}
              placeholder={`Option ${optionIndex + 1}`}
              onChange={(event) => setOption(optionIndex, event.target.value)}
            />
          </div>
        ))}
      </div>
    </QuestionCard>
  );
};

export default MCQBuilder;
