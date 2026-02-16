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
