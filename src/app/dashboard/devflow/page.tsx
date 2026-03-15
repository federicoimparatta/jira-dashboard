"use client";

import { Suspense } from "react";
import { useDevFlowData } from "@/lib/hooks/use-dashboard-data";
import { useStreamingData } from "@/lib/hooks/use-streaming-data";
import { DataLoadingProgress } from "../components/data-loading-progress";
import { FlowMetricsCards } from "./components/flow-metrics-cards";
import { BottleneckPanels } from "./components/bottleneck-panels";
import { SprintIssueTable } from "./components/sprint-issue-table";
import { CycleTimeChart } from "./components/cycle-time-chart";
import type { DevFlowResponse } from "@/lib/github/types";

function DevFlowContent() {
  const swr = useDevFlowData();
  const { data: rawData, error, isLoading, progress } =
    useStreamingData<DevFlowResponse>({
      swrData: swr.data,
      swrLoading: swr.isLoading,
      swrError: swr.error,
      streamUrl: "/api/github/devflow/stream",
    });

  if (isLoading) {
    if (progress) {
      return (
        <DataLoadingProgress
          title="Dev Flow"
          subtitle="Correlating GitHub activity with Jira sprint..."
          progress={progress}
        >
          <DevFlowSkeleton />
        </DataLoadingProgress>
      );
    }
    return <LoadingSkeleton />;
  }

  const data = rawData;

  if (error || data?.error) {
    const errorMessage =
      data?.error || (typeof error === "string" ? error : "Failed to load data");

    // Special case: not configured
    if (errorMessage.includes("not configured")) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-smg-gray-900">Dev Flow</h1>
            <p className="mt-1 text-sm text-smg-gray-500">
              GitHub + Jira correlation for sprint development activity
            </p>
          </div>
          <div className="smg-card p-8 text-center">
            <div className="mx-auto max-w-md">
              <h2 className="text-lg font-semibold text-smg-gray-700">
                GitHub Integration Not Configured
              </h2>
              <p className="mt-2 text-sm text-smg-gray-500">
                Set the <code className="rounded bg-smg-gray-100 px-1.5 py-0.5 text-xs font-mono">GITHUB_TOKEN</code> and{" "}
                <code className="rounded bg-smg-gray-100 px-1.5 py-0.5 text-xs font-mono">GITHUB_ORG</code> environment
                variables to enable the Dev Flow dashboard.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-smg-gray-900">Dev Flow</h1>
        </div>
        <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-smg-danger">
            Failed to load dev flow data
          </h2>
          <p className="mt-1 text-sm text-smg-danger/70">{errorMessage}</p>
          <button
            onClick={() => swr.mutate()}
            className="mt-4 rounded-lg bg-smg-danger/10 px-4 py-2 text-sm font-medium text-smg-danger transition-colors hover:bg-smg-danger/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="smg-card p-6">
        <h2 className="text-lg font-semibold text-smg-gray-700">
          No dev flow data
        </h2>
        <p className="mt-1 text-sm text-smg-gray-500">
          No active sprint issues found to correlate with GitHub.
        </p>
      </div>
    );
  }

  // Collect all PRs across correlations for the cycle time chart
  const allPrs = data.correlations.flatMap((c) => c.pullRequests);
  // Deduplicate by URL
  const prMap = new Map(allPrs.map((pr) => [pr.url, pr]));
  const uniquePrs = Array.from(prMap.values());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-smg-gray-900">Dev Flow</h1>
          <p className="mt-1 text-sm text-smg-gray-500">
            GitHub + Jira correlation across{" "}
            {data.correlations.length} sprint issues
            {data.repos.length > 0 && ` in ${data.repos.length} repo${data.repos.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="rounded-full bg-smg-gray-100 px-3 py-1 text-xs font-medium text-smg-gray-500">
          Updated{" "}
          {data.fetchedAt
            ? new Date(data.fetchedAt).toLocaleTimeString()
            : "\u2014"}
        </div>
      </div>

      {/* Metrics Cards */}
      <FlowMetricsCards metrics={data.metrics} />

      {/* Bottleneck Panels */}
      <BottleneckPanels bottlenecks={data.bottlenecks} />

      {/* Issue PR Table */}
      <SprintIssueTable correlations={data.correlations} />

      {/* Cycle Time Distribution */}
      {uniquePrs.some((p) => p.state === "merged") && (
        <div className="smg-card p-6">
          <h2 className="smg-section-label mb-4">PR Cycle Time Distribution</h2>
          <CycleTimeChart prs={uniquePrs} />
        </div>
      )}
    </div>
  );
}

function DevFlowSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="smg-skeleton h-24" />
        ))}
      </div>
      <div className="smg-skeleton h-32" />
      <div className="smg-skeleton h-64" />
      <div className="smg-skeleton h-72" />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="smg-skeleton h-8 w-48" />
      <DevFlowSkeleton />
    </div>
  );
}

export default function DevFlowPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DevFlowContent />
    </Suspense>
  );
}
