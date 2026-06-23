const MCQQuestion = ({ question, questionIndex, selectedAnswer, disabled = false, onSelect }) => {
  return (
    <article className="question-card">
      <p className="question-title">
        Q{questionIndex + 1}. {question?.questionText || "Untitled question"}
      </p>

      <div className="option-list">
        {(question?.options || []).map((option, optionIndex) => {
          const isSelected = selectedAnswer === option;
          return (
            <button
              key={`${option}-${optionIndex}`}
              type="button"
              className={`option-btn${isSelected ? " selected" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(option)}
            >
              <span className="option-index">{String.fromCharCode(65 + optionIndex)}.</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
};

export default MCQQuestion;
