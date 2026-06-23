import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const StudentTrendChart = ({ attempts }) => {
  const chartData = (Array.isArray(attempts) ? attempts : []).map((attempt) => ({
    date: attempt.date.toISOString().slice(0, 10),
    avgScore: Number(attempt.avgScore)
  }));

  return (
    <section className="card">
      <h3>Student Trend</h3>
      {chartData.length === 0 ? (
        <p className="muted-text">No data available</p>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="avgScore" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export default StudentTrendChart;
