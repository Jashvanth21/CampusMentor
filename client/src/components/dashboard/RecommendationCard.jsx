import { memo } from "react";

const RecommendationCard = ({ index, text }) => {
  return (
    <article className="recommendation-card-v2">
      <div className="recommendation-card-v2__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3.5 14.7 8l5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L5.3 8.7l5-.7Z" />
        </svg>
      </div>
      <div className="recommendation-card-v2__body">
        <span className="recommendation-card-v2__eyebrow">Priority {index + 1}</span>
        <p className="recommendation-card-v2__text">{text}</p>
      </div>
    </article>
  );
};

export default memo(RecommendationCard);
