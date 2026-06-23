const ProblemDescription = ({ question }) => {
  return (
    <section className="problem-description">
      <header className="problem-header">
        <p className="problem-kicker">Problem</p>
        <h3>{question?.questionText || "Coding Problem"}</h3>
      </header>

      <div className="question-section">
        <div className="section-block">
          <h3 className="section-title">Description</h3>
          <p className="section-content">{question?.problemStatement || "-"}</p>
        </div>

        <div className="section-block">
          <h3 className="section-title">Constraints</h3>
          <p className="section-content">{question?.constraints || "-"}</p>
        </div>

        <div className="section-block">
          <h3 className="section-title">Sample Input</h3>
          <div className="code-block">
            <pre>{question?.sampleInput || "-"}</pre>
          </div>
        </div>

        <div className="section-block">
          <h3 className="section-title">Sample Output</h3>
          <div className="code-block">
            <pre>{question?.sampleOutput || "-"}</pre>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemDescription;
