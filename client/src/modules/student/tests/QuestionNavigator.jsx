const padTime = (value) => String(value).padStart(2, "0");

const formatMMSS = (totalSeconds) => {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${padTime(minutes)}:${padTime(seconds)}`;
};

const QuestionNavigator = ({
  questions,
  currentIndex,
  answers,
  getQuestionId,
  disabled = false,
  remainingSeconds,
  onNavigate
}) => {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const totalQuestions = safeQuestions.length;
  const hasTimer = Number.isFinite(Number(remainingSeconds));
  const timerLabel = hasTimer ? formatMMSS(remainingSeconds) : "";

  const isAnswered = (question, questionIndex) => {
    const questionId =
      typeof getQuestionId === "function"
        ? getQuestionId(question, questionIndex)
        : question?.id || question?._id || `q-${questionIndex}`;
    const answerRecord = answers?.[questionId];
    const isMCQ = Array.isArray(question?.options) && question.options.length > 0;
    if (isMCQ) {
      return answerRecord?.type === "mcq" && answerRecord.answer !== "" && answerRecord.answer !== undefined;
    }

    return answerRecord?.type === "coding" && Boolean(answerRecord?.code?.trim());
  };

  const answeredCount = safeQuestions.reduce(
    (count, question, questionIndex) => count + (isAnswered(question, questionIndex) ? 1 : 0),
    0
  );

  return (
    <section className="question-nav card" aria-label="Question navigation">
      <div className="question-nav-head">
        <h4>Questions</h4>
        <div className="question-nav-meta">
          <span className="question-nav-progress">
            <strong>{answeredCount}</strong>/{totalQuestions} Answered
          </span>
          {hasTimer ? (
            <>
              <i className="question-nav-separator" aria-hidden="true" />
              <strong
                className={`question-nav-timer${remainingSeconds <= 60 ? " danger" : ""}`}
                aria-label={`Time left ${timerLabel}`}
              >
                {timerLabel}
              </strong>
            </>
          ) : null}
        </div>
      </div>
      {totalQuestions === 0 ? <p className="muted-text">No questions</p> : null}

      <div className="question-nav-grid" role="tablist" aria-label="Questions">
        {safeQuestions.map((question, questionIndex) => {
          const answered = isAnswered(question, questionIndex);
          const isCurrent = currentIndex === questionIndex;
          const buttonClass = [
            "question-nav-btn",
            answered ? "answered" : "unanswered",
            isCurrent ? "current" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={`question-nav-${questionIndex}`}
              type="button"
              className={buttonClass}
              disabled={disabled}
              role="tab"
              aria-selected={isCurrent}
              aria-label={`Question ${questionIndex + 1}${answered ? ", answered" : ", not answered"}`}
              onClick={() => onNavigate(questionIndex)}
            >
              {questionIndex + 1}
            </button>
          );
        })}
      </div>

      <div className="question-nav-legend">
        <span className="legend-item"><i className="legend-dot answered" />Answered</span>
        <span className="legend-item"><i className="legend-dot unanswered" />Not Answered</span>
        <span className="legend-item"><i className="legend-dot current" />Current</span>
      </div>
    </section>
  );
};

export default QuestionNavigator;
