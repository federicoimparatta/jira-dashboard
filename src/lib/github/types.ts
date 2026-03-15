export interface GitHubReview {
  author: string;
  state: string; // APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING
  submittedAt: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  url: string;
  repo: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  author: string;
  createdAt: string;
  mergedAt: string | null;
  headRef: string;
  body: string | null;
  reviews: GitHubReview[];
  checksConclusion: string | null; // success | failure | neutral | etc.
  additions: number;
  deletions: number;
}

export interface GitHubDeploy {
  id: number;
  environment: string;
  repo: string;
  ref: string;
  status: string; // success | failure | pending | in_progress | etc.
  createdAt: string;
}

export interface GitHubTicketCorrelation {
  issueKey: string;
  pullRequests: GitHubPR[];
  deployments: GitHubDeploy[];
  ciStatus: string | null; // latest check conclusion across PRs
}

export type BottleneckFlag =
  | "no_pr"
  | "review_stale"
  | "ci_failing"
  | "merge_blocked"
  | "long_cycle"
  | "no_deploy"
  | "deploy_failed";

export interface TicketBottleneck {
  issueKey: string;
  flags: BottleneckFlag[];
  prReviewWaitHours: number | null;
  prCycleTimeHours: number | null;
}

export interface DevFlowMetrics {
  avgPrCycleTimeHours: number;
  avgReviewWaitHours: number;
  openPrCount: number;
  mergedPrCount: number;
  deployCount: number;
  bottleneckCount: number;
}

export interface DevFlowResponse {
  correlations: GitHubTicketCorrelation[];
  bottlenecks: TicketBottleneck[];
  metrics: DevFlowMetrics;
  repos: string[];
  fetchedAt: string;
  error?: string;
}
