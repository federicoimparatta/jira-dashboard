import {
  fetchSprintsForBoard,
  fetchSprintIssues,
  fetchBoardName,
  getStoryPoints,
  discoverStoryPointsField,
} from "./client";
import { getConfig } from "./config";
import { getIssueFields } from "./fields";
import { SprintVelocityPoint, VelocityResponse } from "./types";

export interface VelocityProgress {
  stage: "init" | "board_start" | "sprint" | "board_done" | "complete";
  message: string;
  boardIndex?: number;
  boardCount?: number;
  boardName?: string;
  sprintIndex?: number;
  sprintCount?: number;
  sprintName?: string;
  /** 0-100 overall progress percentage */
  percent: number;
}

/**
 * Fetch historical sprint velocity data from the Jira API.
 * Fetches closed sprints per board, then computes committed vs delivered points.
 * Accepts an optional progress callback for streaming progress to the client.
 */
export async function getVelocityData(
  onProgress?: (event: VelocityProgress) => void
): Promise<VelocityResponse> {
  const config = getConfig();

  onProgress?.({
    stage: "init",
    message: "Discovering story points field...",
    percent: 0,
  });

  const spField =
    config.storyPointsField || (await discoverAndCacheField());
  const fields = getIssueFields(spField);

  const boardCount = config.boardIds.length;

  // Process boards sequentially so we can report progress per board
  // (parallel would be faster but prevents meaningful progress reporting)
  const allBoardResults: {
    boardId: string;
    boardName: string;
    sprints: SprintVelocityPoint[];
    avgVelocity: number;
    avgCommitment: number;
    deliveryRate: number;
  }[] = [];

  for (let boardIdx = 0; boardIdx < boardCount; boardIdx++) {
    const boardId = config.boardIds[boardIdx];
    const boardBasePercent = (boardIdx / boardCount) * 100;
    const boardSlice = 100 / boardCount;

    try {
      onProgress?.({
        stage: "board_start",
        message: `Fetching sprints for board ${boardIdx + 1} of ${boardCount}...`,
        boardIndex: boardIdx,
        boardCount,
        percent: Math.round(boardBasePercent),
      });

      const [boardName, closedSprints] = await Promise.all([
        fetchBoardName(boardId),
        fetchSprintsForBoard(boardId, "closed"),
      ]);

      const activeSprints = await fetchSprintsForBoard(boardId, "active");

      // Sort by end date descending, take last 20 sprints max
      const allSprints = [...closedSprints, ...activeSprints]
        .filter((s) => s.startDate)
        .sort((a, b) => {
          const dateA = a.completeDate || a.endDate || "";
          const dateB = b.completeDate || b.endDate || "";
          return dateB.localeCompare(dateA);
        })
        .slice(0, 20);

      const sprintCount = allSprints.length;

      onProgress?.({
        stage: "board_start",
        message: `Loading ${sprintCount} sprints from ${boardName}...`,
        boardIndex: boardIdx,
        boardCount,
        boardName,
        sprintCount,
        percent: Math.round(boardBasePercent + boardSlice * 0.1),
      });

      // Fetch issues for each sprint sequentially (rate limit protection)
      const sprintData: SprintVelocityPoint[] = [];
      for (let sprintIdx = 0; sprintIdx < sprintCount; sprintIdx++) {
        const sprint = allSprints[sprintIdx];

        onProgress?.({
          stage: "sprint",
          message: `${boardName}: ${sprint.name} (${sprintIdx + 1}/${sprintCount})`,
          boardIndex: boardIdx,
          boardCount,
          boardName,
          sprintIndex: sprintIdx,
          sprintCount,
          sprintName: sprint.name,
          percent: Math.round(
            boardBasePercent + boardSlice * (0.1 + 0.85 * (sprintIdx / sprintCount))
          ),
        });

        try {
          const issues = await fetchSprintIssues(sprint.id, fields);

          let committedPoints = 0;
          let completedPoints = 0;
          let doneCount = 0;
          let scopeAdded = 0;

          const sprintStart = sprint.startDate
            ? new Date(sprint.startDate)
            : null;

          for (const issue of issues) {
            const pts = spField
              ? getStoryPoints(issue, spField)
              : 0;
            committedPoints += pts;

            const cat = issue.fields.status.statusCategory.key;
            if (cat === "done") {
              completedPoints += pts;
              doneCount++;
            }

            if (sprintStart) {
              const created = new Date(issue.fields.created);
              if (created > sprintStart) {
                scopeAdded++;
              }
            }
          }

          sprintData.push({
            sprintId: sprint.id,
            sprintName: sprint.name,
            boardId,
            boardName,
            committedPoints,
            completedPoints,
            sprintStartDate: sprint.startDate || "",
            sprintEndDate: sprint.completeDate || sprint.endDate || "",
            issueCount: issues.length,
            doneCount,
            scopeAdded,
          });
        } catch (err) {
          console.warn(
            `Failed to fetch issues for sprint ${sprint.id} (${sprint.name}):`,
            err
          );
        }
      }

      // Sort chronologically (oldest first) for charting
      sprintData.sort((a, b) =>
        a.sprintEndDate.localeCompare(b.sprintEndDate)
      );

      const totalCompleted = sprintData.reduce(
        (s, v) => s + v.completedPoints,
        0
      );
      const totalCommitted = sprintData.reduce(
        (s, v) => s + v.committedPoints,
        0
      );
      const count = sprintData.length || 1;

      const boardResult = {
        boardId,
        boardName,
        sprints: sprintData,
        avgVelocity: Math.round((totalCompleted / count) * 10) / 10,
        avgCommitment: Math.round((totalCommitted / count) * 10) / 10,
        deliveryRate:
          totalCommitted > 0
            ? Math.round((totalCompleted / totalCommitted) * 1000) / 10
            : 0,
      };

      allBoardResults.push(boardResult);

      onProgress?.({
        stage: "board_done",
        message: `Finished ${boardName} (${sprintData.length} sprints)`,
        boardIndex: boardIdx,
        boardCount,
        boardName,
        percent: Math.round(boardBasePercent + boardSlice),
      });
    } catch (err) {
      console.warn(
        `Failed to fetch velocity for board ${boardId}:`,
        err
      );
    }
  }

  // Merge all sprints for the combined view, sorted chronologically
  const allSprints = allBoardResults
    .flatMap((b) => b.sprints)
    .sort((a, b) => a.sprintEndDate.localeCompare(b.sprintEndDate));

  const result: VelocityResponse = {
    boards: allBoardResults,
    allSprints,
    fetchedAt: new Date().toISOString(),
  };

  onProgress?.({
    stage: "complete",
    message: "Done",
    percent: 100,
  });

  return result;
}

let cachedField: string | null = null;
async function discoverAndCacheField(): Promise<string | null> {
  if (cachedField) return cachedField;
  cachedField = await discoverStoryPointsField();
  return cachedField;
}
