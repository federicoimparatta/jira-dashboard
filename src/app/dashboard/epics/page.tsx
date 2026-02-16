"use client";

import { Suspense } from "react";
import { useEpicsData } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "../components/stat-card";
import { ProgressBar } from "../components/progress-bar";
import type { EpicProgress } from "@/lib/jira/types";

function EpicsContent() {
  const { data, error, isLoading } = useEpicsData();

  if (isLoading) return <LoadingSkeleton />;

  if (error || data?.error) {
    return (
      <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-smg-danger">
          Failed to load epics data
        </h2>
        <p className="mt-1 text-sm text-smg-danger/70">
          {data?.error || "Unable to fetch epics. Check your environment variables."}
        </p>
      </div>
    );
  }

  const epics: EpicProgress[] = data?.epics || [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-smg-gray-900">
            Epics Overview
          </h1>
          <p className="mt-1 text-sm text-smg-gray-500">
            Cross-board progress for all active epics
          </p>
        </div>
        <div className="rounded-full bg-smg-gray-100 px-3 py-1 text-xs font-medium text-smg-gray-500">
          Updated{" "}
          {data?.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "—"}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Active Epics"
          value={summary?.totalEpics ?? "—"}
          subtitle="Not yet completed"
        />
        <StatCard
          title="Avg Completion"
          value={
            summary
              ? `${Math.round(summary.avgCompletionRate * 100)}%`
              : "—"
          }
          subtitle="Across all epics"
          variant={
            summary && summary.avgCompletionRate > 0.6
              ? "success"
              : summary && summary.avgCompletionRate > 0.3
                ? "default"
                : "warning"
          }
        />
        <StatCard
          title="Total Issues"
          value={summary?.totalChildIssues ?? "—"}
          subtitle="Across all epics"
        />
        <StatCard
          title="Issues Done"
          value={summary?.totalDoneChildIssues ?? "—"}
          subtitle={`of ${summary?.totalChildIssues ?? 0} total`}
          variant="success"
        />
      </div>

      {/* Epics List */}
      {epics.length === 0 ? (
        <div className="smg-card p-8 text-center">
          <p className="text-sm text-smg-gray-300">No active epics found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {epics.map((epic) => (
            <EpicCard key={epic.key} epic={epic} />
          ))}
        </div>
      )}
    </div>
  );
}

function EpicCard({ epic }: { epic: EpicProgress }) {
  const completionPercent =
    epic.childIssues.total > 0
      ? Math.round((epic.childIssues.done / epic.childIssues.total) * 100)
      : 0;

  const spCompletionPercent =
    epic.storyPoints.total > 0
      ? Math.round(
          (epic.storyPoints.done / epic.storyPoints.total) * 100
        )
      : 0;

  return (
    <div className="smg-card p-6">
      {/* Epic header row */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-semibold text-smg-blue">
              {epic.key}
            </span>
            <span className="truncate font-medium text-smg-gray-700">
              {epic.summary}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-smg-gray-500">
            <span>{epic.assignee || "Unassigned"}</span>
            <span className="text-smg-gray-200">|</span>
            <span>{epic.status.name}</span>
            <span className="text-smg-gray-200">|</span>
            <span>{epic.priority.name}</span>
          </div>
        </div>
        <span className="ml-4 shrink-0 text-sm font-semibold text-smg-blue">
          {completionPercent}%
        </span>
      </div>

      {/* Progress bar (by story points if available, otherwise by issue count) */}
      <div className="mt-4">
        {epic.storyPoints.total > 0 ? (
          <ProgressBar
            done={epic.storyPoints.done}
            inProgress={epic.storyPoints.inProgress}
            todo={epic.storyPoints.todo}
            total={epic.storyPoints.total}
            showLabels={false}
          />
        ) : (
          <ProgressBar
            done={epic.childIssues.done}
            inProgress={epic.childIssues.inProgress}
            todo={epic.childIssues.todo}
            total={epic.childIssues.total}
            showLabels={false}
          />
        )}
      </div>

      {/* Bottom stats row */}
      <div className="mt-3 flex gap-6 text-xs text-smg-gray-500">
        <span>
          <span className="font-semibold text-smg-gray-700">
            {epic.childIssues.done}/{epic.childIssues.total}
          </span>{" "}
          issues done
        </span>
        {epic.storyPoints.total > 0 && (
          <span>
            <span className="font-semibold text-smg-gray-700">
              {epic.storyPoints.done}/{epic.storyPoints.total}
            </span>{" "}
            pts done ({spCompletionPercent}%)
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="smg-skeleton h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="smg-skeleton h-24" />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="smg-skeleton h-32" />
      ))}
    </div>
  );
}

export default function EpicsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <EpicsContent />
    </Suspense>
  );
}
