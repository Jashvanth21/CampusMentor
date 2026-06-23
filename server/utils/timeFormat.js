const formatDecimal = (value) => {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const pluralize = (value, singular, plural) => (Number(value) === 1 ? singular : plural);

const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || seconds === "") {
    return "N/A";
  }

  const numericSeconds = Number(seconds);
  if (!Number.isFinite(numericSeconds) || numericSeconds < 0) {
    return "N/A";
  }

  if (numericSeconds < 60) {
    const roundedSeconds = Math.round(numericSeconds);
    return `${roundedSeconds} ${pluralize(roundedSeconds, "second", "seconds")}`;
  }

  const minutes = numericSeconds / 60;
  if (minutes < 60) {
    const formattedMinutes = formatDecimal(minutes);
    return `${formattedMinutes} ${pluralize(Number(formattedMinutes), "minute", "minutes")}`;
  }

  const formattedHours = formatDecimal(minutes / 60);
  return `${formattedHours} ${pluralize(Number(formattedHours), "hour", "hours")}`;
};

module.exports = {
  formatDuration
};
