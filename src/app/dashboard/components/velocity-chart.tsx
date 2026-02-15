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
      <div className="flex h-64 items-center justify-center text-gray-400">
        No velocity data available yet. Velocity history is populated when sprints close.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="sprintName"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="committed"
          fill="#94a3b8"
          name="Committed"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="completed"
          fill="#3b82f6"
          name="Completed"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
