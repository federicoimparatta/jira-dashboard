"use client";

import { Suspense, useState, useMemo } from "react";
import { useEpicsData } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "../components/stat-card";
import { BoardSection } from "./board-section";
import {
  EpicsFilterBar,
  DEFAULT_FILTERS,
  type EpicFilters,
} from "./epics-filter-bar";
import type { EpicProgress, BoardGroup } from "@/lib/jira/types";

interface EpicsApiResponse {
  boards: BoardGroup[];
  ungrouped: EpicProgress[];
  summary: {
    totalEpics: number;
    avgCompletionRate: number;
    totalChildIssues: number;
    totalDoneChildIssues: number;
  };
  fetchedAt: string;
  error?: string;
}

function EpicsContent() {
  const { data, error, isLoading } = useEpicsData();
  const [filters, setFilters] = useState<EpicFilters>(DEFAULT_FILTERS);

  const typedData = data as EpicsApiResponse | undefined;

  const { filteredBoards, filteredUngrouped, statuses, teams } =
    useMemo(() => {
      if (!typedData)
        return {
          filteredBoards: [] as BoardGroup[],
          filteredUngrouped: [] as EpicProgress[],
          statuses: [] as string[],
          teams: [] as { id: string; name: string }[],
        };

      // Extract filter options from ALL epics (unfiltered)
      const allEpics = typedData.boards
        .flatMap((b) => b.epics)
        .concat(typedData.ungrouped);
      const statuses = [...new Set(allEpics.map((e) => e.status.name))].sort();
      const teams = typedData.boards.map((b) => ({
        id: b.boardId,
        name: b.boardName,
      }));

      function matchesFilters(epic: EpicProgress): boolean {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (
            !epic.key.toLowerCase().includes(q) &&
            !epic.summary.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        if (filters.status !== "all" && epic.status.name !== filters.status)
          return false;
        if (filters.team !== "all" && !epic.boardIds.includes(filters.team))
          return false;
        return true;
      }

      const filteredBoards: BoardGroup[] = typedData.boards
        .map((board) => ({
          ...board,
          epics: board.epics.filter(matchesFilters),
        }))
        .filter((board) => board.epics.length > 0);

      const filteredUngrouped = typedData.ungrouped.filter(matchesFilters);

      return { filteredBoards, filteredUngrouped, statuses, teams };
    }, [typedData, filters]);

  if (isLoading) return <LoadingSkeleton />;

  if (error || typedData?.error) {
    return (
      <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-smg-danger">
          Failed to load epics data
        </h2>
        <p className="mt-1 text-sm text-smg-danger/70">
          {typedData?.error ||
            "Unable to fetch epics. Check your environment variables."}
        </p>
      </div>
    );
  }

  const summary = typedData?.summary;
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.team !== "all";
  const noResults =
    filteredBoards.length === 0 && filteredUngrouped.length === 0;

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
          {typedData?.fetchedAt
            ? new Date(typedData.fetchedAt).toLocaleTimeString()
            : "\u2014"}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Active Epics"
          value={summary?.totalEpics ?? "\u2014"}
          subtitle="Not yet completed"
        />
        <StatCard
          title="Avg Completion"
          value={
            summary
              ? `${Math.round(summary.avgCompletionRate * 100)}%`
              : "\u2014"
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
          value={summary?.totalChildIssues ?? "\u2014"}
          subtitle="Across all epics"
        />
        <StatCard
          title="Issues Done"
          value={summary?.totalDoneChildIssues ?? "\u2014"}
          subtitle={`of ${summary?.totalChildIssues ?? 0} total`}
          variant="success"
        />
      </div>

      {/* Filter Bar */}
      <EpicsFilterBar
        statuses={statuses}
        teams={teams}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Board Sections */}
      {filteredBoards.map((board) => (
        <BoardSection key={board.boardId} board={board} />
      ))}

      {/* Ungrouped epics */}
      {filteredUngrouped.length > 0 && (
        <BoardSection
          board={{
            boardId: "__ungrouped",
            boardName: "Other",
            epics: filteredUngrouped,
            summary: {
              totalEpics: filteredUngrouped.length,
              totalChildIssues: filteredUngrouped.reduce(
                (s, e) => s + e.childIssues.total,
                0
              ),
              totalDoneChildIssues: filteredUngrouped.reduce(
                (s, e) => s + e.childIssues.done,
                0
              ),
              avgCompletionRate: (() => {
                const total = filteredUngrouped.reduce(
                  (s, e) => s + e.childIssues.total,
                  0
                );
                const done = filteredUngrouped.reduce(
                  (s, e) => s + e.childIssues.done,
                  0
                );
                return total > 0 ? done / total : 0;
              })(),
            },
          }}
        />
      )}

      {/* Empty state */}
      {noResults && (
        <div className="smg-card p-8 text-center">
          {hasActiveFilters ? (
            <>
              <p className="text-sm text-smg-gray-500">
                No epics match your filters
              </p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-smg-blue transition-colors hover:bg-smg-blue/5"
              >
                Clear filters
              </button>
            </>
          ) : (
            <p className="text-sm text-smg-gray-300">No active epics found</p>
          )}
        </div>
      )}
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
      <div className="smg-skeleton h-14" />
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
