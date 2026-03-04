import { createSSEStream, ProgressEvent } from "@/lib/streaming/create-stream";
import { getActiveSprintData, getActiveSprintDataForBoard, getOverviewSprintData, computeCycleTimes } from "@/lib/jira/sprint";
import { getConfig } from "@/lib/jira/config";
import { fetchBoardName } from "@/lib/jira/client";
import type { OverviewSprintResponse } from "@/lib/jira/types";

export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("board");

  return createSSEStream(async (onProgress: (e: ProgressEvent) => void) => {
    const config = await getConfig();

    onProgress({ stage: "init", message: "Connecting to Jira...", percent: 0 });

    // Overview mode
    if (boardId === "all" && config.boardIds.length > 1) {
      onProgress({ stage: "boards", message: "Fetching board names...", percent: 5 });

      const boardNames = new Map<string, string>();
      for (let i = 0; i < config.boardIds.length; i++) {
        const id = config.boardIds[i];
        boardNames.set(id, await fetchBoardName(id));
        onProgress({
          stage: "boards",
          message: `Fetching board ${i + 1} of ${config.boardIds.length}...`,
          percent: 5 + (15 * (i + 1)) / config.boardIds.length,
        });
      }

      onProgress({ stage: "sprints", message: "Loading sprint data for all boards...", percent: 20 });

      const overviewData = await getOverviewSprintData(boardNames);
      if (!overviewData) {
        return { error: "No active sprints found" };
      }

      onProgress({ stage: "cycle_times", message: "Computing cycle times...", percent: 60 });

      const allIssuesMap = new Map<string, (typeof overviewData.boards)[0]["sprintData"]["issues"][0]>();
      for (const board of overviewData.boards) {
        for (const issue of board.sprintData.issues) {
          if (!allIssuesMap.has(issue.id)) allIssuesMap.set(issue.id, issue);
        }
      }
      const { avgCycleTime, avgLeadTime } = await computeCycleTimes(
        Array.from(allIssuesMap.values())
      );

      onProgress({ stage: "building", message: "Building dashboard...", percent: 90 });

      const wipMap: Record<string, { count: number; points: number }> = {};
      let unassignedCount = 0;
      for (const board of overviewData.boards) {
        for (const [name, wip] of Object.entries(board.sprintData.wipPerAssignee)) {
          if (!wipMap[name]) wipMap[name] = { count: 0, points: 0 };
          wipMap[name].count += wip.count;
          wipMap[name].points += wip.points;
        }
        unassignedCount += board.sprintData.unassignedCount;
      }

      const boards = overviewData.boards.map((b) => ({
        boardId: b.boardId,
        boardName: b.boardName,
        sprint: {
          id: b.sprintData.sprint.id,
          name: b.sprintData.sprint.name,
          state: b.sprintData.sprint.state,
          startDate: b.sprintData.sprint.startDate,
          endDate: b.sprintData.sprint.endDate,
          goal: b.sprintData.sprint.goal,
        },
        progress: {
          totalPoints: b.sprintData.totalPoints,
          completedPoints: b.sprintData.completedPoints,
          inProgressPoints: b.sprintData.inProgressPoints,
          todoPoints: b.sprintData.todoPoints,
          completionRate: b.sprintData.completionRate,
        },
        issueCount: {
          total: b.sprintData.issues.length,
          done: b.sprintData.issues.filter((i) => i.fields.status.statusCategory.key === "done").length,
          inProgress: b.sprintData.issues.filter((i) => i.fields.status.statusCategory.key === "indeterminate").length,
          todo: b.sprintData.issues.filter((i) => i.fields.status.statusCategory.key === "new").length,
        },
        blockers: b.sprintData.blockers.map((bl) => ({
          key: bl.key,
          summary: bl.fields.summary,
          assignee: bl.fields.assignee?.displayName || "Unassigned",
          status: bl.fields.status.name,
        })),
      }));

      const totalPoints = boards.reduce((s, b) => s + b.progress.totalPoints, 0);
      const completedPoints = boards.reduce((s, b) => s + b.progress.completedPoints, 0);
      const inProgressPoints = boards.reduce((s, b) => s + b.progress.inProgressPoints, 0);
      const todoPoints = boards.reduce((s, b) => s + b.progress.todoPoints, 0);

      const scopeChange = {
        added: overviewData.boards.reduce((s, b) => s + b.sprintData.scopeChange.added, 0),
        removed: overviewData.boards.reduce((s, b) => s + b.sprintData.scopeChange.removed, 0),
        net: overviewData.boards.reduce((s, b) => s + b.sprintData.scopeChange.net, 0),
      };

      const allBlockers = overviewData.boards.flatMap((b) =>
        b.sprintData.blockers.map((bl) => ({
          key: bl.key,
          summary: bl.fields.summary,
          assignee: bl.fields.assignee?.displayName || "Unassigned",
          status: bl.fields.status.name,
          boardName: b.boardName,
        }))
      );

      const response: OverviewSprintResponse = {
        mode: "overview",
        boards,
        aggregate: {
          totalPoints,
          completedPoints,
          inProgressPoints,
          todoPoints,
          completionRate: totalPoints > 0 ? completedPoints / totalPoints : 0,
          totalIssues: boards.reduce((s, b) => s + b.issueCount.total, 0),
          totalDone: boards.reduce((s, b) => s + b.issueCount.done, 0),
          totalInProgress: boards.reduce((s, b) => s + b.issueCount.inProgress, 0),
          totalTodo: boards.reduce((s, b) => s + b.issueCount.todo, 0),
          avgCycleTime,
          avgLeadTime,
          scopeChange,
        },
        wipPerAssignee: wipMap,
        unassignedCount,
        blockers: allBlockers,
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      };

      return response;
    }

    // Single board
    onProgress({ stage: "sprint", message: "Loading sprint data...", percent: 10 });

    const sprintData = boardId
      ? await getActiveSprintDataForBoard(boardId)
      : await getActiveSprintData();

    if (!sprintData) {
      return { error: "No active sprint found" };
    }

    onProgress({ stage: "cycle_times", message: "Computing cycle times...", percent: 60 });

    const { avgCycleTime, avgLeadTime } = await computeCycleTimes(sprintData.issues);

    onProgress({ stage: "building", message: "Building dashboard...", percent: 90 });

    return {
      sprint: {
        id: sprintData.sprint.id,
        name: sprintData.sprint.name,
        state: sprintData.sprint.state,
        startDate: sprintData.sprint.startDate,
        endDate: sprintData.sprint.endDate,
        goal: sprintData.sprint.goal,
      },
      progress: {
        totalPoints: sprintData.totalPoints,
        completedPoints: sprintData.completedPoints,
        inProgressPoints: sprintData.inProgressPoints,
        todoPoints: sprintData.todoPoints,
        completionRate: sprintData.completionRate,
      },
      burndown: sprintData.burndown,
      blockers: sprintData.blockers.map((b) => ({
        key: b.key,
        summary: b.fields.summary,
        assignee: b.fields.assignee?.displayName || "Unassigned",
        status: b.fields.status.name,
      })),
      wipPerAssignee: sprintData.wipPerAssignee,
      unassignedCount: sprintData.unassignedCount,
      scopeChange: sprintData.scopeChange,
      cycleTime: avgCycleTime,
      leadTime: avgLeadTime,
      issueCount: {
        total: sprintData.issues.length,
        done: sprintData.issues.filter((i) => i.fields.status.statusCategory.key === "done").length,
        inProgress: sprintData.issues.filter((i) => i.fields.status.statusCategory.key === "indeterminate").length,
        todo: sprintData.issues.filter((i) => i.fields.status.statusCategory.key === "new").length,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      fetchedAt: new Date().toISOString(),
    };
  });
}
