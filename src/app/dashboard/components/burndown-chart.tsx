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
      <div className="flex h-64 items-center justify-center text-smg-gray-300">
        No burndown data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAF0F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#6B7D8D" }}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
          axisLine={{ stroke: "#D3DCE6" }}
          tickLine={{ stroke: "#D3DCE6" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6B7D8D" }}
          axisLine={{ stroke: "#D3DCE6" }}
          tickLine={{ stroke: "#D3DCE6" }}
        />
        <Tooltip
          labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
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
        <Line
          type="monotone"
          dataKey="ideal"
          stroke="#B0BEC5"
          strokeDasharray="5 5"
          dot={false}
          name="Ideal"
        />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#0976D6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#0976D6", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#0976D6", stroke: "#fff", strokeWidth: 2 }}
          name="Actual"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
