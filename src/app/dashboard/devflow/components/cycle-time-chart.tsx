"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { GitHubPR } from "@/lib/github/types";

interface CycleTimeChartProps {
  prs: GitHubPR[];
}

interface Bucket {
  label: string;
  count: number;
}

function buildBuckets(prs: GitHubPR[]): Bucket[] {
  const buckets: Bucket[] = [
    { label: "<1d", count: 0 },
    { label: "1-2d", count: 0 },
    { label: "2-3d", count: 0 },
    { label: "3-5d", count: 0 },
    { label: "5-7d", count: 0 },
    { label: ">7d", count: 0 },
  ];

  for (const pr of prs) {
    if (pr.state !== "merged" || !pr.mergedAt) continue;

    const hours =
      (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()) /
      (1000 * 60 * 60);
    const days = hours / 24;

    if (days < 1) buckets[0].count++;
    else if (days < 2) buckets[1].count++;
    else if (days < 3) buckets[2].count++;
    else if (days < 5) buckets[3].count++;
    else if (days < 7) buckets[4].count++;
    else buckets[5].count++;
  }

  return buckets;
}

export function CycleTimeChart({ prs }: CycleTimeChartProps) {
  const mergedPrs = prs.filter((p) => p.state === "merged" && p.mergedAt);
  const data = buildBuckets(mergedPrs);

  if (mergedPrs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-smg-gray-400">
        No merged PRs to display
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={{ stroke: "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: "12px",
          }}
          formatter={(value) => [value, "PRs"]}
        />
        <Bar
          dataKey="count"
          fill="#2563eb"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
