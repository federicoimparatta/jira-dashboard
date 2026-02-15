"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSprintData() {
  return useSWR("/api/jira/sprint", fetcher, {
    refreshInterval: 60_000, // Poll every 60s (hits ISR cache most of the time)
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
}

export function useBacklogData() {
  return useSWR("/api/jira/backlog", fetcher, {
    refreshInterval: 120_000, // Poll every 2 minutes
    revalidateOnFocus: true,
    dedupingInterval: 60_000,
  });
}

export function useVelocityData() {
  return useSWR("/api/jira/velocity", fetcher, {
    refreshInterval: 300_000, // Poll every 5 minutes
    revalidateOnFocus: true,
  });
}
