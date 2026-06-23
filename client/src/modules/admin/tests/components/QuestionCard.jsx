import { useState } from "react";

const QuestionCard = ({ title, subtitle, children, onRemove }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <article className="question-card admin-question-card">
      <header className="admin-question-header">
        <div>
          <h4>{title}</h4>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="admin-question-actions">
          <button type="button" className="topbar-logout" onClick={() => setCollapsed((prev) => !prev)}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button type="button" className="topbar-logout" onClick={onRemove}>
            Remove
          </button>
        </div>
      </header>
      {!collapsed ? <div>{children}</div> : null}
    </article>
  );
};

export default QuestionCard;
