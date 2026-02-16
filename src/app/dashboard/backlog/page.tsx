"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useBacklogData } from "@/lib/hooks/use-dashboard-data";
import { HealthGauge } from "../components/health-gauge";

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

// Tooltips for each KPI dimension
const DIMENSION_TOOLTIPS: Record<string, string> = {
  "Estimation Coverage": "Percentage of backlog items that have story point estimates. Higher is better - indicates better planning and predictability.",
  "Freshness": "How recently backlog items have been updated. Items not touched in 60+ days are considered stale and may need review.",
  "Activity": "Tracks items with no status changes in 90+ days (zombies). Active grooming keeps this metric healthy.",
  "Priority Distribution": "Balance of priority levels. Too many high-priority items (priority inflation) indicates poor prioritization.",
  "Size Distribution": "Mix of small, medium, and large items. Healthy backlogs have a variety of sizes for sprint flexibility.",
};

function BacklogContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board") || undefined;
  const { data, error, isLoading } = useBacklogData(boardId);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || data?.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800">
          Failed to load backlog data
        </h2>
        <p className="mt-1 text-sm text-red-600">
          {data?.error || "Unable to fetch backlog. Check your environment variables."}
        </p>
      </div>
    );
  }

  const dimensions: Dimension[] = data?.dimensions || [];
  const alerts: Alert[] = data?.alerts || [];
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Backlog Health</h1>
        <div className="text-xs text-gray-400">
          Last updated:{" "}
          {data?.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "—"}
        </div>
      </div>

      {/* Health Score + Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex items-center justify-center">
          <HealthGauge score={data?.healthScore ?? 0} size="lg" />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <StatBox
            label="Total Items"
            value={stats?.totalItems ?? 0}
          />
          <StatBox
            label="Estimated"
            value={stats?.estimatedItems ?? 0}
            total={stats?.totalItems}
          />
          <StatBox
            label="Stale Items"
            value={stats?.staleItems ?? 0}
            variant={stats?.staleItems > 0 ? "warning" : "default"}
          />
          <StatBox
            label="Zombie Issues"
            value={stats?.zombieItems ?? 0}
            variant={stats?.zombieItems > 0 ? "danger" : "default"}
          />
        </div>
      </div>

      {/* Dimensions Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Health Dimensions
        </h2>
        <div className="space-y-4">
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-800">
            Alerts
          </h2>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3">
                <AlertIcon type={alert.type} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {alert.message}
                  </p>
                  {alert.issues.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {alert.issues.slice(0, 10).join(", ")}
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
  variant = "default",
}: {
  label: string;
  value: number;
  total?: number;
  variant?: "default" | "warning" | "danger";
}) {
  const borderColor =
    variant === "danger"
      ? "border-red-200"
      : variant === "warning"
        ? "border-amber-200"
        : "border-gray-200";

  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm ${borderColor}`}
    >
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-gray-400">
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
  const barColor =
    dimension.score > 70
      ? "bg-green-500"
      : dimension.score > 40
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">
            {dimension.name}{" "}
            <span className="text-xs text-gray-400">
              ({Math.round(dimension.weight * 100)}% weight)
            </span>
          </span>
          {tooltip && (
            <div className="relative inline-block">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 hover:bg-gray-300"
                aria-label="More information"
              >
                ?
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-6 z-10 w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <span className="font-mono font-bold text-gray-900">
          {dimension.score}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${dimension.score}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500">{dimension.detail}</div>
    </div>
  );
}

function AlertIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    stale: "text-amber-600",
    zombie: "text-red-600",
    unestimated: "text-blue-600",
    priority_inflation: "text-purple-600",
  };

  const icons: Record<string, string> = {
    stale: "!",
    zombie: "Z",
    unestimated: "?",
    priority_inflation: "P",
  };

  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold ${colors[type] || "text-gray-600"} shadow-sm ring-1 ring-gray-200`}
    >
      {icons[type] || "!"}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex justify-center">
          <div className="h-32 w-32 rounded-xl bg-gray-200" />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
      <div className="h-64 rounded-lg bg-gray-200" />
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
