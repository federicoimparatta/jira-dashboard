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
      <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-smg-danger">
          Failed to load backlog data
        </h2>
        <p className="mt-1 text-sm text-smg-danger/70">
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
        <h1 className="text-2xl font-bold text-smg-gray-900">Backlog Health</h1>
        <div className="rounded-full bg-smg-gray-100 px-3 py-1 text-xs font-medium text-smg-gray-500">
          Updated{" "}
          {data?.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "—"}
        </div>
      </div>

      {/* Health Score + Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="smg-card flex items-center justify-center p-8">
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
      <div className="smg-card p-6">
        <h2 className="smg-section-label mb-5">Health Dimensions</h2>
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
        <div className="smg-card border-smg-warning/20 p-6" style={{ background: "linear-gradient(135deg, rgba(232,163,23,0.04), rgba(232,163,23,0.02))" }}>
          <h2 className="smg-section-label mb-4 text-smg-warning">Alerts</h2>
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-3">
                <AlertIcon type={alert.type} />
                <div>
                  <p className="text-sm font-medium text-smg-gray-900">
                    {alert.message}
                  </p>
                  {alert.issues.length > 0 && (
                    <p className="mt-1 text-xs text-smg-gray-500">
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
  const accentColor =
    variant === "danger"
      ? "from-smg-danger to-rose-400"
      : variant === "warning"
        ? "from-smg-warning to-amber-400"
        : "from-smg-blue to-smg-blue-light";

  return (
    <div className="smg-card relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${accentColor}`} />
      <div className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-smg-gray-900">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-smg-gray-300">
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
      ? "from-smg-teal to-emerald-400"
      : dimension.score > 40
        ? "from-smg-warning to-amber-400"
        : "from-smg-danger to-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-smg-gray-700">
            {dimension.name}{" "}
            <span className="text-xs text-smg-gray-300">
              ({Math.round(dimension.weight * 100)}% weight)
            </span>
          </span>
          {tooltip && (
            <div className="relative inline-block">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-smg-blue/10 text-[10px] font-bold text-smg-blue transition-colors hover:bg-smg-blue/20"
                aria-label="More information"
              >
                ?
              </button>
              {showTooltip && (
                <div className="smg-tooltip absolute left-0 top-6 z-10 w-64 p-3">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <span className="font-mono text-sm font-bold text-smg-gray-900">
          {dimension.score}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-smg-gray-100">
        <div
          className={`h-full rounded-full bg-linear-to-r transition-all duration-700 ease-out ${barGradient}`}
          style={{ width: `${dimension.score}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-smg-gray-500">{dimension.detail}</div>
    </div>
  );
}

function AlertIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    stale: "text-smg-warning bg-smg-warning/10",
    zombie: "text-smg-danger bg-smg-danger/10",
    unestimated: "text-smg-blue bg-smg-blue/10",
    priority_inflation: "text-smg-purple bg-smg-purple/10",
  };

  const icons: Record<string, string> = {
    stale: "!",
    zombie: "Z",
    unestimated: "?",
    priority_inflation: "P",
  };

  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colors[type] || "text-smg-gray-500 bg-smg-gray-100"}`}
    >
      {icons[type] || "!"}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="smg-skeleton h-8 w-48" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex justify-center">
          <div className="smg-skeleton h-32 w-32 rounded-full" />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="smg-skeleton h-20" />
          ))}
        </div>
      </div>
      <div className="smg-skeleton h-64" />
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
