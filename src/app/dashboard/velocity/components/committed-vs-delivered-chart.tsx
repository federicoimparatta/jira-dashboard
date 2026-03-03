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
  ReferenceLine,
} from "recharts";

interface SprintPoint {
  sprintName: string;
  committedPoints: number;
  completedPoints: number;
  boardName: string;
  sprintEndDate: string;
  scopeAdded: number;
}

interface CommittedVsDeliveredChartProps {
  data: SprintPoint[];
}

export function CommittedVsDeliveredChart({ data }: CommittedVsDeliveredChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-smg-gray-300">
        No sprint data available
      </div>
    );
  }

  const chartData = data.map((d) => {
    const deliveryRate = d.committedPoints > 0
      ? Math.round((d.completedPoints / d.committedPoints) * 100)
      : 0;
    return {
      name: truncateName(d.sprintName),
      fullName: d.sprintName,
      committed: d.committedPoints,
      delivered: d.completedPoints,
      gap: Math.max(0, d.committedPoints - d.completedPoints),
      deliveryRate,
      board: d.boardName,
      date: d.sprintEndDate,
      scopeAdded: d.scopeAdded,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
              <div className="rounded-xl border border-smg-gray-100 bg-white px-4 py-3 shadow-lg">
                <p className="text-sm font-semibold text-smg-gray-900">{d.fullName}</p>
                <p className="text-xs text-smg-gray-500">{d.board}</p>
                <p className="mt-1 text-xs text-smg-gray-500">
                  {d.date ? new Date(d.date).toLocaleDateString() : ""}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-smg-gray-300 mr-1.5" />
                    Committed: <span className="font-semibold">{d.committed} pts</span>
                  </p>
                  <p className="text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-smg-teal mr-1.5" />
                    Delivered: <span className="font-semibold">{d.delivered} pts</span>
                  </p>
                  <p className="text-sm">
                    Delivery rate:{" "}
                    <span className={`font-semibold ${d.deliveryRate >= 80 ? "text-smg-teal" : d.deliveryRate >= 60 ? "text-smg-warning" : "text-smg-danger"}`}>
                      {d.deliveryRate}%
                    </span>
                  </p>
                  {d.scopeAdded > 0 && (
                    <p className="text-xs text-smg-warning">
                      +{d.scopeAdded} issues added mid-sprint
                    </p>
                  )}
                </div>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#6B7D8D" }} />
        <ReferenceLine y={0} stroke="#D3DCE6" />
        <Bar
          dataKey="committed"
          fill="#B0BEC5"
          radius={[6, 6, 0, 0]}
          name="Committed"
          barSize={24}
        />
        <Bar
          dataKey="delivered"
          fill="#129E8F"
          radius={[6, 6, 0, 0]}
          name="Delivered"
          barSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function truncateName(name: string): string {
  if (name.length <= 18) return name;
  return name.slice(0, 16) + "...";
}
