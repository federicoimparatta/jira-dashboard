"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BurndownChartProps {
  data: { date: string; ideal: number; actual: number }[];
}

export function BurndownChart({ data }: BurndownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        No burndown data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="ideal"
          stroke="#94a3b8"
          strokeDasharray="5 5"
          dot={false}
          name="Ideal"
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Actual"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
