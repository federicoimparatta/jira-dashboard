"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useBacklogData } from "@/lib/hooks/use-dashboard-data";
import { useStreamingData } from "@/lib/hooks/use-streaming-data";
import { DataLoadingProgress } from "../components/data-loading-progress";
import { HealthGauge } from "../components/health-gauge";
import { JiraLink } from "../components/jira-link";
import { BacklogOverview } from "../components/backlog-overview";

interface Dimension {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  detail: string;
}

interface Alert {
  type: string;
  message: string;
  count: number;
  issues: string[];
}

const DIMENSION_TOOLTIPS: Record<string, string> = {
  "Strategic Allocation":
    "Percentage of story points tied to Initiatives. Higher allocation indicates better strategic alignment.",
  "Backlog Readiness":
    "Items with description, story points, priority, and initiative all populated. Measures sprint-readiness of the backlog.",
  Dependencies:
    "Percentage of backlog items that are blocked (flagged or have blocking issue links). Lower is better.",
  "Avg Blocked Duration":
    "Average time blocked items have been stalled, based on time since last update. Lower is better.",
  "Priority Distribution":
    "Balance of priority levels using Shannon entropy. Alerts if >50% are high priority.",
  "Age Distribution":
    "Percentage of items older than 90 days. Younger backlogs score higher.",
  "Grooming Freshness":
    "Percentage of items updated in the last 45 days. Regular grooming keeps this healthy.",
  "2-Sprint Readiness":
    "Story points in Ready status vs. 2 sprints of velocity. Measures upcoming sprint preparedness.",
};

function BacklogContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board") || undefined;
  const swr = useBacklogData(boardId);
  const streamUrl = boardId
    ? `/api/jira/backlog/stream?board=${boardId}`
    : "/api/jira/backlog/stream";
  const { data, error, isLoading, progress } = useStreamingData({
    swrData: swr.data,
    swrLoading: swr.isLoading,
    swrError: swr.error,
    streamUrl,
  });

  if (isLoading) {
    if (progress) {
      return (
        <DataLoadingProgress
          title="Backlog Health"
          subtitle="Analyzing backlog data from Jira..."
          progress={progress}
        >
          <BacklogSkeleton />
        </DataLoadingProgress>
      );
    }
    return <LoadingSkeleton />;
  }

  if (error || data?.error) {
    return (
      <div className="dash-card border-dash-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-dash-danger">
          Failed to load backlog data
        </h2>
        <p className="mt-1 text-sm text-dash-danger/70">
          {data?.error || "Unable to fetch backlog. Check your environment variables."}
        </p>
      </div>
    );
  }

  // Overview mode: per-board breakdown
  if (data?.mode === "overview") {
    return <BacklogOverview data={data} />;
  }

  const dimensions: Dimension[] = data?.dimensions || [];
  const alerts: Alert[] = data?.alerts || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dash-gray-900">Backlog Health</h1>
        <div className="rounded-full bg-dash-gray-100 px-3 py-1 text-xs font-medium text-dash-gray-500">
          Updated{" "}
          {data?.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "—"}
        </div>
      </div>

      {/* Health Score + Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="dash-card flex items-center justify-center p-8">
          <HealthGauge score={data?.healthScore ?? 0} size="lg" />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <StatBox
            label="Total Items"
            value={stats?.totalItems ?? 0}
          />
          <StatBox
            label="Ready Items"
            value={stats?.readyItems ?? 0}
            total={stats?.totalItems}
          />
          <StatBox
            label="Blocked Items"
            value={stats?.blockedItems ?? 0}
            variant={(stats?.blockedItems ?? 0) > 0 ? "danger" : "default"}
          />
        </div>
      </div>

      {/* Dimensions Breakdown */}
      <div className="dash-card p-6">
        <h2 className="dash-section-label mb-5">Health Dimensions</h2>
        <div className="space-y-5">
          {dimensions.map((dim) => (
            <DimensionBar
              key={dim.name}
              dimension={dim}
              tooltip={DIMENSION_TOOLTIPS[dim.name]}
            />
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="dash-card border-dash-warning/20 p-6" style={{ background: "linear-gradient(135deg, rgba(232,163,23,0.04), rgba(232,163,23,0.02))" }}>
          <h2 className="dash-section-label mb-4 text-dash-warning">Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3">
                <AlertIcon type={alert.type} />
                <div>
                  <p className="text-sm font-medium text-dash-gray-900">
                    {alert.message}
                  </p>
                  {alert.issues.length > 0 && (
                    <p className="mt-1 text-xs text-dash-gray-500">
                      {alert.issues.slice(0, 10).map((key, j) => (
                        <span key={key}>
                          {j > 0 && ", "}
                          <JiraLink
                            issueKey={key}
                            jiraBaseUrl={data?.jiraBaseUrl}
                            className="text-dash-blue"
                          />
                        </span>
                      ))}
                      {alert.issues.length > 10 &&
                        ` +${alert.issues.length - 10} more`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  total,
  suffix,
  variant = "default",
}: {
  label: string;
  value: number;
  total?: number;
  suffix?: string;
  variant?: "default" | "warning" | "danger";
}) {
  const accentColor =
    variant === "danger"
      ? "from-dash-danger to-rose-400"
      : variant === "warning"
        ? "from-dash-warning to-amber-400"
        : "from-dash-blue to-dash-blue-light";

  return (
    <div className="dash-card relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${accentColor}`} />
      <div className="text-xs font-semibold uppercase tracking-wider text-dash-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-dash-gray-900">
        {value}{suffix}
        {total !== undefined && (
          <span className="text-sm font-normal text-dash-gray-300">
            {" "}
            / {total}
          </span>
        )}
      </div>
    </div>
  );
}

function DimensionBar({
  dimension,
  tooltip,
}: {
  dimension: Dimension;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const barGradient =
    dimension.score > 70
      ? "from-dash-teal to-emerald-400"
      : dimension.score > 40
        ? "from-dash-warning to-amber-400"
        : "from-dash-danger to-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-dash-gray-700">
            {dimension.name}{" "}
            <span className="text-xs text-dash-gray-300">
              ({Math.round(dimension.weight * 100)}% weight)
            </span>
          </span>
          {tooltip && (
            <div className="relative inline-block">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-dash-blue/10 text-[10px] font-bold text-dash-blue transition-colors hover:bg-dash-blue/20"
                aria-label="More information"
              >
                ?
              </button>
              {showTooltip && (
                <div className="dash-tooltip absolute left-0 top-6 z-10 w-64 p-3">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <span className="font-mono text-sm font-bold text-dash-gray-900">
          {dimension.score}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-dash-gray-100">
        <div
          className={`h-full rounded-full bg-linear-to-r transition-all duration-700 ease-out ${barGradient}`}
          style={{ width: `${dimension.score}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-dash-gray-500">{dimension.detail}</div>
    </div>
  );
}

function AlertIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    stale: "text-dash-warning bg-dash-warning/10",
    zombie: "text-dash-danger bg-dash-danger/10",
    unestimated: "text-dash-blue bg-dash-blue/10",
    priority_inflation: "text-dash-purple bg-dash-purple/10",
    blocked: "text-dash-danger bg-dash-danger/10",
    low_readiness: "text-dash-warning bg-dash-warning/10",
    low_sprint_coverage: "text-dash-warning bg-dash-warning/10",
  };

  const icons: Record<string, string> = {
    stale: "!",
    zombie: "Z",
    unestimated: "?",
    priority_inflation: "P",
    blocked: "B",
    low_readiness: "R",
    low_sprint_coverage: "S",
  };

  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colors[type] || "text-dash-gray-500 bg-dash-gray-100"}`}
    >
      {icons[type] || "!"}
    </span>
  );
}

function BacklogSkeleton() {
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex justify-center">
          <div className="dash-skeleton h-32 w-32 rounded-full" />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="dash-skeleton h-20" />
          ))}
        </div>
      </div>
      <div className="dash-skeleton h-64" />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-skeleton h-8 w-48" />
      <BacklogSkeleton />
    </div>
  );
}

export default function BacklogPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <BacklogContent />
    </Suspense>
  );
}
