import type { GitHubPR, GitHubDeploy, GitHubTicketCorrelation } from "./types";

const TICKET_KEY_REGEX = /[A-Z][A-Z0-9]+-\d+/gi;

/**
 * Extract ENG-XXX ticket keys from text, deduplicated and uppercased.
 */
export function extractTicketKeys(text: string): string[] {
  const matches = text.match(TICKET_KEY_REGEX);
  if (!matches) return [];
  const unique = new Set(matches.map((k) => k.toUpperCase()));
  return Array.from(unique);
}

/**
 * Correlate GitHub PRs and deployments with Jira issue keys.
 * Extracts ticket keys from: PR branch name, PR title, PR body (first 500 chars).
 */
export function correlateGitHubWithSprint(
  issueKeys: string[],
  prs: GitHubPR[],
  deployments: GitHubDeploy[]
): Map<string, GitHubTicketCorrelation> {
  const keySet = new Set(issueKeys.map((k) => k.toUpperCase()));
  const correlations = new Map<string, GitHubTicketCorrelation>();

  // Initialize correlations for all issue keys
  for (const key of keySet) {
    correlations.set(key, {
      issueKey: key,
      pullRequests: [],
      deployments: [],
      ciStatus: null,
    });
  }

  // Match PRs to issues
  for (const pr of prs) {
    const sources = [pr.headRef, pr.title];
    // Body is already trimmed in activity.ts, but be safe
    const keysFound = new Set<string>();

    for (const source of sources) {
      if (!source) continue;
      for (const key of extractTicketKeys(source)) {
        if (keySet.has(key)) {
          keysFound.add(key);
        }
      }
    }

    for (const key of keysFound) {
      const corr = correlations.get(key);
      if (corr) {
        // Avoid duplicates
        if (!corr.pullRequests.some((p) => p.url === pr.url)) {
          corr.pullRequests.push(pr);
        }

        // Update CI status from PR checks
        if (pr.checksConclusion) {
          if (pr.checksConclusion === "failure") {
            corr.ciStatus = "failure";
          } else if (corr.ciStatus !== "failure") {
            corr.ciStatus = pr.checksConclusion;
          }
        }
      }
    }
  }

  // Match deployments to issues via ref (branch name)
  for (const deploy of deployments) {
    const keysInRef = extractTicketKeys(deploy.ref);
    for (const key of keysInRef) {
      if (keySet.has(key)) {
        const corr = correlations.get(key);
        if (corr) {
          corr.deployments.push(deploy);
        }
      }
    }
  }

  return correlations;
}
