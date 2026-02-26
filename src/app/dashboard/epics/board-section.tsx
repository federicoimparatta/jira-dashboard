"use client";

import { useState, useMemo } from "react";
import type { BoardGroup, EpicProgress } from "@/lib/jira/types";
import { ExpandableEpicCard } from "./epic-card-expandable";

interface BoardSectionProps {
  board: BoardGroup;
  defaultExpanded?: boolean;
  jiraBaseUrl?: string;
}

interface InitiativeGroup {
  key: string;
  summary: string;
  epics: EpicProgress[];
}

export function BoardSection({
  board,
  defaultExpanded = true,
  jiraBaseUrl,
}: BoardSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { initiatives, ungroupedEpics } = useMemo(() => {
    const initiativeMap = new Map<string, InitiativeGroup>();
    const ungrouped: EpicProgress[] = [];

    for (const epic of board.epics) {
      if (epic.initiative) {
        const existing = initiativeMap.get(epic.initiative.key);
        if (existing) {
          existing.epics.push(epic);
        } else {
          initiativeMap.set(epic.initiative.key, {
            key: epic.initiative.key,
            summary: epic.initiative.summary,
            epics: [epic],
          });
        }
      } else {
        ungrouped.push(epic);
      }
    }

    return {
      initiatives: Array.from(initiativeMap.values()),
      ungroupedEpics: ungrouped,
    };
  }, [board.epics]);

  if (board.epics.length === 0) return null;

  const completionPercent =
    board.summary.totalChildIssues > 0
      ? Math.round(board.summary.avgCompletionRate * 100)
      : 0;

  const hasInitiatives = initiatives.length > 0;

  return (
    <div>
      {/* Board heading — clickable to collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-4 flex w-full items-center justify-between border-b border-smg-gray-100 pb-3 text-left"
      >
        <div className="flex items-center gap-2">
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
          <h2 className="text-lg font-bold text-smg-gray-900">
            {board.boardName}
          </h2>
        </div>
        <span className="text-xs text-smg-gray-500">
          {board.summary.totalEpics} epic
          {board.summary.totalEpics !== 1 ? "s" : ""}
          {" \u2014 "}
          {board.summary.totalDoneChildIssues}/
          {board.summary.totalChildIssues} issues done ({completionPercent}%)
        </span>
      </button>

      {/* Epic cards — grouped by initiative when present */}
      {expanded && (
        <div className="space-y-6">
          {initiatives.map((initiative) => (
            <InitiativeSection
              key={initiative.key}
              initiative={initiative}
              jiraBaseUrl={jiraBaseUrl}
            />
          ))}

          {ungroupedEpics.length > 0 && (
            <div className={hasInitiatives ? "mt-2" : ""}>
              {hasInitiatives && (
                <div className="mb-3 flex items-center gap-2 pl-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-smg-gray-400">
                    No Initiative
                  </span>
                  <div className="h-px flex-1 bg-smg-gray-100" />
                </div>
              )}
              <div className="space-y-4">
                {ungroupedEpics.map((epic) => (
                  <ExpandableEpicCard
                    key={epic.key}
                    epic={epic}
                    jiraBaseUrl={jiraBaseUrl}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InitiativeSection({
  initiative,
  jiraBaseUrl,
}: {
  initiative: InitiativeGroup;
  jiraBaseUrl?: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const totalChildIssues = initiative.epics.reduce(
    (s, e) => s + e.childIssues.total,
    0
  );
  const totalDone = initiative.epics.reduce(
    (s, e) => s + e.childIssues.done,
    0
  );
  const completionPct = totalChildIssues > 0 ? Math.round((totalDone / totalChildIssues) * 100) : 0;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-3 flex w-full items-center gap-2 pl-1 text-left"
      >
        <svg
          className={`h-3.5 w-3.5 text-smg-gray-300 transition-transform duration-200 ${
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
        <span className="rounded bg-smg-purple/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-smg-purple">
          Initiative
        </span>
        {jiraBaseUrl ? (
          <a
            href={`${jiraBaseUrl}/browse/${initiative.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-smg-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {initiative.key}
          </a>
        ) : (
          <span className="text-xs font-medium text-smg-gray-500">
            {initiative.key}
          </span>
        )}
        <span className="text-sm font-medium text-smg-gray-900">
          {initiative.summary}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-smg-gray-500">
            {initiative.epics.length} epic{initiative.epics.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-smg-gray-400">
            {totalDone}/{totalChildIssues} done ({completionPct}%)
          </span>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-l-2 border-smg-purple/20 pl-4">
          {initiative.epics.map((epic) => (
            <ExpandableEpicCard
              key={epic.key}
              epic={epic}
              jiraBaseUrl={jiraBaseUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
