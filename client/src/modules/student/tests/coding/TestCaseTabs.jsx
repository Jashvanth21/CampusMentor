const TestCaseTabs = ({ selectedTab, onSelectTab }) => {
  return (
    <div className="test-case-tabs" role="tablist" aria-label="Test case panels">
      <button
        type="button"
        role="tab"
        aria-selected={selectedTab === "input"}
        className={`test-case-tab${selectedTab === "input" ? " active" : ""}`}
        onClick={() => onSelectTab("input")}
      >
        Custom Input
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={selectedTab === "run"}
        className={`test-case-tab${selectedTab === "run" ? " active" : ""}`}
        onClick={() => onSelectTab("run")}
      >
        Run Result
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={selectedTab === "submit"}
        className={`test-case-tab${selectedTab === "submit" ? " active" : ""}`}
        onClick={() => onSelectTab("submit")}
      >
        Submit Result
      </button>
    </div>
  );
};

export default TestCaseTabs;
