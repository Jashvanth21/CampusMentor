import { memo } from "react";

const ICONS = {
  overall: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18.5h14M7.5 15l3-3 2.5 2.5L17 10" />
      <path d="M17 10h-3m3 0v3" />
    </svg>
  ),
  coding: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 8-4 4 4 4M15 8l4 4-4 4M13 6l-2 12" />
    </svg>
  ),
  tests: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5h8M8 12h8M8 17.5h5" />
      <path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  sincerity: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-6.5-3.8-6.5-9.1A3.9 3.9 0 0 1 9.4 7a4.1 4.1 0 0 1 2.6.9 4.1 4.1 0 0 1 2.6-.9 3.9 3.9 0 0 1 3.9 3.9C18.5 16.2 12 20 12 20Z" />
    </svg>
  ),
  cgpa: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5.5 18.5 9v6L12 18.5 5.5 15V9Z" />
      <path d="M12 5.5V12l6.5 3" />
    </svg>
  )
};

const StudentStatCard = ({ title, value, accent = "overall", helper }) => {
  return (
    <article className={`student-stat-card accent-${accent}`}>
      <div className="student-stat-card__icon">{ICONS[accent] || ICONS.overall}</div>
      <div className="student-stat-card__content">
        <p className="student-stat-card__title">{title}</p>
        <strong className="student-stat-card__value">{value}</strong>
        {helper ? <span className="student-stat-card__helper">{helper}</span> : null}
      </div>
    </article>
  );
};

export default memo(StudentStatCard);
