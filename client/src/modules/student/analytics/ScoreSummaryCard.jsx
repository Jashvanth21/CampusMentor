const ScoreSummaryCard = ({ attempts }) => {
  const safeAttempts = Array.isArray(attempts) ? attempts : [];
  const totalAttempts = safeAttempts.length;
  const scores = safeAttempts.map((attempt) => Number(attempt.score) || 0);

  const averageScore =
    totalAttempts > 0 ? scores.reduce((sum, score) => sum + score, 0) / totalAttempts : 0;
  const latestScore = totalAttempts > 0 ? scores[0] : 0;

  return (
    <section className="stats-grid">
      <article className="stat-card">
        <p className="stat-label">Total Attempts</p>
        <p className="stat-value">{totalAttempts}</p>
      </article>
      <article className="stat-card">
        <p className="stat-label">Average Score</p>
        <p className="stat-value">{averageScore.toFixed(2)}%</p>
      </article>
      <article className="stat-card">
        <p className="stat-label">Latest Score</p>
        <p className="stat-value">{latestScore.toFixed(2)}%</p>
      </article>
    </section>
  );
};

export default ScoreSummaryCard;
