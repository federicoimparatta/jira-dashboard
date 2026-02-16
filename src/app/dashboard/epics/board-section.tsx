"use client";

import type { BoardGroup } from "@/lib/jira/types";
import { ExpandableEpicCard } from "./epic-card-expandable";

interface BoardSectionProps {
  board: BoardGroup;
}

export function BoardSection({ board }: BoardSectionProps) {
  if (board.epics.length === 0) return null;

  const completionPercent =
    board.summary.totalChildIssues > 0
      ? Math.round(board.summary.avgCompletionRate * 100)
      : 0;

  return (
    <div>
      {/* Board heading */}
      <div className="mb-4 flex items-baseline justify-between border-b border-smg-gray-100 pb-3">
        <h2 className="text-lg font-bold text-smg-gray-900">
          {board.boardName}
        </h2>
        <span className="text-xs text-smg-gray-500">
          {board.summary.totalEpics} epic{board.summary.totalEpics !== 1 ? "s" : ""}
          {" \u2014 "}
          {board.summary.totalDoneChildIssues}/{board.summary.totalChildIssues} issues done
          ({completionPercent}%)
        </span>
      </div>

      {/* Epic cards */}
      <div className="space-y-4">
        {board.epics.map((epic) => (
          <ExpandableEpicCard key={epic.key} epic={epic} />
        ))}
      </div>
    </div>
  );
}
