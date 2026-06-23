import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const PerformanceTrend = ({ attempts }) => {
  const chartData = (Array.isArray(attempts) ? [...attempts] : [])
    .sort((a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime())
    .map((attempt) => ({
      date: attempt.attemptedAt.toISOString().slice(0, 10),
      score: Number(attempt.score) || 0
    }));

  return (
    <section className="card">
      <h3>Performance Trend</h3>
      {chartData.length === 0 ? (
        <p className="muted-text">No attempts yet.</p>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export default PerformanceTrend;
