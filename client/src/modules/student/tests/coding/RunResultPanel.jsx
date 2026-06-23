const normalize = (output) => String(output || "").trim().replace(/\r/g, "");

const RunResultPanel = ({ runOutput, runError, loading, executionMode, sampleOutput = "" }) => {
  if (loading) {
    return <div className="result-panel muted-text">Running code...</div>;
  }

  if (runError) {
    return <div className="result-panel error-text">{runError}</div>;
  }

  if (!runOutput) {
    return (
      <div className="result-panel muted-text">
        Run your code to see output using {executionMode === "custom" ? "custom input" : "sample input"}.
      </div>
    );
  }

  const output = runOutput.stdout || runOutput.stderr || runOutput.compile_output || "-";
  const hasExecutionError = Boolean(runOutput?.stderr || runOutput?.compile_output);
  const isSampleRun = executionMode !== "custom";
  const verdict = isSampleRun
    ? hasExecutionError
      ? "Wrong Answer"
      : normalize(output) === normalize(sampleOutput)
        ? "Accepted"
        : "Wrong Answer"
    : "";
  const statusClass =
    executionMode === "custom" ? "" : verdict === "Accepted" ? " pass" : " fail";

  return (
    <div className="result-panel">
      <article className={`result-case${statusClass}`}>
        <div className="result-case-head">
          <strong>{executionMode === "custom" ? "Custom Input Run" : "Sample Input Run"}</strong>
          {executionMode === "custom" ? null : <span>{verdict}</span>}
        </div>
        <div className="result-case-body">
          <p>
            <strong>Output:</strong>
          </p>
          <pre>{output}</pre>
          {executionMode === "custom" ? null : (
            <p>
              <strong>Verdict:</strong> {verdict}
            </p>
          )}
        </div>
      </article>
    </div>
  );
};

export default RunResultPanel;
