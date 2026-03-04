"use client";

import { Suspense, useState } from "react";
import { useVelocityData } from "@/lib/hooks/use-dashboard-data";
import { useStreamingData } from "@/lib/hooks/use-streaming-data";
import { DataLoadingProgress } from "../components/data-loading-progress";
import { StatCard } from "../components/stat-card";
import { VelocityTrendChart } from "./components/velocity-trend-chart";
import { CommittedVsDeliveredChart } from "./components/committed-vs-delivered-chart";

type BoardData = {
  boardId: string;
  boardName: string;
  sprints: SprintPoint[];
  avgVelocity: number;
  avgCommitment: number;
  deliveryRate: number;
};

type SprintPoint = {
  sprintId: number;
  sprintName: string;
  boardId: string;
  boardName: string;
  committedPoints: number;
  completedPoints: number;
  sprintStartDate: string;
  sprintEndDate: string;
  issueCount: number;
  doneCount: number;
  scopeAdded: number;
};

type VelocityResponseData = {
  error?: string;
  boards?: BoardData[];
  allSprints?: SprintPoint[];
  fetchedAt?: string;
};

function VelocityContent() {
  const swr = useVelocityData();
  const { data: rawData, error, isLoading, progress } = useStreamingData<VelocityResponseData>({
    swrData: swr.data,
    swrLoading: swr.isLoading,
    swrError: swr.error,
    streamUrl: "/api/jira/velocity/stream",
  });

  if (isLoading) {
    if (progress) {
      return (
        <DataLoadingProgress
          title="Sprint Velocity"
          subtitle="Loading historical sprint data from Jira..."
          progress={progress}
        >
          <VelocitySkeleton />
        </DataLoadingProgress>
      );
    }
    return <LoadingSkeleton />;
  }

  const data = rawData;

  if (error || data?.error) {
    return (
      <div className="dash-card border-dash-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-dash-danger">
          Failed to load velocity data
        </h2>
        <p className="mt-1 text-sm text-dash-danger/70">
          {data?.error || (typeof error === "string" ? error : "Unable to fetch historical sprint data from Jira.")}
        </p>
      </div>
    );
  }

  if (!data?.boards?.length) {
    return (
      <div className="dash-card p-6">
        <h2 className="text-lg font-semibold text-dash-gray-700">No velocity data</h2>
        <p className="mt-1 text-sm text-dash-gray-500">
          No closed sprints found. Velocity data will appear once sprints are completed.
        </p>
      </div>
    );
  }

  return <VelocityDashboard data={data as Required<VelocityResponseData>} />;
}

function VelocityDashboard({ data }: { data: { boards: BoardData[]; allSprints: SprintPoint[]; fetchedAt: string } }) {
  const [selectedBoard, setSelectedBoard] = useState<string>("all");
  const boards = data.boards;

  const activeBoardData = selectedBoard === "all"
    ? {
        sprints: data.allSprints,
        avgVelocity: boards.reduce((s, b) => s + b.avgVelocity, 0) / boards.length,
        avgCommitment: boards.reduce((s, b) => s + b.avgCommitment, 0) / boards.length,
        deliveryRate: boards.reduce((s, b) => s + b.deliveryRate, 0) / boards.length,
      }
    : boards.find((b) => b.boardId === selectedBoard) || boards[0];

  const sprints = activeBoardData.sprints;
  const totalSprints = sprints.length;

  const recentSprints = sprints.slice(-3);
  const priorSprints = sprints.slice(-6, -3);
  const recentAvg = recentSprints.length > 0
    ? recentSprints.reduce((s, v) => s + v.completedPoints, 0) / recentSprints.length
    : 0;
  const priorAvg = priorSprints.length > 0
    ? priorSprints.reduce((s, v) => s + v.completedPoints, 0) / priorSprints.length
    : 0;
  const velocityTrend = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

  const avgDeliveryRate = sprints.length > 0
    ? sprints.reduce((s, v) => s + (v.committedPoints > 0 ? v.completedPoints / v.committedPoints : 0), 0) / sprints.length * 100
    : 0;

  const overcommittedCount = sprints.filter(
    (s) => s.committedPoints > 0 && s.completedPoints / s.committedPoints < 0.7
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dash-gray-900">Sprint Velocity</h1>
          <p className="mt-1 text-sm text-dash-gray-500">
            Historical sprint delivery and planning metrics across {totalSprints} sprint{totalSprints !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {boards.length > 1 && (
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="rounded-lg border border-dash-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-dash-gray-700 shadow-sm transition-colors hover:border-dash-blue focus:outline-none focus:ring-2 focus:ring-dash-blue/20"
            >
              <option value="all">All Boards</option>
              {boards.map((b) => (
                <option key={b.boardId} value={b.boardId}>{b.boardName}</option>
              ))}
            </select>
          )}
          <div className="rounded-full bg-dash-gray-100 px-3 py-1 text-xs font-medium text-dash-gray-500">
            Updated {data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : "\u2014"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Avg Velocity"
          value={`${Math.round(activeBoardData.avgVelocity)} pts`}
          subtitle="per sprint"
          trend={velocityTrend > 5 ? "up" : velocityTrend < -5 ? "down" : "flat"}
          trendValue={`${Math.abs(Math.round(velocityTrend))}%`}
        />
        <StatCard title="Avg Commitment" value={`${Math.round(activeBoardData.avgCommitment)} pts`} subtitle="per sprint" />
        <StatCard
          title="Delivery Rate"
          value={`${Math.round(avgDeliveryRate)}%`}
          subtitle="committed vs delivered"
          variant={avgDeliveryRate >= 80 ? "success" : avgDeliveryRate >= 60 ? "warning" : "danger"}
        />
        <StatCard
          title="Overcommitted"
          value={overcommittedCount}
          subtitle={`of ${totalSprints} sprints (<70% delivered)`}
          variant={overcommittedCount > totalSprints * 0.3 ? "danger" : overcommittedCount > 0 ? "warning" : "success"}
        />
      </div>

      <div className="dash-card p-6">
        <h2 className="dash-section-label mb-4">Velocity Trend</h2>
        <VelocityTrendChart data={sprints} avgVelocity={Math.round(activeBoardData.avgVelocity * 10) / 10} />
      </div>

      <div className="dash-card p-6">
        <h2 className="dash-section-label mb-4">Committed vs Delivered</h2>
        <CommittedVsDeliveredChart data={sprints} />
      </div>

      <div className="dash-card overflow-hidden">
        <div className="px-6 py-4">
          <h2 className="dash-section-label">Sprint Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-dash-gray-100 bg-dash-gray-50">
                <th className="px-6 py-3 text-left font-semibold text-dash-gray-700">Sprint</th>
                {boards.length > 1 && selectedBoard === "all" && (
                  <th className="px-4 py-3 text-left font-semibold text-dash-gray-700">Board</th>
                )}
                <th className="px-4 py-3 text-right font-semibold text-dash-gray-700">Committed</th>
                <th className="px-4 py-3 text-right font-semibold text-dash-gray-700">Delivered</th>
                <th className="px-4 py-3 text-right font-semibold text-dash-gray-700">Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-dash-gray-700">Issues</th>
                <th className="px-4 py-3 text-right font-semibold text-dash-gray-700">Scope Added</th>
                <th className="px-4 py-3 text-left font-semibold text-dash-gray-700">End Date</th>
              </tr>
            </thead>
            <tbody>
              {[...sprints].reverse().map((s) => {
                const rate = s.committedPoints > 0 ? Math.round((s.completedPoints / s.committedPoints) * 100) : 0;
                return (
                  <tr key={`${s.sprintId}-${s.boardName}`} className="border-t border-dash-gray-100 hover:bg-dash-gray-50/50">
                    <td className="px-6 py-3 font-medium text-dash-gray-900">{s.sprintName}</td>
                    {boards.length > 1 && selectedBoard === "all" && (
                      <td className="px-4 py-3 text-dash-gray-500">{s.boardName}</td>
                    )}
                    <td className="px-4 py-3 text-right font-mono text-dash-gray-700">{s.committedPoints}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-dash-gray-900">{s.completedPoints}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                        rate >= 80 ? "bg-dash-teal/10 text-dash-teal"
                        : rate >= 60 ? "bg-dash-warning/10 text-dash-warning"
                        : "bg-dash-danger/10 text-dash-danger"
                      }`}>{rate}%</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-dash-gray-500">{s.doneCount}/{s.issueCount}</td>
                    <td className="px-4 py-3 text-right">
                      {s.scopeAdded > 0 ? <span className="font-mono text-dash-warning">+{s.scopeAdded}</span> : <span className="text-dash-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-3 text-dash-gray-500">{s.sprintEndDate ? new Date(s.sprintEndDate).toLocaleDateString() : "\u2014"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VelocitySkeleton() {
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="dash-skeleton h-24" />
        ))}
      </div>
      <div className="dash-skeleton h-80" />
      <div className="dash-skeleton h-80" />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-skeleton h-8 w-48" />
      <VelocitySkeleton />
    </div>
  );
}

export default function VelocityPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <VelocityContent />
    </Suspense>
  );
}
