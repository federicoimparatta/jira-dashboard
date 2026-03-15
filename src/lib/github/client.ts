import { getGitHubConfig } from "./config";
import type { GitHubReview } from "./types";

async function githubFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const config = getGitHubConfig();
  const url = path.startsWith("http") ? path : `${config.apiBase}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options?.headers as Record<string, string> || {}),
  };

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: "no-store",
    });

    // Rate limit handling
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const resetAt = res.headers.get("x-ratelimit-reset");

      if (remaining === "0" && resetAt) {
        const resetMs = parseInt(resetAt, 10) * 1000 - Date.now();
        const delay = Math.min(Math.max(resetMs, 1000), 60000);
        console.warn(`GitHub rate limited. Waiting ${Math.round(delay / 1000)}s...`);
        await new Promise((r) => setTimeout(r, delay));
        retries++;
        continue;
      }

      // Generic retry with backoff
      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, retries) * 1000 + Math.random() * 1000;
      console.warn(`GitHub API ${res.status}. Retrying in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      retries++;
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `GitHub API error ${res.status}: ${res.statusText} - ${body}`
      );
    }

    return res.json() as Promise<T>;
  }

  throw new Error("GitHub API: max retries exceeded after rate limiting");
}

// Search for PRs referencing ticket keys using the search API
// Batch up to 10 keys per query using OR
export async function searchPRsByTicketKeys(
  org: string,
  keys: string[]
): Promise<SearchResultItem[]> {
  if (keys.length === 0) return [];

  const allItems: SearchResultItem[] = [];

  // Batch keys in groups of 10
  for (let i = 0; i < keys.length; i += 10) {
    const batch = keys.slice(i, i + 10);
    const keyQuery = batch.join(" OR ");
    const q = encodeURIComponent(`org:${org} is:pr ${keyQuery}`);

    try {
      const data = await githubFetch<{
        total_count: number;
        items: SearchResultItem[];
      }>(`/search/issues?q=${q}&per_page=100`);

      allItems.push(...data.items);
    } catch (err) {
      console.warn(`GitHub search failed for batch starting at ${i}:`, err);
    }

    // Small delay between batches to avoid search rate limits
    if (i + 10 < keys.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Deduplicate by PR URL
  const seen = new Set<string>();
  return allItems.filter((item) => {
    if (seen.has(item.html_url)) return false;
    seen.add(item.html_url);
    return true;
  });
}

export interface SearchResultItem {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  user: { login: string } | null;
  created_at: string;
  pull_request?: {
    merged_at: string | null;
    html_url: string;
  };
  repository_url: string;
  body: string | null;
}

// Extract owner/repo from repository_url
export function parseRepoFromUrl(repositoryUrl: string): { owner: string; repo: string } {
  // https://api.github.com/repos/OWNER/REPO
  const parts = repositoryUrl.split("/");
  return {
    owner: parts[parts.length - 2],
    repo: parts[parts.length - 1],
  };
}

export async function fetchPRReviews(
  owner: string,
  repo: string,
  prNumber: number
): Promise<GitHubReview[]> {
  try {
    const data = await githubFetch<
      {
        user: { login: string } | null;
        state: string;
        submitted_at: string;
      }[]
    >(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=100`);

    return data.map((r) => ({
      author: r.user?.login || "unknown",
      state: r.state,
      submittedAt: r.submitted_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchDeployments(
  owner: string,
  repo: string,
  perPage = 30
): Promise<
  {
    id: number;
    environment: string;
    ref: string;
    created_at: string;
  }[]
> {
  try {
    return await githubFetch(
      `/repos/${owner}/${repo}/deployments?per_page=${perPage}`
    );
  } catch {
    return [];
  }
}

export async function fetchDeploymentStatuses(
  owner: string,
  repo: string,
  deployId: number
): Promise<{ state: string; created_at: string }[]> {
  try {
    return await githubFetch(
      `/repos/${owner}/${repo}/deployments/${deployId}/statuses?per_page=1`
    );
  } catch {
    return [];
  }
}

export async function fetchCheckRunsForRef(
  owner: string,
  repo: string,
  ref: string
): Promise<string | null> {
  try {
    const data = await githubFetch<{
      total_count: number;
      check_runs: { conclusion: string | null; status: string }[];
    }>(`/repos/${owner}/${repo}/commits/${ref}/check-runs?per_page=100`);

    if (data.check_runs.length === 0) return null;

    // If any check failed, overall = failure
    if (data.check_runs.some((c) => c.conclusion === "failure")) return "failure";
    // If any still in progress
    if (data.check_runs.some((c) => c.status !== "completed")) return "pending";
    // If all succeeded
    if (data.check_runs.every((c) => c.conclusion === "success" || c.conclusion === "neutral" || c.conclusion === "skipped"))
      return "success";

    return data.check_runs[0]?.conclusion || null;
  } catch {
    return null;
  }
}

export async function fetchPRDetail(
  owner: string,
  repo: string,
  prNumber: number
): Promise<{
  additions: number;
  deletions: number;
  merged_at: string | null;
  head: { ref: string };
  draft: boolean;
  merged: boolean;
  state: string;
} | null> {
  try {
    return await githubFetch(
      `/repos/${owner}/${repo}/pulls/${prNumber}`
    );
  } catch {
    return null;
  }
}
