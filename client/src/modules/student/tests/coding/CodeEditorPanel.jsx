import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import LanguageSelector, { getLanguageMeta, getStarterCodeByLanguage } from "./LanguageSelector";
import RunResultPanel from "./RunResultPanel";
import SubmitResultPanel from "./SubmitResultPanel";

const CodeEditorPanel = ({
  question,
  codingAnswer,
  executionMode = "sample",
  customInput = "",
  runOutput,
  runLoading,
  runError,
  submitResult,
  submitLoading = false,
  disabled = false,
  onChange,
  onExecutionModeChange,
  onCustomInputChange,
  onRunCode,
  onSubmitCode
}) => {
  const [resultView, setResultView] = useState("run");

  const languageMeta = useMemo(
    () => getLanguageMeta(codingAnswer?.languageId),
    [codingAnswer?.languageId]
  );

  useEffect(() => {
    if (submitResult) {
      setResultView("submit");
    }
  }, [submitResult]);

  const handleLanguageChange = (nextLanguageId) => {
    if (disabled) return;

    onChange({
      languageId: nextLanguageId,
      sourceCode: getStarterCodeByLanguage(nextLanguageId)
    });
  };

  return (
    <section className="code-editor-panel">
      <header className="editor-toolbar">
        <div className="toolbar-left">
          <LanguageSelector value={codingAnswer?.languageId} onChange={handleLanguageChange} disabled={disabled} />
        </div>
        <div className="toolbar-right">
          <button
            type="button"
            className="run-btn"
            onClick={() => {
              setResultView("run");
              onRunCode();
            }}
            disabled={runLoading || disabled}
          >
            {runLoading ? "Running..." : "Run"}
          </button>
          <button
            type="button"
            className="submit-btn"
            onClick={() => {
              setResultView("submit");
              onSubmitCode();
            }}
            disabled={submitLoading || disabled}
          >
            {submitLoading ? "Submitting..." : "Submit Code"}
          </button>
        </div>
      </header>

      <div className="editor-panel-main">
        <div className="editor-surface">
          <Editor
            height="100%"
            theme="vs-dark"
            language={languageMeta.monacoLanguage}
            value={codingAnswer?.sourceCode || ""}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              lineNumbers: "on",
              automaticLayout: true,
              readOnly: disabled
            }}
            onChange={(value) => {
              if (disabled) return;
              onChange({ sourceCode: value || "" });
            }}
          />
        </div>
      </div>

      <section className="console-section">
        <div className="console-header">
          <div>
            <h4>Console Output</h4>
            <p>
              {resultView === "submit"
                ? "Hidden test case evaluation for this question."
                : executionMode === "custom"
                  ? "Run uses your custom input."
                  : "Run uses the sample input from the problem."}
            </p>
          </div>
          <label className="console-toggle" htmlFor="useCustomInput">
            <input
              id="useCustomInput"
              type="checkbox"
              checked={executionMode === "custom"}
              disabled={disabled}
              onChange={(event) => onExecutionModeChange(event.target.checked ? "custom" : "sample")}
            />
            <span>Use Custom Input</span>
          </label>
        </div>

        {executionMode === "custom" ? (
          <label className="editor-field console-input-field" htmlFor="customRunInput">
            <span>Custom Input</span>
            <textarea
              id="customRunInput"
              className="code-textarea console-textarea"
              value={customInput}
              disabled={disabled}
              onChange={(event) => onCustomInputChange(event.target.value)}
              placeholder="Enter custom input..."
            />
          </label>
        ) : (
          <div className="console-sample-preview">
            <span>Sample Input</span>
            <pre>{question?.sampleInput || "No sample input provided."}</pre>
          </div>
        )}

        <div className="console-result">
          {resultView === "submit" ? (
            <SubmitResultPanel submitResult={submitResult} />
          ) : (
            <RunResultPanel
              runOutput={runOutput}
              runError={runError}
              loading={runLoading}
              executionMode={executionMode}
              sampleOutput={question?.sampleOutput || ""}
            />
          )}
        </div>
      </section>
    </section>
  );
};

export default CodeEditorPanel;
