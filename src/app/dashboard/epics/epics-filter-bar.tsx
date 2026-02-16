"use client";

export interface EpicFilters {
  search: string;
  status: string; // "all" | specific status name
  team: string; // "all" | specific boardId
}

export const DEFAULT_FILTERS: EpicFilters = {
  search: "",
  status: "all",
  team: "all",
};

interface EpicsFilterBarProps {
  statuses: string[];
  teams: { id: string; name: string }[];
  filters: EpicFilters;
  onFiltersChange: (filters: EpicFilters) => void;
}

export function EpicsFilterBar({
  statuses,
  teams,
  filters,
  onFiltersChange,
}: EpicsFilterBarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.team !== "all";

  return (
    <div className="smg-card flex flex-wrap items-center gap-3 p-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-smg-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search epics..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="w-full rounded-lg border border-smg-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-smg-gray-700 placeholder:text-smg-gray-300 focus:border-smg-blue focus:outline-none focus:ring-2 focus:ring-smg-blue/20"
        />
      </div>

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={(e) =>
          onFiltersChange({ ...filters, status: e.target.value })
        }
        className="rounded-lg border border-smg-gray-200 bg-white px-3 py-2 text-sm text-smg-gray-700 focus:border-smg-blue focus:outline-none focus:ring-2 focus:ring-smg-blue/20"
      >
        <option value="all">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Team filter */}
      {teams.length > 1 && (
        <select
          value={filters.team}
          onChange={(e) =>
            onFiltersChange({ ...filters, team: e.target.value })
          }
          className="rounded-lg border border-smg-gray-200 bg-white px-3 py-2 text-sm text-smg-gray-700 focus:border-smg-blue focus:outline-none focus:ring-2 focus:ring-smg-blue/20"
        >
          <option value="all">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-smg-blue transition-colors hover:bg-smg-blue/5"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
