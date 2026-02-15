"use client";

import { useVelocityData } from "@/lib/hooks/use-dashboard-data";
import { VelocityChart } from "../components/velocity-chart";
import { StatCard } from "../components/stat-card";

export default function TrendsPage() {
  const { data, error, isLoading } = useVelocityData();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800">
          Failed to load velocity data
        </h2>
        <p className="mt-1 text-sm text-red-600">
          Unable to fetch velocity history.
        </p>
      </div>
    );
  }

  const velocity = data?.velocity || [];
  const average = data?.average;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Trends &amp; History
        </h1>
        <div className="text-xs text-gray-400">
          Last updated:{" "}
          {data?.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "—"}
        </div>
      </div>

      {/* Velocity Average */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Avg Velocity"
          value={
            average != null ? `${Math.round(average)} pts` : "—"
          }
          subtitle={
            velocity.length > 0
              ? `Over last ${velocity.length} sprints`
              : "No sprint history"
          }
        />
        <StatCard
          title="Sprints Tracked"
          value={velocity.length}
          subtitle="Completed sprints in history"
        />
        <StatCard
          title="Last Sprint"
          value={
            velocity.length > 0
              ? `${velocity[velocity.length - 1].completed} pts`
              : "—"
          }
          subtitle={
            velocity.length > 0
              ? velocity[velocity.length - 1].sprintName
              : "No data"
          }
        />
      </div>

      {/* Velocity Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Velocity Trend (Rolling)
        </h2>
        <VelocityChart data={velocity} />
      </div>

      {/* Info about data source */}
      {data?.note && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          {data.note}
        </div>
      )}

      {/* Sprint History Table */}
      {velocity.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Sprint History
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-500">
                <th className="px-6 py-3">Sprint</th>
                <th className="px-6 py-3 text-right">Committed</th>
                <th className="px-6 py-3 text-right">Completed</th>
                <th className="px-6 py-3 text-right">Completion %</th>
                <th className="px-6 py-3 text-right">End Date</th>
              </tr>
            </thead>
            <tbody>
              {[...velocity].reverse().map(
                (v: {
                  sprintId: number;
                  sprintName: string;
                  committed: number;
                  completed: number;
                  endDate: string;
                }) => (
                  <tr
                    key={v.sprintId}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {v.sprintName}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {v.committed}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {v.completed}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span
                        className={`font-medium ${
                          v.committed > 0 && v.completed / v.committed >= 0.8
                            ? "text-green-600"
                            : "text-amber-600"
                        }`}
                      >
                        {v.committed > 0
                          ? `${Math.round((v.completed / v.committed) * 100)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500">
                      {v.endDate
                        ? new Date(v.endDate).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-gray-200" />
    </div>
  );
}
