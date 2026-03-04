"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OverviewBacklogResponse, BoardBacklogSummary } from "@/lib/jira/types";
import { HealthGauge } from "./health-gauge";
import { JiraLink } from "./jira-link";

function BoardHealthCard({ board }: { board: BoardBacklogSummary }) {
  const pathname = usePathname();
  const score = board.healthScore;
  const alertCount = board.alerts.length;

  return (
    <div className="dash-card relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-dash-blue to-dash-blue-light" />
      <div className="flex items-center justify-between mb-3">
        <Link
          href={`${pathname}?board=${board.boardId}`}
          className="text-xs font-semibold uppercase tracking-wider text-dash-blue hover:underline"
        >
          {board.boardName}
        </Link>
        {alertCount > 0 && (
          <span className="rounded-full bg-dash-warning/10 px-2 py-0.5 text-[11px] font-bold text-dash-warning">
            {alertCount} alert{alertCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <HealthGauge score={score} size="sm" />
        <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-dash-gray-500">Total</span>
            <div className="font-semibold text-dash-gray-900">{board.stats.totalItems}</div>
          </div>
          <div>
            <span className="text-dash-gray-500">Ready</span>
            <div className="font-semibold text-dash-gray-900">
              {board.stats.readyItems}
              <span className="text-dash-gray-400">/{board.stats.totalItems}</span>
            </div>
          </div>
          <div>
            <span className="text-dash-gray-500">Blocked</span>
            <div className={`font-semibold ${board.stats.blockedItems > 0 ? "text-dash-danger" : "text-dash-gray-900"}`}>
              {board.stats.blockedItems}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BacklogOverview({ data }: { data: OverviewBacklogResponse }) {
  const { boards, aggregate, jiraBaseUrl } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dash-gray-900">Backlog Health</h1>
          <p className="mt-1 text-sm text-dash-gray-500">
            Across {boards.length} board{boards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-full bg-dash-gray-100 px-3 py-1 text-xs font-medium text-dash-gray-500">
          Updated{" "}
          {data.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "—"}
        </div>
      </div>

      {/* Per-board health cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {boards.map((board) => (
          <BoardHealthCard key={board.boardId} board={board} />
        ))}
      </div>

      {/* Aggregate health score + stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="dash-card flex flex-col items-center justify-center p-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-dash-gray-500 mb-3">
            Overall Health
          </div>
          <HealthGauge score={aggregate.healthScore} size="lg" />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <StatBox label="Total Items" value={aggregate.totalItems} />
          <StatBox
            label="Ready Items"
            value={aggregate.readyItems}
            total={aggregate.totalItems}
          />
          <StatBox
            label="Blocked Items"
            value={aggregate.blockedItems}
            variant={aggregate.blockedItems > 0 ? "danger" : "default"}
          />
        </div>
      </div>

      {/* Aggregate dimensions */}
      <div className="dash-card p-6">
        <h2 className="dash-section-label mb-5">Health Dimensions</h2>
        <div className="space-y-5">
          {aggregate.dimensions.map((dim) => (
            <DimensionBar key={dim.name} dimension={dim} />
          ))}
        </div>
      </div>

      {/* Aggregate alerts */}
      {aggregate.alerts.length > 0 && (
        <div
          className="dash-card border-dash-warning/20 p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(232,163,23,0.04), rgba(232,163,23,0.02))",
          }}
        >
          <h2 className="dash-section-label mb-4 text-dash-warning">Alerts</h2>
          <div className="space-y-3">
            {aggregate.alerts.map((alert, i) => (
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
                            jiraBaseUrl={jiraBaseUrl}
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
      <div className="text-xs font-semibold uppercase tracking-wider text-dash-gray-500">
        {label}
      </div>
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

function DimensionBar({ dimension }: { dimension: { name: string; weight: number; score: number; detail: string } }) {
  const barGradient =
    dimension.score > 70
      ? "from-dash-teal to-emerald-400"
      : dimension.score > 40
        ? "from-dash-warning to-amber-400"
        : "from-dash-danger to-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-dash-gray-700">
          {dimension.name}{" "}
          <span className="text-xs text-dash-gray-300">
            ({Math.round(dimension.weight * 100)}% weight)
          </span>
        </span>
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
