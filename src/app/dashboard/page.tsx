"use client";

import { useSprintData } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "./components/stat-card";
import { ProgressBar } from "./components/progress-bar";
import { BurndownChart } from "./components/burndown-chart";

export default function DashboardPage() {
  const { data, error, isLoading } = useSprintData();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || data?.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800">
          Failed to load sprint data
        </h2>
        <p className="mt-1 text-sm text-red-600">
          {data?.error || "Unable to connect to Jira API. Check your environment variables."}
        </p>
      </div>
    );
  }

  const sprint = data?.sprint;
  const progress = data?.progress;
  const burndown = data?.burndown || [];
  const blockers = data?.blockers || [];
  const wipPerAssignee = data?.wipPerAssignee || {};
  const issueCount = data?.issueCount;

  return (
    <div className="space-y-6">
      {/* Sprint Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {sprint?.name || "Sprint Dashboard"}
          </h1>
          {sprint?.startDate && sprint?.endDate && (
            <p className="text-sm text-gray-500">
              {new Date(sprint.startDate).toLocaleDateString()} —{" "}
              {new Date(sprint.endDate).toLocaleDateString()}
              {sprint.goal && ` | Goal: ${sprint.goal}`}
            </p>
          )}
        </div>
        <div className="text-xs text-gray-400">
          Last updated: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : "—"}
        </div>
      </div>

      {/* Sprint Progress */}
      {progress && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Sprint Progress
          </h2>
          <ProgressBar
            done={progress.completedPoints}
            inProgress={progress.inProgressPoints}
            todo={progress.todoPoints}
            total={progress.totalPoints}
          />
          <div className="mt-2 text-right text-sm text-gray-600">
            {Math.round(progress.completionRate * 100)}% complete by points
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Velocity"
          value={progress?.completedPoints ?? "—"}
          subtitle={`of ${progress?.totalPoints ?? 0} committed`}
        />
        <StatCard
          title="Cycle Time"
          value={data?.cycleTime != null ? `${data.cycleTime.toFixed(1)}d` : "—"}
          subtitle="avg (In Progress → Done)"
        />
        <StatCard
          title="Lead Time"
          value={data?.leadTime != null ? `${data.leadTime.toFixed(1)}d` : "—"}
          subtitle="avg (Created → Done)"
        />
        <StatCard
          title="Issues"
          value={issueCount?.total ?? "—"}
          subtitle={`${issueCount?.done ?? 0} done, ${issueCount?.inProgress ?? 0} in progress`}
        />
      </div>

      {/* Burndown Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Sprint Burndown
        </h2>
        <BurndownChart data={burndown} />
      </div>

      {/* Two-column: Blockers + WIP */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Blockers */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Blockers
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                blockers.length > 0
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {blockers.length}
            </span>
          </div>
          {blockers.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">
              No blocked issues
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {blockers.map(
                (b: { key: string; summary: string; assignee: string; status: string }) => (
                  <li
                    key={b.key}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <div>
                      <span className="font-medium text-gray-900">
                        {b.key}
                      </span>{" "}
                      <span className="text-gray-600">{b.summary}</span>
                      <div className="text-xs text-gray-400">
                        {b.assignee} — {b.status}
                      </div>
                    </div>
                  </li>
                )
              )}
            </ul>
          )}
        </div>

        {/* WIP per Assignee */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              WIP per Assignee
            </h2>
            {data?.unassignedCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {data.unassignedCount} unassigned
              </span>
            )}
          </div>
          {Object.keys(wipPerAssignee).length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">
              No in-progress issues
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {Object.entries(
                wipPerAssignee as Record<string, { count: number; points: number }>
              ).map(([name, wip]) => (
                <li
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-700">{name}</span>
                  <span
                    className={`font-mono font-medium ${
                      wip.count > 3
                        ? "text-red-600"
                        : "text-gray-900"
                    }`}
                  >
                    {wip.count} issues ({wip.points} pts)
                    {wip.count > 3 && (
                      <span className="ml-1 text-xs text-red-500">
                        WIP LIMIT
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Scope Change */}
      {data?.scopeChange && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Scope Added"
            value={data.scopeChange.added}
            variant={data.scopeChange.added > 3 ? "warning" : "default"}
          />
          <StatCard
            title="Scope Removed"
            value={data.scopeChange.removed}
          />
          <StatCard
            title="Net Scope Change"
            value={data.scopeChange.net}
            variant={data.scopeChange.net > 5 ? "danger" : "default"}
          />
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="h-24 rounded-lg bg-gray-200" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-gray-200" />
    </div>
  );
}
