const deriveVerdict = (submitResult) => {
  const passed = Number(submitResult?.passedTestCases) || 0;
  const total = Number(submitResult?.totalTestCases) || 0;

  if (total === 0) return "Pending";
  if (passed === total) return "Accepted";
  return "Wrong Answer";
};

const SubmitResultPanel = ({ submitResult }) => {
  if (!submitResult) {
    return <div className="result-panel muted-text">Submit to view hidden test case evaluation.</div>;
  }

  if (submitResult?.error) {
    return <div className="result-panel error-text">{submitResult.error}</div>;
  }

  const total = Number(submitResult?.totalTestCases) || 0;
  const passed = Number(submitResult?.passedTestCases) || 0;
  const failed = Math.max(0, total - passed);
  const verdict = submitResult?.verdict || deriveVerdict(submitResult);
  const marksObtained = Number(submitResult?.marksObtained) || 0;
  const maxMarks = Number(submitResult?.maxMarks) || 0;

  return (
    <div className="result-panel">
      <p>
        <strong>Hidden Testcase Evaluation</strong>
      </p>
      <div className="submit-summary-grid">
        <div>
          <span>Total Cases</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>Passed</span>
          <strong>{passed}</strong>
        </div>
        <div>
          <span>Failed</span>
          <strong>{failed}</strong>
        </div>
        <div>
          <span>Marks</span>
          <strong>
            {marksObtained}/{maxMarks}
          </strong>
        </div>
      </div>
      <p>Passed: {passed}/{total}</p>
      <p>Marks: {marksObtained}/{maxMarks}</p>
      <p className={`submit-verdict ${verdict === "Accepted" ? "accepted" : "rejected"}`}>
        Verdict: {verdict}
      </p>
    </div>
  );
};

export default SubmitResultPanel;
