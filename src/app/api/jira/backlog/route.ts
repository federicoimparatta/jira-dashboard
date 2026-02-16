import { NextResponse } from "next/server";
import { fetchBacklogIssues, fetchBacklogIssuesForBoard } from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import { scoreBacklogHealth } from "@/lib/scoring/backlog-health";

export const revalidate = 1800; // 30 minutes ISR TTL
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("board");

    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = getIssueFields(spField);

    let issues;

    // If board ID is specified, fetch for that board only
    if (boardId) {
      issues = await fetchBacklogIssuesForBoard(boardId, fields);
    } else {
      // Fetch backlog from all boards in parallel
      const backlogResults = await Promise.allSettled(
        config.boardIds.map((id) => fetchBacklogIssuesForBoard(id, fields))
      );

      // Log warnings for failed boards
      backlogResults.forEach((result, idx) => {
        if (result.status === "rejected") {
          console.warn(`Failed to fetch backlog for board ${config.boardIds[idx]}:`, result.reason);
        }
      });

      // Merge all backlog issues from successful results
      const allBacklogIssues = backlogResults
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => (r as PromiseFulfilledResult<import("@/lib/jira/types").JiraIssue[]>).value);

      // Deduplicate issues by ID (in case boards share issues)
      const uniqueIssuesMap = new Map();
      for (const issue of allBacklogIssues) {
        if (!uniqueIssuesMap.has(issue.id)) {
          uniqueIssuesMap.set(issue.id, issue);
        }
      }
      issues = Array.from(uniqueIssuesMap.values());
    }

    const backlogData = scoreBacklogHealth(issues, {
      staleDays: config.staleDays,
      zombieDays: config.zombieDays,
      storyPointsField: spField,
      avgVelocity: null, // Will be populated from Postgres in Phase 2
    });

    const response = {
      healthScore: backlogData.healthScore,
      dimensions: backlogData.dimensions,
      alerts: backlogData.alerts,
      stats: {
        totalItems: backlogData.totalItems,
        estimatedItems: backlogData.estimatedItems,
        staleItems: backlogData.staleItems,
        zombieItems: backlogData.zombieItems,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Backlog API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch backlog data" },
      { status: 500 }
    );
  }
}
