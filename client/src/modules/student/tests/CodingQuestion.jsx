import CodeEditorPanel from "./coding/CodeEditorPanel";
import ProblemDescription from "./coding/ProblemDescription";

const CodingQuestion = ({
  question,
  codingAnswer,
  executionMode,
  customInput,
  runOutput,
  runLoading,
  runError,
  submitResult,
  submitLoading,
  disabled,
  onChange,
  onExecutionModeChange,
  onCustomInputChange,
  onRunCode,
  onSubmitCode
}) => {
  return (
    <div className="coding-workspace">
      <ProblemDescription question={question} />
      <div className="coding-editor-scroll">
        <CodeEditorPanel
          question={question}
          codingAnswer={codingAnswer}
          executionMode={executionMode}
          customInput={customInput}
          runOutput={runOutput}
          runLoading={runLoading}
          runError={runError}
          submitResult={submitResult}
          submitLoading={submitLoading}
          disabled={disabled}
          onChange={onChange}
          onExecutionModeChange={onExecutionModeChange}
          onCustomInputChange={onCustomInputChange}
          onRunCode={onRunCode}
          onSubmitCode={onSubmitCode}
        />
      </div>
    </div>
  );
};

export default CodingQuestion;
