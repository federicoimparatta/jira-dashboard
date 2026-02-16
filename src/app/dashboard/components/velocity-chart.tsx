"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface VelocityChartProps {
  data: {
    sprintName: string;
    committed: number;
    completed: number;
  }[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-smg-gray-300">
        No velocity data available yet. Velocity history is populated when sprints close.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAF0F6" />
        <XAxis
          dataKey="sprintName"
          tick={{ fontSize: 11, fill: "#6B7D8D" }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={60}
          axisLine={{ stroke: "#D3DCE6" }}
          tickLine={{ stroke: "#D3DCE6" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6B7D8D" }}
          axisLine={{ stroke: "#D3DCE6" }}
          tickLine={{ stroke: "#D3DCE6" }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #EAF0F6",
            boxShadow: "4px 4px 24px rgba(102,102,102,0.06)",
            fontSize: "13px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#6B7D8D" }}
        />
        <Bar
          dataKey="committed"
          fill="#B0BEC5"
          name="Committed"
          radius={[6, 6, 0, 0]}
        />
        <Bar
          dataKey="completed"
          fill="#0976D6"
          name="Completed"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
