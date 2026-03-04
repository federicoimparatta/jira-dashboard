"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SprintPoint {
  sprintName: string;
  completedPoints: number;
  boardName: string;
  sprintEndDate: string;
}

interface VelocityTrendChartProps {
  data: SprintPoint[];
  avgVelocity: number;
}

export function VelocityTrendChart({ data, avgVelocity }: VelocityTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-dash-gray-300">
        No velocity data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: truncateName(d.sprintName),
    fullName: d.sprintName,
    velocity: d.completedPoints,
    average: avgVelocity,
    board: d.boardName,
    date: d.sprintEndDate,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAF0F6" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#6B7D8D" }}
          axisLine={{ stroke: "#D3DCE6" }}
          tickLine={{ stroke: "#D3DCE6" }}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6B7D8D" }}
          axisLine={{ stroke: "#D3DCE6" }}
          tickLine={{ stroke: "#D3DCE6" }}
          label={{
            value: "Story Points",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 11, fill: "#6B7D8D" },
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return (
              <div className="rounded-xl border border-dash-gray-100 bg-white px-4 py-3 shadow-lg">
                <p className="text-sm font-semibold text-dash-gray-900">{d.fullName}</p>
                <p className="text-xs text-dash-gray-500">{d.board}</p>
                <p className="mt-1 text-xs text-dash-gray-500">
                  {d.date ? new Date(d.date).toLocaleDateString() : ""}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-dash-blue mr-1.5" />
                    Velocity: <span className="font-semibold">{d.velocity} pts</span>
                  </p>
                  <p className="text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-dash-gray-300 mr-1.5" />
                    Average: <span className="font-semibold">{d.average} pts</span>
                  </p>
                </div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#6B7D8D" }} />
        <Bar
          dataKey="velocity"
          fill="#0976D6"
          radius={[6, 6, 0, 0]}
          name="Velocity (completed pts)"
          barSize={32}
        />
        <Line
          type="monotone"
          dataKey="average"
          stroke="#B0BEC5"
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
          name="Average"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function truncateName(name: string): string {
  if (name.length <= 18) return name;
  return name.slice(0, 16) + "...";
}
