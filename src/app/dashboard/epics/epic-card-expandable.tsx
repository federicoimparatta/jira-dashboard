"use client";

import { useState } from "react";
import type { EpicProgress, ChildIssue } from "@/lib/jira/types";
import { ProgressBar } from "../components/progress-bar";
import { JiraLink } from "../components/jira-link";
import { EpicDateModal } from "./epic-date-modal";

const statusBadgeColors: Record<string, string> = {
  done: "bg-smg-teal/10 text-smg-teal",
  indeterminate: "bg-smg-blue/10 text-smg-blue",
  new: "bg-smg-gray-100 text-smg-gray-500",
};

const readinessLabels: { key: keyof EpicProgress["readiness"]["criteria"]; label: string }[] = [
  { key: "hasDescription", label: "Description" },
  { key: "hasStoryPoints", label: "Story points" },
  { key: "hasPriority", label: "Priority" },
  { key: "hasInitiative", label: "Initiative" },
  { key: "hasAssignee", label: "Assignee" },
  { key: "hasChildren", label: "Child issues" },
];

function ReadinessDots({ readiness }: { readiness: EpicProgress["readiness"] }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const color =
    readiness.score === 6
      ? "text-smg-teal"
      : readiness.score >= 3
        ? "text-smg-warning"
        : "text-smg-danger";

  return (
    <div
      className="relative flex items-center"
      tabIndex={0}
      role="img"
      aria-label={`Epic readiness: ${readiness.score} of 6 criteria met`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
    >
      <div className={`flex items-center gap-0.5 ${color}`}>
        {readinessLabels.map(({ key }) => (
          <span
            key={key}
            className={`inline-block h-2 w-2 rounded-full ${
              readiness.criteria[key]
                ? "bg-current"
                : "ring-1 ring-current"
            }`}
          />
        ))}
      </div>

      {showTooltip && (
        <div className="absolute left-1/2 top-full z-50 mt-2 min-w-[180px] -translate-x-1/2 rounded-xl border border-smg-gray-100 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-smg-gray-500">
              Epic Readiness
            </span>
            <span className={`text-[11px] font-bold ${color}`}>
              {readiness.score}/6
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {readinessLabels.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center gap-2 text-[11px]"
              >
                <span className={readiness.criteria[key] ? "text-smg-teal" : "text-smg-danger"}>
                  {readiness.criteria[key] ? "\u2714" : "\u2718"}
                </span>
                <span className="text-smg-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

interface DateFields {
  startDateField: string | null;
  endDateField: string | null;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ExpandableEpicCard({
  epic,
  jiraBaseUrl,
  dateFields,
  onEpicUpdated,
}: {
  epic: EpicProgress;
  jiraBaseUrl?: string;
  dateFields?: DateFields | null;
  onEpicUpdated?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

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
            <ReadinessDots readiness={epic.readiness} />
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
      <div className="mt-3 flex items-center gap-6 text-xs text-smg-gray-500">
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
        {(epic.startDate || epic.endDate) && (
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-smg-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {epic.startDate && formatDateShort(epic.startDate)}
            {epic.startDate && epic.endDate && " \u2192 "}
            {epic.endDate && formatDateShort(epic.endDate)}
          </span>
        )}
        {dateFields && (dateFields.startDateField || dateFields.endDateField) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDateModal(true);
            }}
            className="ml-auto rounded p-1 text-smg-gray-300 transition-colors hover:bg-smg-gray-50 hover:text-smg-blue"
            title="Edit dates"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {/* Date edit modal */}
      {showDateModal && dateFields && (
        <EpicDateModal
          epic={epic}
          jiraBaseUrl={jiraBaseUrl}
          startDateField={dateFields.startDateField}
          endDateField={dateFields.endDateField}
          onClose={() => setShowDateModal(false)}
          onSaved={() => onEpicUpdated?.()}
        />
      )}

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
