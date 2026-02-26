"use client";

import { useState } from "react";
import type { InitiativeProgress } from "@/lib/jira/types";
import { ProgressBar } from "../components/progress-bar";
import { JiraLink } from "../components/jira-link";

const statusColors: Record<string, string> = {
  done: "bg-smg-teal/10 text-smg-teal",
  indeterminate: "bg-smg-blue/10 text-smg-blue",
  new: "bg-smg-gray-100 text-smg-gray-500",
};

interface InitiativeCardProps {
  initiative: InitiativeProgress;
  jiraBaseUrl?: string;
}

export function InitiativeCard({ initiative, jiraBaseUrl }: InitiativeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const completionPct = Math.round(initiative.completionRate * 100);

  return (
    <div className="smg-card overflow-hidden">
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <svg
          className={`mt-1 h-4 w-4 shrink-0 text-smg-gray-300 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-smg-purple/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-smg-purple">
              Initiative
            </span>
            <JiraLink
              issueKey={initiative.key}
              jiraBaseUrl={jiraBaseUrl}
              className="text-xs font-medium text-smg-blue"
            />
          </div>
          <h3 className="mt-1 text-sm font-semibold text-smg-gray-900">
            {initiative.summary}
          </h3>

          {/* Stats row */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-smg-gray-500">
            <span>
              {initiative.epicCount} epic{initiative.epicCount !== 1 ? "s" : ""}
            </span>
            <span>
              {initiative.childIssues.done}/{initiative.childIssues.total} issues done
            </span>
            {initiative.storyPoints.total > 0 && (
              <span>
                {initiative.storyPoints.done}/{initiative.storyPoints.total} pts
              </span>
            )}
            <span
              className={`font-semibold ${
                completionPct >= 60
                  ? "text-smg-teal"
                  : completionPct >= 30
                    ? "text-smg-blue"
                    : "text-smg-warning"
              }`}
            >
              {completionPct}% complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <ProgressBar
              done={initiative.storyPoints.done}
              inProgress={initiative.storyPoints.inProgress}
              todo={initiative.storyPoints.todo}
              total={initiative.storyPoints.total}
              showLabels={false}
            />
          </div>
        </div>
      </button>

      {/* Expanded: list of epics */}
      {expanded && (
        <div className="border-t border-smg-gray-100 bg-smg-gray-50/50 px-5 py-4">
          <div className="space-y-3">
            {initiative.epics.map((epic) => {
              const epicDonePct =
                epic.childIssues.total > 0
                  ? Math.round((epic.childIssues.done / epic.childIssues.total) * 100)
                  : 0;

              return (
                <div
                  key={epic.key}
                  className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <JiraLink
                        issueKey={epic.key}
                        jiraBaseUrl={jiraBaseUrl}
                        className="text-xs font-medium text-smg-blue"
                      />
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          statusColors[epic.status.categoryKey] || statusColors.new
                        }`}
                      >
                        {epic.status.name}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-smg-gray-700">
                      {epic.summary}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-xs text-smg-gray-500">
                    <span>
                      {epic.childIssues.done}/{epic.childIssues.total} done
                    </span>
                    {epic.storyPoints.total > 0 && (
                      <span>
                        {epic.storyPoints.done}/{epic.storyPoints.total} pts
                      </span>
                    )}
                    <span
                      className={`font-semibold ${
                        epicDonePct >= 60
                          ? "text-smg-teal"
                          : epicDonePct >= 30
                            ? "text-smg-blue"
                            : "text-smg-gray-400"
                      }`}
                    >
                      {epicDonePct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
