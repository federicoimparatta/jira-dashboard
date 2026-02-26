"use client";

import { Suspense } from "react";
import { useInitiativesData } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "../components/stat-card";
import { InitiativeCard } from "./initiative-card";
import type { InitiativeProgress } from "@/lib/jira/types";

interface InitiativesApiResponse {
  initiatives: InitiativeProgress[];
  summary: {
    totalInitiatives: number;
    totalEpics: number;
    avgCompletionRate: number;
    totalChildIssues: number;
    totalDoneChildIssues: number;
    totalStoryPoints: number;
    totalDoneStoryPoints: number;
  };
  jiraBaseUrl?: string;
  fetchedAt: string;
  error?: string;
}

function InitiativesContent() {
  const { data, error, isLoading } = useInitiativesData();
  const typedData = data as InitiativesApiResponse | undefined;

  if (isLoading) return <LoadingSkeleton />;

  if (error || typedData?.error) {
    return (
      <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-smg-danger">
          Failed to load initiatives data
        </h2>
        <p className="mt-1 text-sm text-smg-danger/70">
          {typedData?.error ||
            "Unable to fetch initiatives. Check your environment variables."}
        </p>
      </div>
    );
  }

  const summary = typedData?.summary;
  const initiatives = typedData?.initiatives ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-smg-gray-900">
            Initiatives Overview
          </h1>
          <p className="mt-1 text-sm text-smg-gray-500">
            All initiatives with active epics
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
          title="Initiatives"
          value={summary?.totalInitiatives ?? "\u2014"}
          subtitle="With active epics"
        />
        <StatCard
          title="Total Epics"
          value={summary?.totalEpics ?? "\u2014"}
          subtitle="Across all initiatives"
        />
        <StatCard
          title="Avg Completion"
          value={
            summary
              ? `${Math.round(summary.avgCompletionRate * 100)}%`
              : "\u2014"
          }
          subtitle="Across all initiatives"
          variant={
            summary && summary.avgCompletionRate > 0.6
              ? "success"
              : summary && summary.avgCompletionRate > 0.3
                ? "default"
                : "warning"
          }
        />
        <StatCard
          title="Story Points Done"
          value={summary?.totalDoneStoryPoints ?? "\u2014"}
          subtitle={`of ${summary?.totalStoryPoints ?? 0} total`}
          variant="success"
        />
      </div>

      {/* Initiative Cards */}
      {initiatives.map((initiative) => (
        <InitiativeCard
          key={initiative.key}
          initiative={initiative}
          jiraBaseUrl={typedData?.jiraBaseUrl}
        />
      ))}

      {/* Empty state */}
      {initiatives.length === 0 && (
        <div className="smg-card p-8 text-center">
          <p className="text-sm text-smg-gray-300">
            No initiatives with active epics found
          </p>
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
      {[...Array(3)].map((_, i) => (
        <div key={i} className="smg-skeleton h-36" />
      ))}
    </div>
  );
}

export default function InitiativesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <InitiativesContent />
    </Suspense>
  );
}
