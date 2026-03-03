import { createSSEStream, ProgressEvent } from "@/lib/streaming/create-stream";
import { fetchBacklogIssuesForBoard, fetchBoardName } from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import { scoreBacklogHealth } from "@/lib/scoring/backlog-health";
import { getAvgVelocity } from "@/db/velocity";
import type { OverviewBacklogResponse, JiraIssue } from "@/lib/jira/types";

export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boardParam = searchParams.get("board");

  return createSSEStream(async (onProgress: (e: ProgressEvent) => void) => {
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = getIssueFields(spField);

    onProgress({ stage: "init", message: "Checking velocity history...", percent: 0 });
    const avgVelocity = await getAvgVelocity();

    const scoringConfig = {
      staleDays: config.staleDays,
      zombieDays: config.zombieDays,
      storyPointsField: spField,
      readyStatuses: config.readyStatuses,
      avgVelocity,
    };

    // Overview mode
    if (boardParam === "all" && config.boardIds.length > 1) {
      const successfulBoards: { id: string; name: string; issues: JiraIssue[] }[] = [];

      for (let i = 0; i < config.boardIds.length; i++) {
        const id = config.boardIds[i];
        onProgress({
          stage: "fetching",
          message: `Fetching backlog for board ${i + 1} of ${config.boardIds.length}...`,
          percent: 10 + (60 * i) / config.boardIds.length,
        });

        try {
          const [name, issues] = await Promise.all([
            fetchBoardName(id),
            fetchBacklogIssuesForBoard(id, fields),
          ]);
          successfulBoards.push({ id, name, issues });
        } catch (err) {
          console.warn(`Failed backlog for board ${id}:`, err);
        }
      }

      onProgress({ stage: "scoring", message: "Scoring backlog health...", percent: 75 });

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
          },
          dimensions: health.dimensions,
          alerts: health.alerts,
        };
      });

      onProgress({ stage: "aggregating", message: "Aggregating results...", percent: 90 });

      const uniqueIssuesMap = new Map<string, JiraIssue>();
      for (const b of successfulBoards) {
        for (const issue of b.issues) {
          if (!uniqueIssuesMap.has(issue.id)) uniqueIssuesMap.set(issue.id, issue);
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
          dimensions: aggregateHealth.dimensions,
          alerts: aggregateHealth.alerts,
        },
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      };

      return response;
    }

    // Single board
    onProgress({ stage: "fetching", message: "Fetching backlog items...", percent: 10 });

    const boardId = boardParam === "all" ? null : boardParam;
    let issues: JiraIssue[];

    if (boardId) {
      issues = await fetchBacklogIssuesForBoard(boardId, fields);
    } else {
      const allIssues: JiraIssue[] = [];
      for (let i = 0; i < config.boardIds.length; i++) {
        onProgress({
          stage: "fetching",
          message: `Fetching backlog for board ${i + 1} of ${config.boardIds.length}...`,
          percent: 10 + (50 * i) / config.boardIds.length,
        });
        try {
          const boardIssues = await fetchBacklogIssuesForBoard(config.boardIds[i], fields);
          allIssues.push(...boardIssues);
        } catch (err) {
          console.warn(`Failed backlog for board ${config.boardIds[i]}:`, err);
        }
      }
      const uniqueMap = new Map<string, JiraIssue>();
      for (const issue of allIssues) {
        if (!uniqueMap.has(issue.id)) uniqueMap.set(issue.id, issue);
      }
      issues = Array.from(uniqueMap.values());
    }

    onProgress({ stage: "scoring", message: "Scoring backlog health...", percent: 80 });

    const backlogData = scoreBacklogHealth(issues, scoringConfig);

    return {
      healthScore: backlogData.healthScore,
      dimensions: backlogData.dimensions,
      alerts: backlogData.alerts,
      stats: {
        totalItems: backlogData.totalItems,
        readyItems: backlogData.readyItems,
        blockedItems: backlogData.blockedItems,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      fetchedAt: new Date().toISOString(),
    };
  });
}
