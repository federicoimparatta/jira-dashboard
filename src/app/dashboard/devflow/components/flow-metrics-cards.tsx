"use client";

import { StatCard } from "../../components/stat-card";
import type { DevFlowMetrics } from "@/lib/github/types";

interface FlowMetricsCardsProps {
  metrics: DevFlowMetrics;
}

function formatHoursAsDays(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10}d`;
}

export function FlowMetricsCards({ metrics }: FlowMetricsCardsProps) {
  if (!metrics) return null;
  const cycleTimeDays = (metrics.avgPrCycleTimeHours ?? 0) / 24;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <StatCard
        title="PR Cycle Time"
        value={formatHoursAsDays(metrics.avgPrCycleTimeHours ?? 0)}
        subtitle="Avg open to merged"
        variant={cycleTimeDays > 5 ? "danger" : cycleTimeDays > 2 ? "warning" : "success"}
      />
      <StatCard
        title="Review Wait"
        value={formatHoursAsDays(metrics.avgReviewWaitHours ?? 0)}
        subtitle="Avg to first review"
        variant={
          metrics.avgReviewWaitHours > 24
            ? "danger"
            : metrics.avgReviewWaitHours > 8
              ? "warning"
              : "success"
        }
      />
      <StatCard
        title="Merged PRs"
        value={metrics.mergedPrCount}
        subtitle="This sprint"
        variant="success"
      />
      <StatCard
        title="Open PRs"
        value={metrics.openPrCount}
        subtitle="Awaiting merge"
        variant={metrics.openPrCount > 10 ? "warning" : "default"}
      />
      <StatCard
        title="Bottlenecks"
        value={metrics.bottleneckCount}
        subtitle="Issues flagged"
        variant={
          metrics.bottleneckCount > 5
            ? "danger"
            : metrics.bottleneckCount > 0
              ? "warning"
              : "success"
        }
      />
    </div>
  );
}
