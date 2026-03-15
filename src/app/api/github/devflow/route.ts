import { NextResponse } from "next/server";
import { isGitHubConfigured } from "@/lib/github/config";
import { getDevFlowData } from "@/lib/github/activity";
import { getConfig } from "@/lib/jira/config";
import { fetchSprintsForBoard, fetchSprintIssues } from "@/lib/jira/client";
import { getIssueFields } from "@/lib/jira/fields";

export const revalidate = 300; // 5 minutes ISR TTL
export const maxDuration = 300;

export async function GET() {
  try {
    if (!isGitHubConfigured()) {
      return NextResponse.json(
        { error: "GitHub integration not configured. Set GITHUB_TOKEN and GITHUB_ORG environment variables." },
        { status: 200 }
      );
    }

    const config = getConfig();
    const fields = getIssueFields(config.storyPointsField);

    // Fetch active sprint issues from all boards
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

    const data = await getDevFlowData(allIssueKeys, inProgressKeys);

    return NextResponse.json(data);
  } catch (error) {
    console.error("DevFlow API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dev flow data" },
      { status: 500 }
    );
  }
}
