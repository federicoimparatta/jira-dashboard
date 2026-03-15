import type {
  GitHubTicketCorrelation,
  TicketBottleneck,
  BottleneckFlag,
  DevFlowMetrics,
} from "./types";

// Thresholds
const REVIEW_STALE_HOURS = 24;
const LONG_CYCLE_DAYS = 5;

/**
 * Compute bottleneck flags for each ticket correlation.
 * @param correlations - Map of issueKey -> correlation data
 * @param inProgressKeys - Set of issue keys currently "In Progress" in Jira
 */
export function computeBottlenecks(
  correlations: Map<string, GitHubTicketCorrelation>,
  inProgressKeys: Set<string>
): TicketBottleneck[] {
  const bottlenecks: TicketBottleneck[] = [];
  const now = Date.now();

  for (const [issueKey, corr] of correlations) {
    const flags: BottleneckFlag[] = [];
    let prReviewWaitHours: number | null = null;
    let prCycleTimeHours: number | null = null;

    // no_pr: issue is in progress but has no associated PR
    if (inProgressKeys.has(issueKey) && corr.pullRequests.length === 0) {
      flags.push("no_pr");
    }

    for (const pr of corr.pullRequests) {
      // review_stale: PR is open, not draft, and no review received after 24h
      if (pr.state === "open" && !pr.draft) {
        const prAge = (now - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60);
        if (pr.reviews.length === 0 && prAge > REVIEW_STALE_HOURS) {
          if (!flags.includes("review_stale")) flags.push("review_stale");
          prReviewWaitHours = prAge;
        } else if (pr.reviews.length > 0) {
          // Time to first review
          const firstReview = pr.reviews.reduce(
            (earliest, r) =>
              new Date(r.submittedAt).getTime() < new Date(earliest.submittedAt).getTime()
                ? r
                : earliest,
            pr.reviews[0]
          );
          const waitHrs =
            (new Date(firstReview.submittedAt).getTime() -
              new Date(pr.createdAt).getTime()) /
            (1000 * 60 * 60);
          prReviewWaitHours =
            prReviewWaitHours === null
              ? waitHrs
              : Math.max(prReviewWaitHours, waitHrs);
        }
      }

      // long_cycle: PR open > 5 days
      if (pr.state === "open") {
        const daysOpen =
          (now - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOpen > LONG_CYCLE_DAYS) {
          if (!flags.includes("long_cycle")) flags.push("long_cycle");
        }
        prCycleTimeHours =
          (now - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60);
      }

      // Merged PR cycle time
      if (pr.state === "merged" && pr.mergedAt) {
        const cycleHrs =
          (new Date(pr.mergedAt).getTime() -
            new Date(pr.createdAt).getTime()) /
          (1000 * 60 * 60);
        prCycleTimeHours =
          prCycleTimeHours === null
            ? cycleHrs
            : Math.max(prCycleTimeHours, cycleHrs);
      }

      // ci_failing: latest check conclusion is failure
      if (pr.checksConclusion === "failure") {
        if (!flags.includes("ci_failing")) flags.push("ci_failing");
      }

      // merge_blocked: any review has CHANGES_REQUESTED and no subsequent APPROVED
      const latestReviewState = getLatestReviewState(pr.reviews);
      if (latestReviewState === "CHANGES_REQUESTED") {
        if (!flags.includes("merge_blocked")) flags.push("merge_blocked");
      }
    }

    // no_deploy: PR merged but no deployment found
    const hasMergedPr = corr.pullRequests.some((p) => p.state === "merged");
    if (hasMergedPr && corr.deployments.length === 0) {
      flags.push("no_deploy");
    }

    // deploy_failed: latest deployment status is failure
    if (
      corr.deployments.some(
        (d) => d.status === "failure" || d.status === "error"
      )
    ) {
      flags.push("deploy_failed");
    }

    if (flags.length > 0) {
      bottlenecks.push({
        issueKey,
        flags,
        prReviewWaitHours:
          prReviewWaitHours !== null
            ? Math.round(prReviewWaitHours * 10) / 10
            : null,
        prCycleTimeHours:
          prCycleTimeHours !== null
            ? Math.round(prCycleTimeHours * 10) / 10
            : null,
      });
    }
  }

  return bottlenecks;
}

function getLatestReviewState(
  reviews: { author: string; state: string; submittedAt: string }[]
): string | null {
  if (reviews.length === 0) return null;

  // Get the most recent non-COMMENTED review per author
  const byAuthor = new Map<string, { state: string; submittedAt: string }>();
  for (const r of reviews) {
    if (r.state === "COMMENTED") continue;
    const existing = byAuthor.get(r.author);
    if (!existing || new Date(r.submittedAt) > new Date(existing.submittedAt)) {
      byAuthor.set(r.author, r);
    }
  }

  // If any author has CHANGES_REQUESTED as their latest
  const states = Array.from(byAuthor.values());
  if (states.some((s) => s.state === "CHANGES_REQUESTED")) {
    return "CHANGES_REQUESTED";
  }
  if (states.some((s) => s.state === "APPROVED")) {
    return "APPROVED";
  }
  return null;
}

/**
 * Compute aggregate DevFlow metrics from correlations and bottlenecks.
 */
export function computeDevFlowMetrics(
  correlations: Map<string, GitHubTicketCorrelation>,
  bottlenecks: TicketBottleneck[]
): DevFlowMetrics {
  let totalCycleTimeHours = 0;
  let cycleTimeCount = 0;
  let totalReviewWaitHours = 0;
  let reviewWaitCount = 0;
  let openPrCount = 0;
  let mergedPrCount = 0;
  let deployCount = 0;

  for (const corr of correlations.values()) {
    for (const pr of corr.pullRequests) {
      if (pr.state === "open") openPrCount++;
      if (pr.state === "merged" && pr.mergedAt) {
        mergedPrCount++;
        const cycleHrs =
          (new Date(pr.mergedAt).getTime() -
            new Date(pr.createdAt).getTime()) /
          (1000 * 60 * 60);
        totalCycleTimeHours += cycleHrs;
        cycleTimeCount++;
      }

      // First review wait time
      if (pr.reviews.length > 0) {
        const firstReview = pr.reviews.reduce(
          (earliest, r) =>
            new Date(r.submittedAt).getTime() <
            new Date(earliest.submittedAt).getTime()
              ? r
              : earliest,
          pr.reviews[0]
        );
        const waitHrs =
          (new Date(firstReview.submittedAt).getTime() -
            new Date(pr.createdAt).getTime()) /
          (1000 * 60 * 60);
        totalReviewWaitHours += waitHrs;
        reviewWaitCount++;
      }
    }
    deployCount += corr.deployments.length;
  }

  return {
    avgPrCycleTimeHours:
      cycleTimeCount > 0
        ? Math.round((totalCycleTimeHours / cycleTimeCount) * 10) / 10
        : 0,
    avgReviewWaitHours:
      reviewWaitCount > 0
        ? Math.round((totalReviewWaitHours / reviewWaitCount) * 10) / 10
        : 0,
    openPrCount,
    mergedPrCount,
    deployCount,
    bottleneckCount: bottlenecks.length,
  };
}
