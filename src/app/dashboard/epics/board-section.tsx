"use client";

import { useState } from "react";
import type { BoardGroup } from "@/lib/jira/types";
import { ExpandableEpicCard } from "./epic-card-expandable";

interface BoardSectionProps {
  board: BoardGroup;
  defaultExpanded?: boolean;
  jiraBaseUrl?: string;
}

export function BoardSection({
  board,
  defaultExpanded = true,
  jiraBaseUrl,
}: BoardSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (board.epics.length === 0) return null;

  const completionPercent =
    board.summary.totalChildIssues > 0
      ? Math.round(board.summary.avgCompletionRate * 100)
      : 0;

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

      {/* Epic cards */}
      {expanded && (
        <div className="space-y-4">
          {board.epics.map((epic) => (
            <ExpandableEpicCard key={epic.key} epic={epic} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}
    </div>
  );
}
