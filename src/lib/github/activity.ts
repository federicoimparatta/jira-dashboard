import { getGitHubConfig } from "./config";
import {
  searchPRsByTicketKeys,
  parseRepoFromUrl,
  fetchPRReviews,
  fetchPRDetail,
  fetchDeployments,
  fetchDeploymentStatuses,
  fetchCheckRunsForRef,
} from "./client";
import type { SearchResultItem } from "./client";
import { correlateGitHubWithSprint } from "./correlate";
import { extractTicketKeys } from "./correlate";
import { computeBottlenecks, computeDevFlowMetrics } from "./bottlenecks";
import type { GitHubPR, GitHubDeploy, DevFlowResponse } from "./types";

type ProgressCallback = (stage: string, percent: number, message: string) => void;

// Concurrency limiter
async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Main orchestrator for Dev Flow data.
 * Fetches GitHub PRs, reviews, deployments and correlates with Jira issue keys.
 */
export async function getDevFlowData(
  issueKeys: string[],
  inProgressKeys: Set<string>,
  onProgress?: ProgressCallback
): Promise<DevFlowResponse> {
  const config = getGitHubConfig();

  onProgress?.("init", 0, "Initializing GitHub integration...");

  if (issueKeys.length === 0) {
    return {
      correlations: [],
      bottlenecks: [],
      metrics: {
        avgPrCycleTimeHours: 0,
        avgReviewWaitHours: 0,
        openPrCount: 0,
        mergedPrCount: 0,
        deployCount: 0,
        bottleneckCount: 0,
      },
      repos: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  // 1. Search PRs for all issue keys (batched)
  onProgress?.("github_search", 25, `Searching GitHub PRs for ${issueKeys.length} issues...`);

  const searchResults = await searchPRsByTicketKeys(config.org, issueKeys);

  // Extract unique repos from search results
  const repoSet = new Set<string>();
  const repoOwnerMap = new Map<string, { owner: string; repo: string }>();

  for (const item of searchResults) {
    const { owner, repo } = parseRepoFromUrl(item.repository_url);
    const fullRepo = `${owner}/${repo}`;
    repoSet.add(fullRepo);
    repoOwnerMap.set(fullRepo, { owner, repo });
  }

  // 2. For each matched PR, fetch reviews + detail in parallel (concurrency limit of 5)
  onProgress?.("reviews", 50, `Fetching reviews for ${searchResults.length} PRs...`);

  const prs: GitHubPR[] = await withConcurrency(searchResults, 5, async (item) => {
    const { owner, repo } = parseRepoFromUrl(item.repository_url);
    const fullRepo = `${owner}/${repo}`;

    // Fetch reviews and detail in parallel
    const [reviews, detail] = await Promise.all([
      fetchPRReviews(owner, repo, item.number),
      fetchPRDetail(owner, repo, item.number),
    ]);

    // Determine state
    let state: "open" | "closed" | "merged" = "open";
    if (detail?.merged || item.pull_request?.merged_at) {
      state = "merged";
    } else if (item.state === "closed") {
      state = "closed";
    }

    // Fetch checks for open PRs
    let checksConclusion: string | null = null;
    if (state === "open" && detail?.head?.ref) {
      checksConclusion = await fetchCheckRunsForRef(owner, repo, detail.head.ref);
    }

    return {
      number: item.number,
      title: item.title,
      url: item.html_url,
      repo: fullRepo,
      state,
      draft: detail?.draft ?? item.draft ?? false,
      author: item.user?.login || "unknown",
      createdAt: item.created_at,
      mergedAt: detail?.merged_at || item.pull_request?.merged_at || null,
      headRef: detail?.head?.ref || "",
      reviews,
      checksConclusion,
      additions: detail?.additions ?? 0,
      deletions: detail?.deletions ?? 0,
    };
  });

  // 3. Fetch deployments from repos that had matched PRs
  onProgress?.("deploys", 65, `Fetching deployments from ${repoSet.size} repositories...`);

  const allDeploys: GitHubDeploy[] = [];

  await withConcurrency(Array.from(repoOwnerMap.entries()), 5, async ([fullRepo, { owner, repo }]) => {
    const rawDeploys = await fetchDeployments(owner, repo, 30);

    // Fetch status for each deployment (limit to 10 most recent)
    for (const deploy of rawDeploys.slice(0, 10)) {
      const statuses = await fetchDeploymentStatuses(owner, repo, deploy.id);
      const latestStatus = statuses[0]?.state || "pending";

      allDeploys.push({
        id: deploy.id,
        environment: deploy.environment,
        repo: fullRepo,
        ref: deploy.ref,
        status: latestStatus,
        createdAt: deploy.created_at,
      });
    }
  });

  // 4. Correlate
  onProgress?.("correlate", 80, "Correlating GitHub data with Jira issues...");

  const correlations = correlateGitHubWithSprint(issueKeys, prs, allDeploys);

  // 5. Compute bottlenecks
  const bottlenecks = computeBottlenecks(correlations, inProgressKeys);

  // 6. Compute metrics
  const metrics = computeDevFlowMetrics(correlations, bottlenecks);

  onProgress?.("complete", 100, "Dev flow analysis complete");

  return {
    correlations: Array.from(correlations.values()),
    bottlenecks,
    metrics,
    repos: Array.from(repoSet),
    fetchedAt: new Date().toISOString(),
  };
}
