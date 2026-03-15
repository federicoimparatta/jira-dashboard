"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OverviewSprintResponse, BoardSprintSummary } from "@/lib/jira/types";
import { useGitHubPRStatus } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "./stat-card";
import { ProgressBar } from "./progress-bar";
import { JiraLink } from "./jira-link";
import { GitHubSprintTable } from "./github-sprint-table";
import type { PRStatus } from "@/lib/github/types";

function BoardSprintCard({
  board,
  prStatuses,
  ghConfigured,
}: {
  board: BoardSprintSummary;
  prStatuses: Record<string, PRStatus>;
  ghConfigured: boolean;
}) {
  const { sprint, progress, issueCount, blockers } = board;
  const pathname = usePathname();

  // Compute PR coverage for this board's blockers (issue keys we know)
  // We don't have per-board issue keys in the overview, but we can show
  // aggregate PR coverage if available
  const boardIssueKeys = blockers.map((b) => b.key);
  const prCount = ghConfigured
    ? boardIssueKeys.filter((k) => prStatuses[k]?.hasPR).length
    : 0;

  return (
    <div className="smg-card relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-smg-blue to-smg-blue-light" />
      <div className="flex items-center justify-between mb-3">
        <Link
          href={`${pathname}?board=${board.boardId}`}
          className="text-xs font-semibold uppercase tracking-wider text-smg-blue hover:underline"
        >
          {board.boardName}
        </Link>
        {blockers.length > 0 && (
          <span className="rounded-full bg-smg-danger/10 px-2 py-0.5 text-[11px] font-bold text-smg-danger">
            {blockers.length} blocked
          </span>
        )}
      </div>
      <div className="text-lg font-bold text-smg-gray-900">{sprint.name}</div>
      {sprint.startDate && sprint.endDate && (
        <p className="mt-0.5 text-xs text-smg-gray-500">
          {new Date(sprint.startDate).toLocaleDateString()} —{" "}
          {new Date(sprint.endDate).toLocaleDateString()}
        </p>
      )}
      <div className="mt-3">
        <ProgressBar
          done={progress.completedPoints}
          inProgress={progress.inProgressPoints}
          todo={progress.todoPoints}
          total={progress.totalPoints}
          showLabels={false}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-smg-gray-500">
        <span>
          <span className="font-semibold text-smg-gray-700">
            {Math.round(progress.completionRate * 100)}%
          </span>{" "}
          complete
        </span>
        <span>
          <span className="font-semibold text-smg-gray-700">
            {progress.completedPoints}/{progress.totalPoints}
          </span>{" "}
          pts
        </span>
        <span>
          {issueCount.total} issues
        </span>
      </div>
    </div>
  );
}

export function ProjectOverview({ data }: { data: OverviewSprintResponse }) {
  const { boards, aggregate, blockers, wipPerAssignee, unassignedCount, jiraBaseUrl } = data;
  const issues = data.issues || [];

  // GitHub PR status for all overview issues
  const issueKeys = useMemo(
    () => issues.map((i) => i.key),
    [issues]
  );

  const { data: ghData, isLoading: ghLoading } = useGitHubPRStatus(issueKeys);
  const prStatuses = (ghData?.statuses || {}) as Record<string, PRStatus>;
  const ghConfigured = ghData?.configured !== false;

  // PR coverage stat
  const prCoverage = useMemo(() => {
    if (!ghConfigured || !ghData || issues.length === 0) return null;
    const nonDone = issues.filter((i) => i.statusCategory !== "done");
    const withPR = nonDone.filter((i) => prStatuses[i.key]?.hasPR);
    return { withPR: withPR.length, total: nonDone.length };
  }, [ghData, ghConfigured, issues, prStatuses]);

  const prCoverageVariant = useMemo(() => {
    if (!prCoverage || prCoverage.total === 0) return "default" as const;
    const pct = prCoverage.withPR / prCoverage.total;
    if (pct >= 0.8) return "success" as const;
    if (pct >= 0.5) return "warning" as const;
    return "danger" as const;
  }, [prCoverage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-smg-gray-900">
            Project Overview
          </h1>
          <p className="mt-1 text-sm text-smg-gray-500">
            Across {boards.length} active sprint{boards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-full bg-smg-gray-100 px-3 py-1 text-xs font-medium text-smg-gray-500">
          Updated{" "}
          {data.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "\u2014"}
        </div>
      </div>

      {/* Per-board sprint cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {boards.map((board) => (
          <BoardSprintCard
            key={board.boardId}
            board={board}
            prStatuses={prStatuses}
            ghConfigured={ghConfigured}
          />
        ))}
      </div>

      {/* Aggregate stats */}
      <div className={`grid grid-cols-2 gap-4 ${prCoverage ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <StatCard
          title="Total Issues"
          value={aggregate.totalIssues}
          subtitle={`${aggregate.totalDone} done, ${aggregate.totalInProgress} in progress`}
        />
        <StatCard
          title="Completion"
          value={`${Math.round(aggregate.completionRate * 100)}%`}
          subtitle={`${aggregate.completedPoints} of ${aggregate.totalPoints} pts`}
          variant={
            aggregate.completionRate > 0.6
              ? "success"
              : aggregate.completionRate > 0.3
                ? "default"
                : "warning"
          }
        />
        <StatCard
          title="Cycle Time"
          value={
            aggregate.avgCycleTime != null
              ? `${aggregate.avgCycleTime.toFixed(1)}d`
              : "\u2014"
          }
          subtitle="avg (In Progress -> Done)"
        />
        <StatCard
          title="Lead Time"
          value={
            aggregate.avgLeadTime != null
              ? `${aggregate.avgLeadTime.toFixed(1)}d`
              : "\u2014"
          }
          subtitle="avg (Created -> Done)"
        />
        {prCoverage && (
          <StatCard
            title="PR Coverage"
            value={`${prCoverage.withPR}/${prCoverage.total}`}
            subtitle="non-done issues with PR"
            variant={prCoverageVariant}
          />
        )}
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
              {blockers.map((b) => (
                <li
                  key={b.key}
                  className="flex items-start gap-2.5 text-sm"
                >
                  <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-smg-danger" />
                  <div>
                    <JiraLink
                      issueKey={b.key}
                      jiraBaseUrl={jiraBaseUrl}
                      className="font-semibold text-smg-blue"
                    />{" "}
                    <span className="text-smg-gray-700">{b.summary}</span>
                    <div className="text-xs text-smg-gray-500">
                      {b.assignee} — {b.status}
                      <span className="ml-2 rounded bg-smg-gray-100 px-1.5 py-0.5 text-[10px] text-smg-gray-500">
                        {b.boardName}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* WIP per Assignee */}
        <div className="smg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="smg-section-label">WIP per Assignee</h2>
            {unassignedCount > 0 && (
              <span className="rounded-full bg-smg-warning/10 px-2.5 py-0.5 text-xs font-bold text-smg-warning">
                {unassignedCount} unassigned
              </span>
            )}
          </div>
          {Object.keys(wipPerAssignee).length === 0 ? (
            <p className="mt-4 text-sm text-smg-gray-300">
              No in-progress issues
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {Object.entries(wipPerAssignee).map(([name, wip]) => (
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
      {aggregate.scopeChange && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Scope Added"
            value={aggregate.scopeChange.added}
            variant={aggregate.scopeChange.added > 3 ? "warning" : "default"}
          />
          <StatCard
            title="Scope Removed"
            value={aggregate.scopeChange.removed}
          />
          <StatCard
            title="Net Scope Change"
            value={aggregate.scopeChange.net}
            variant={aggregate.scopeChange.net > 5 ? "danger" : "default"}
          />
        </div>
      )}

      {/* Sprint Issues + GitHub (overview) */}
      {issues.length > 0 && ghConfigured && (
        <>
          {ghLoading ? (
            <div className="smg-card p-6">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-smg-blue border-t-transparent" />
                <span className="text-sm text-smg-gray-500">Loading GitHub data...</span>
              </div>
            </div>
          ) : (
            <GitHubSprintTable
              issues={issues}
              prStatuses={prStatuses}
              jiraBaseUrl={jiraBaseUrl}
            />
          )}
        </>
      )}
    </div>
  );
}
