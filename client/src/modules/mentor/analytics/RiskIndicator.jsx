export const getRiskLevel = (student) => {
  const status = String(student?.status || "").trim();
  if (status === "At Risk") {
    return { label: "Attention Needed", className: "risk-high" };
  }

  return { label: "Safe", className: "risk-safe" };
};

const RiskIndicator = ({ student }) => {
  const risk = getRiskLevel(student);

  return <span className={`mentor-risk-badge ${risk.className}`}>{risk.label}</span>;
};

export default RiskIndicator;
