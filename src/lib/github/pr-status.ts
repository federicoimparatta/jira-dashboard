import { isGitHubConfigured, getGitHubConfig } from "./config";
import { searchPRsByTicketKeys, parseRepoFromUrl } from "./client";
import { extractTicketKeys } from "./correlate";
import type { PRStatus } from "./types";

/**
 * Lightweight PR status lookup for sprint issues.
 * NO secondary API calls (no reviews, no CI, no deployments).
 * Should complete in <3s for ~30 keys.
 */
export async function getPRStatusForKeys(
  issueKeys: string[]
): Promise<Record<string, PRStatus>> {
  if (!isGitHubConfigured() || issueKeys.length === 0) {
    return {};
  }

  const config = getGitHubConfig();
  const upperKeys = issueKeys.map((k) => k.toUpperCase());
  const keySet = new Set(upperKeys);

  // Search GitHub for PRs matching these keys
  const searchResults = await searchPRsByTicketKeys(config.org, upperKeys);

  // Map: issueKey -> PRStatus[] (collect all candidates, then pick best)
  const candidates: Record<string, PRStatus[]> = {};

  for (const item of searchResults) {
    // Extract ticket keys from PR title, body, and repository URL
    const sources = [item.title, item.body ?? ""];
    const keysFound = new Set<string>();

    for (const source of sources) {
      if (!source) continue;
      for (const key of extractTicketKeys(source)) {
        if (keySet.has(key)) {
          keysFound.add(key);
        }
      }
    }

    if (keysFound.size === 0) continue;

    // Determine PR state
    const isMerged = item.pull_request?.merged_at != null;
    const prState: PRStatus["prState"] = isMerged
      ? "merged"
      : item.state === "closed"
        ? "closed"
        : "open";

    const { repo } = parseRepoFromUrl(item.repository_url);

    const status: PRStatus = {
      hasPR: true,
      prNumber: item.number,
      prUrl: item.html_url,
      prState,
      repo,
      author: item.user?.login ?? null,
      mergedAt: item.pull_request?.merged_at ?? null,
      draft: item.draft ?? false,
    };

    for (const key of keysFound) {
      if (!candidates[key]) candidates[key] = [];
      candidates[key].push(status);
    }
  }

  // Build result: for each issue key, pick the most relevant PR
  const result: Record<string, PRStatus> = {};

  for (const key of upperKeys) {
    const prList = candidates[key];
    if (!prList || prList.length === 0) {
      result[key] = {
        hasPR: false,
        prNumber: null,
        prUrl: null,
        prState: null,
        repo: null,
        author: null,
        mergedAt: null,
        draft: false,
      };
      continue;
    }

    // Priority: merged > open > closed, then most recent (by mergedAt or prNumber)
    const statePriority: Record<string, number> = {
      merged: 3,
      open: 2,
      closed: 1,
    };

    prList.sort((a, b) => {
      const aPrio = statePriority[a.prState ?? ""] ?? 0;
      const bPrio = statePriority[b.prState ?? ""] ?? 0;
      if (aPrio !== bPrio) return bPrio - aPrio;
      // Higher PR number = more recent
      return (b.prNumber ?? 0) - (a.prNumber ?? 0);
    });

    result[key] = prList[0];
  }

  return result;
}
