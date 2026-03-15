"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSprintData(boardId?: string) {
  const url = boardId ? `/api/jira/sprint?board=${boardId}` : "/api/jira/sprint";
  return useSWR(url, fetcher, {
    refreshInterval: 60_000, // Poll every 60s (hits ISR cache most of the time)
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
}

export function useBacklogData(boardId?: string) {
  const url = boardId ? `/api/jira/backlog?board=${boardId}` : "/api/jira/backlog";
  return useSWR(url, fetcher, {
    refreshInterval: 120_000, // Poll every 2 minutes
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
}

export function useEpicsData() {
  return useSWR("/api/jira/epics", fetcher, {
    refreshInterval: 120_000, // Poll every 2 minutes
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
}

export function useInitiativesData() {
  return useSWR("/api/jira/initiatives", fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
}

export function useVelocityData() {
  return useSWR("/api/jira/velocity", fetcher, {
    refreshInterval: 300_000, // Poll every 5 minutes (historical data)
    revalidateOnFocus: true,
    dedupingInterval: 120_000,
  });
}

export function useDevFlowData() {
  return useSWR("/api/github/devflow", fetcher, {
    refreshInterval: 300_000, // Poll every 5 minutes
    revalidateOnFocus: true,
    dedupingInterval: 120_000,
  });
}

export function useGitHubPRStatus(issueKeys: string[]) {
  const keyParam = issueKeys.join(",");
  return useSWR(
    keyParam ? `/api/github/pr-status?keys=${encodeURIComponent(keyParam)}` : null,
    fetcher,
    { refreshInterval: 300_000, dedupingInterval: 120_000 }
  );
}

export function useMeetingsData(filters?: {
  team?: string;
  week?: string;
  sprint?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.team) params.set("team", filters.team);
  if (filters?.week) params.set("week", filters.week);
  if (filters?.sprint) params.set("sprint", filters.sprint);
  const qs = params.toString();
  const url = `/api/meetings${qs ? `?${qs}` : ""}`;

  return useSWR(url, fetcher, {
    refreshInterval: 120_000,
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
}
