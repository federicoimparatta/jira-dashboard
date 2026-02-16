"use client";

import { useState } from "react";
import type { EpicProgress, ChildIssue } from "@/lib/jira/types";
import { ProgressBar } from "../components/progress-bar";
import { JiraLink } from "../components/jira-link";

const statusBadgeColors: Record<string, string> = {
  done: "bg-smg-teal/10 text-smg-teal",
  indeterminate: "bg-smg-blue/10 text-smg-blue",
  new: "bg-smg-gray-100 text-smg-gray-500",
};

function ChildIssueRow({ child, jiraBaseUrl }: { child: ChildIssue; jiraBaseUrl?: string }) {
  const badgeColor =
    statusBadgeColors[child.status.categoryKey] || statusBadgeColors.new;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-smg-gray-50 px-4 py-2.5">
      <JiraLink
        issueKey={child.key}
        jiraBaseUrl={jiraBaseUrl}
        className="shrink-0 text-xs font-semibold text-smg-blue"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-smg-gray-700">
        {child.summary}
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeColor}`}
      >
        {child.status.name}
      </span>
      <span className="shrink-0 text-xs text-smg-gray-500 w-24 text-right">
        {child.assignee || "Unassigned"}
      </span>
      {child.storyPoints > 0 && (
        <span className="shrink-0 rounded bg-smg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-smg-gray-700">
          {child.storyPoints} pts
        </span>
      )}
    </div>
  );
}

export function ExpandableEpicCard({ epic, jiraBaseUrl }: { epic: EpicProgress; jiraBaseUrl?: string }) {
  const [expanded, setExpanded] = useState(false);

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
      {/* Epic header row — clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <JiraLink
              issueKey={epic.key}
              jiraBaseUrl={jiraBaseUrl}
              className="shrink-0 font-semibold text-smg-blue"
            />
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
        <div className="ml-4 flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-smg-blue">
            {completionPercent}%
          </span>
          <svg
            className={`h-4 w-4 text-smg-gray-300 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      {/* Progress bar */}
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

      {/* Expanded child issues */}
      {expanded && (
        <div className="mt-4 border-t border-smg-gray-100 pt-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
            Child Issues ({epic.children.length})
          </div>
          {epic.children.length === 0 ? (
            <p className="text-sm text-smg-gray-300">No child issues</p>
          ) : (
            <div className="space-y-2">
              {epic.children.map((child) => (
                <ChildIssueRow key={child.key} child={child} jiraBaseUrl={jiraBaseUrl} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
