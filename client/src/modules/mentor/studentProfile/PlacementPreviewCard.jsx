const getPlacementReadiness = (summary) => {
  const averageScore = Number(summary?.averageScore) || 0;
  const codingAverage = Number(summary?.codingAverage) || 0;
  const attempts = Number(summary?.totalAttempts) || 0;

  // Derived readiness rule from available performance metrics only.
  if (averageScore >= 70 && codingAverage >= 60 && attempts >= 3) {
    return {
      label: "Likely Eligible",
      className: "risk-safe",
      message: "Student is showing consistent performance for placement eligibility."
    };
  }

  if (averageScore >= 55 && averageScore <= 69) {
    return {
      label: "Borderline",
      className: "risk-medium",
      message: "Student is close to readiness but needs stronger consistency."
    };
  }

  return {
    label: "Not Ready",
    className: "risk-high",
    message: "Student needs focused improvement before placement readiness."
  };
};

const PlacementPreviewCard = ({ summary }) => {
  const readiness = getPlacementReadiness(summary);

  return (
    <section className="card">
      <h3>Placement Preview</h3>
      <p>
        <span className={`mentor-risk-badge ${readiness.className}`}>{readiness.label}</span>
      </p>
      <p className="muted-text">{readiness.message}</p>
    </section>
  );
};

export default PlacementPreviewCard;
