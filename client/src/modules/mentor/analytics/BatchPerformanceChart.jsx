import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const BatchPerformanceChart = ({ students }) => {
  const chartData = (Array.isArray(students) ? students : []).map((student) => ({
    name: student.name || "Student",
    averageScore: Number(student.averageScore) || 0
  }));

  return (
    <section className="card">
      <h3>Batch Performance</h3>
      {chartData.length === 0 ? (
        <p className="muted-text">No assigned students.</p>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="averageScore" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};

export default BatchPerformanceChart;
