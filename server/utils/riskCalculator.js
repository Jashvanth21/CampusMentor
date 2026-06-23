const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateRisk = (student) => {
  const avg = toNumber(student?.averageScore ?? student?.overallAverage);
  const coding = toNumber(student?.codingAverage);
  const sincerity = toNumber(student?.sincerityScore);

  if (avg < 50) return true;
  if (sincerity < 40) return true;
  if (coding < 30) return true;

  return false;
};

module.exports = calculateRisk;
