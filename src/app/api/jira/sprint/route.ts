import { NextResponse } from "next/server";
import { getActiveSprintData, getActiveSprintDataForBoard, getOverviewSprintData, computeCycleTimes } from "@/lib/jira/sprint";
import { getConfig } from "@/lib/jira/config";
import { fetchBoardName } from "@/lib/jira/client";
import type { OverviewSprintResponse } from "@/lib/jira/types";

export const revalidate = 300; // 5 minutes ISR TTL
export const maxDuration = 300; // Fluid Compute

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("board");
    const config = getConfig();

    // "All Boards" overview mode
    if (boardId === "all") {
      // Single board? Fall back to normal single-board view
      if (config.boardIds.length === 1) {
        return buildSingleBoardResponse(config.boardIds[0]);
      }

      // Fetch board names in parallel
      const boardNames = new Map<string, string>();
      await Promise.all(
        config.boardIds.map(async (id) => {
          boardNames.set(id, await fetchBoardName(id));
        })
      );

      const overviewData = await getOverviewSprintData(boardNames);
      if (!overviewData) {
        return NextResponse.json(
          { error: "No active sprints found" },
          { status: 404 }
        );
      }

      // Deduplicate issues across boards for cycle time computation
      const allIssuesMap = new Map<string, (typeof overviewData.boards)[0]["sprintData"]["issues"][0]>();
      for (const board of overviewData.boards) {
        for (const issue of board.sprintData.issues) {
          if (!allIssuesMap.has(issue.id)) {
            allIssuesMap.set(issue.id, issue);
          }
        }
      }
      const { avgCycleTime, avgLeadTime } = await computeCycleTimes(
        Array.from(allIssuesMap.values())
      );

      // Aggregate WIP across boards
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

      // Build per-board summaries
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

      // Aggregate totals
      const totalPoints = boards.reduce((s, b) => s + b.progress.totalPoints, 0);
      const completedPoints = boards.reduce((s, b) => s + b.progress.completedPoints, 0);
      const inProgressPoints = boards.reduce((s, b) => s + b.progress.inProgressPoints, 0);
      const todoPoints = boards.reduce((s, b) => s + b.progress.todoPoints, 0);
      const totalIssues = boards.reduce((s, b) => s + b.issueCount.total, 0);
      const totalDone = boards.reduce((s, b) => s + b.issueCount.done, 0);
      const totalInProgress = boards.reduce((s, b) => s + b.issueCount.inProgress, 0);
      const totalTodo = boards.reduce((s, b) => s + b.issueCount.todo, 0);

      // Aggregate scope change
      const scopeChange = {
        added: overviewData.boards.reduce((s, b) => s + b.sprintData.scopeChange.added, 0),
        removed: overviewData.boards.reduce((s, b) => s + b.sprintData.scopeChange.removed, 0),
        net: overviewData.boards.reduce((s, b) => s + b.sprintData.scopeChange.net, 0),
      };

      // Combined blockers with board name
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
          totalIssues,
          totalDone,
          totalInProgress,
          totalTodo,
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

      return NextResponse.json(response);
    }

    // Single board or default aggregated view
    return buildSingleBoardResponse(boardId || undefined);
  } catch (error) {
    console.error("Sprint API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sprint data" },
      { status: 500 }
    );
  }
}

async function buildSingleBoardResponse(boardId?: string) {
  const sprintData = boardId
    ? await getActiveSprintDataForBoard(boardId)
    : await getActiveSprintData();

  if (!sprintData) {
    return NextResponse.json(
      { error: "No active sprint found" },
      { status: 404 }
    );
  }

  const { avgCycleTime, avgLeadTime } = await computeCycleTimes(
    sprintData.issues
  );

  const response = {
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
      done: sprintData.issues.filter(
        (i) => i.fields.status.statusCategory.key === "done"
      ).length,
      inProgress: sprintData.issues.filter(
        (i) => i.fields.status.statusCategory.key === "indeterminate"
      ).length,
      todo: sprintData.issues.filter(
        (i) => i.fields.status.statusCategory.key === "new"
      ).length,
    },
    jiraBaseUrl: getConfig().jiraBaseUrl,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
