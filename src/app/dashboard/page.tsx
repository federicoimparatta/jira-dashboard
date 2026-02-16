"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSprintData } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "./components/stat-card";
import { ProgressBar } from "./components/progress-bar";
import { BurndownChart } from "./components/burndown-chart";
import { JiraLink } from "./components/jira-link";

function DashboardContent() {
  const searchParams = useSearchParams();
  const boardId = searchParams.get("board") || undefined;
  const { data, error, isLoading } = useSprintData(boardId);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || data?.error) {
    return (
      <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-smg-danger">
          Failed to load sprint data
        </h2>
        <p className="mt-1 text-sm text-smg-danger/70">
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
          <h1 className="text-2xl font-bold text-smg-gray-900">
            {sprint?.name || "Sprint Dashboard"}
          </h1>
          {sprint?.startDate && sprint?.endDate && (
            <p className="mt-1 text-sm text-smg-gray-500">
              {new Date(sprint.startDate).toLocaleDateString()} —{" "}
              {new Date(sprint.endDate).toLocaleDateString()}
              {sprint.goal && (
                <span className="ml-2 text-smg-blue">
                  Goal: {sprint.goal}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="rounded-full bg-smg-gray-100 px-3 py-1 text-xs font-medium text-smg-gray-500">
          Updated {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : "—"}
        </div>
      </div>

      {/* Sprint Progress */}
      {progress && (
        <div className="smg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="smg-section-label">Sprint Progress</h2>
            <span className="text-sm font-semibold text-smg-blue">
              {Math.round(progress.completionRate * 100)}%
            </span>
          </div>
          <ProgressBar
            done={progress.completedPoints}
            inProgress={progress.inProgressPoints}
            todo={progress.todoPoints}
            total={progress.totalPoints}
          />
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
      <div className="smg-card p-6">
        <h2 className="smg-section-label mb-4">Sprint Burndown</h2>
        <BurndownChart data={burndown} />
      </div>

      {/* Two-column: Blockers + WIP */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Blockers */}
        <div className="smg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="smg-section-label">Blockers</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                blockers.length > 0
                  ? "bg-smg-danger/10 text-smg-danger"
                  : "bg-smg-teal/10 text-smg-teal"
              }`}
            >
              {blockers.length}
            </span>
          </div>
          {blockers.length === 0 ? (
            <p className="mt-4 text-sm text-smg-gray-300">
              No blocked issues
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {blockers.map(
                (b: { key: string; summary: string; assignee: string; status: string }) => (
                  <li
                    key={b.key}
                    className="flex items-start gap-2.5 text-sm"
                  >
                    <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-smg-danger" />
                    <div>
                      <JiraLink
                        issueKey={b.key}
                        jiraBaseUrl={data?.jiraBaseUrl}
                        className="font-semibold text-smg-blue"
                      />{" "}
                      <span className="text-smg-gray-700">{b.summary}</span>
                      <div className="text-xs text-smg-gray-500">
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
        <div className="smg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="smg-section-label">WIP per Assignee</h2>
            {data?.unassignedCount > 0 && (
              <span className="rounded-full bg-smg-warning/10 px-2.5 py-0.5 text-xs font-bold text-smg-warning">
                {data.unassignedCount} unassigned
              </span>
            )}
          </div>
          {Object.keys(wipPerAssignee).length === 0 ? (
            <p className="mt-4 text-sm text-smg-gray-300">
              No in-progress issues
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {Object.entries(
                wipPerAssignee as Record<string, { count: number; points: number }>
              ).map(([name, wip]) => (
                <li
                  key={name}
                  className="flex items-center justify-between rounded-lg bg-smg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-smg-gray-700">{name}</span>
                  <span
                    className={`font-mono font-semibold ${
                      wip.count > 3
                        ? "text-smg-danger"
                        : "text-smg-gray-900"
                    }`}
                  >
                    {wip.count} issues ({wip.points} pts)
                    {wip.count > 3 && (
                      <span className="ml-1.5 rounded-full bg-smg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-smg-danger">
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
    <div className="space-y-6">
      <div className="smg-skeleton h-8 w-48" />
      <div className="smg-skeleton h-24" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="smg-skeleton h-24" />
        ))}
      </div>
      <div className="smg-skeleton h-72" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
