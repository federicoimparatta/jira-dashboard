import { NextResponse } from "next/server";
import {
  fetchBacklogIssuesForBoard,
  fetchBoardName,
  discoverInitiativeField,
} from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import { scoreBacklogHealth } from "@/lib/scoring/backlog-health";
import { getAvgVelocity } from "@/db/velocity";
import type { OverviewBacklogResponse, JiraIssue } from "@/lib/jira/types";

export const revalidate = 1800; // 30 minutes ISR TTL
export const maxDuration = 300;

// Cache initiative field discovery across requests within the same process
let cachedInitiativeField: string | null | undefined = undefined;

async function resolveInitiativeField(
  configField: string | null
): Promise<string | null> {
  if (configField) return configField;
  if (cachedInitiativeField !== undefined) return cachedInitiativeField;
  try {
    cachedInitiativeField = await discoverInitiativeField();
  } catch {
    cachedInitiativeField = null;
  }
  return cachedInitiativeField;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardParam = searchParams.get("board");
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";

    const initField = await resolveInitiativeField(config.initiativeField);
    const fields = getIssueFields(spField, initField);
    const avgVelocity = await getAvgVelocity();

    const scoringConfig = {
      staleDays: config.staleDays,
      zombieDays: config.zombieDays,
      storyPointsField: spField,
      initiativeField: initField,
      readyStatuses: config.readyStatuses,
      avgVelocity,
    };

    // "All Boards" overview mode
    if (boardParam === "all" && config.boardIds.length > 1) {
      const boardResults = await Promise.allSettled(
        config.boardIds.map(async (id) => {
          const [name, issues] = await Promise.all([
            fetchBoardName(id),
            fetchBacklogIssuesForBoard(id, fields),
          ]);
          return { id, name, issues };
        })
      );

      const successfulBoards = boardResults
        .filter((r) => r.status === "fulfilled")
        .map(
          (r) =>
            (
              r as PromiseFulfilledResult<{
                id: string;
                name: string;
                issues: JiraIssue[];
              }>
            ).value
        );

      // Score health per board
      const boards = successfulBoards.map((b) => {
        const health = scoreBacklogHealth(b.issues, scoringConfig);
        return {
          boardId: b.id,
          boardName: b.name,
          healthScore: health.healthScore,
          stats: {
            totalItems: health.totalItems,
            readyItems: health.readyItems,
            blockedItems: health.blockedItems,
            strategicAllocationPct: health.strategicAllocationPct,
          },
          dimensions: health.dimensions,
          alerts: health.alerts,
        };
      });

      // Aggregate: deduplicate issues across boards, then score
      const uniqueIssuesMap = new Map<string, JiraIssue>();
      for (const b of successfulBoards) {
        for (const issue of b.issues) {
          if (!uniqueIssuesMap.has(issue.id)) {
            uniqueIssuesMap.set(issue.id, issue);
          }
        }
      }
      const aggregateHealth = scoreBacklogHealth(
        Array.from(uniqueIssuesMap.values()),
        scoringConfig
      );

      const response: OverviewBacklogResponse = {
        mode: "overview",
        boards,
        aggregate: {
          healthScore: aggregateHealth.healthScore,
          totalItems: aggregateHealth.totalItems,
          readyItems: aggregateHealth.readyItems,
          blockedItems: aggregateHealth.blockedItems,
          strategicAllocationPct: aggregateHealth.strategicAllocationPct,
          dimensions: aggregateHealth.dimensions,
          alerts: aggregateHealth.alerts,
        },
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      };

      return NextResponse.json(response);
    }

    // Single board or fallback aggregate
    const boardId = boardParam === "all" ? null : boardParam;
    let issues: JiraIssue[];

    if (boardId) {
      issues = await fetchBacklogIssuesForBoard(boardId, fields);
    } else {
      const backlogResults = await Promise.allSettled(
        config.boardIds.map((id) => fetchBacklogIssuesForBoard(id, fields))
      );

      backlogResults.forEach((result, idx) => {
        if (result.status === "rejected") {
          console.warn(
            `Failed to fetch backlog for board ${config.boardIds[idx]}:`,
            result.reason
          );
        }
      });

      const allBacklogIssues = backlogResults
        .filter((r) => r.status === "fulfilled")
        .flatMap(
          (r) => (r as PromiseFulfilledResult<JiraIssue[]>).value
        );

      const uniqueIssuesMap = new Map<string, JiraIssue>();
      for (const issue of allBacklogIssues) {
        if (!uniqueIssuesMap.has(issue.id)) {
          uniqueIssuesMap.set(issue.id, issue);
        }
      }
      issues = Array.from(uniqueIssuesMap.values());
    }

    const backlogData = scoreBacklogHealth(issues, scoringConfig);

    const response = {
      healthScore: backlogData.healthScore,
      dimensions: backlogData.dimensions,
      alerts: backlogData.alerts,
      stats: {
        totalItems: backlogData.totalItems,
        readyItems: backlogData.readyItems,
        blockedItems: backlogData.blockedItems,
        strategicAllocationPct: backlogData.strategicAllocationPct,
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
