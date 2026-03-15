import { createSSEStream } from "@/lib/streaming/create-stream";
import { isGitHubConfigured } from "@/lib/github/config";
import { getDevFlowData } from "@/lib/github/activity";
import { getConfig } from "@/lib/jira/config";
import { fetchSprintsForBoard, fetchSprintIssues } from "@/lib/jira/client";
import { getIssueFields } from "@/lib/jira/fields";

export const maxDuration = 300;

export async function GET() {
  return createSSEStream(async (onProgress) => {
    if (!isGitHubConfigured()) {
      return {
        error: "GitHub integration not configured. Set GITHUB_TOKEN and GITHUB_ORG environment variables.",
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

    onProgress({
      stage: "init",
      message: "Initializing...",
      percent: 0,
    });

    const config = getConfig();
    const fields = getIssueFields(config.storyPointsField);

    // Fetch active sprint issues from all boards
    onProgress({
      stage: "sprint",
      message: "Loading sprint issues from Jira...",
      percent: 10,
    });

    const allIssueKeys: string[] = [];
    const inProgressKeys = new Set<string>();

    for (const boardId of config.boardIds) {
      try {
        const sprints = await fetchSprintsForBoard(boardId, "active");
        if (sprints.length === 0) continue;

        const issues = await fetchSprintIssues(sprints[0].id, fields);
        for (const issue of issues) {
          if (!allIssueKeys.includes(issue.key)) {
            allIssueKeys.push(issue.key);
          }
          if (issue.fields.status.statusCategory.key === "indeterminate") {
            inProgressKeys.add(issue.key);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch sprint for board ${boardId}:`, err);
      }
    }

    // Get dev flow data with progress callbacks
    const data = await getDevFlowData(
      allIssueKeys,
      inProgressKeys,
      (stage, percent, message) => {
        onProgress({ stage, message, percent });
      }
    );

    return data;
  });
}
