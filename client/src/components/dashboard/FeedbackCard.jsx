import { memo } from "react";

const formatFeedbackDate = (value) => {
  if (!value) {
    return "Recent";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recent";
  }

  return parsed.toLocaleDateString();
};

const FeedbackCard = ({ feedback }) => {
  const weakAreas = Array.isArray(feedback?.weakAreas) ? feedback.weakAreas.slice(0, 2) : [];
  const primaryWeakArea = weakAreas[0] || "Not specified";
  const focusArea = feedback?.focusArea || "Not specified";
  const sincerityScore =
    feedback?.sincerityScore === null || feedback?.sincerityScore === undefined
      ? "-"
      : `${feedback.sincerityScore}/10`;

  return (
    <article className="feedback-carousel-card">
      <div className="feedback-carousel-card__head">
        <div>
          <p className="feedback-carousel-card__mentor">{feedback?.mentorName || "Mentor"}</p>
          <span className="feedback-carousel-card__date">{formatFeedbackDate(feedback?.createdAt)}</span>
        </div>
        <div className="feedback-carousel-card__avatar" aria-hidden="true">
          {(feedback?.mentorName || "M").trim().charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="feedback-carousel-card__details">
        <p className="feedback-carousel-card__detail">
          <strong>Weak Area:</strong> <span>{primaryWeakArea}</span>
        </p>
        <p className="feedback-carousel-card__detail">
          <strong>Focus Area:</strong> <span>{focusArea}</span>
        </p>
        <p className="feedback-carousel-card__detail">
          <strong>Sincerity Score:</strong> <span>{sincerityScore}</span>
        </p>
      </div>

      <p className="feedback-carousel-card__comment" title={feedback?.comment || "No comment provided."}>
        {feedback?.comment || "No mentor comment added yet."}
      </p>
    </article>
  );
};

export default memo(FeedbackCard);
