import {
  fetchSprintsForBoard,
  fetchSprintIssues,
  fetchBoardName,
  getStoryPoints,
  discoverStoryPointsField,
} from "./client";
import { getConfig } from "./config";
import { getIssueFields } from "./fields";
import { JiraSprint, SprintVelocityPoint, VelocityResponse } from "./types";

/**
 * Fetch historical sprint velocity data from the Jira API.
 * Fetches closed sprints per board, then computes committed vs delivered points.
 */
export async function getVelocityData(): Promise<VelocityResponse> {
  const config = getConfig();
  const spField =
    config.storyPointsField || (await discoverAndCacheField());
  const fields = getIssueFields(spField);

  // Fetch all boards in parallel
  const boardResults = await Promise.allSettled(
    config.boardIds.map(async (boardId) => {
      const [boardName, closedSprints] = await Promise.all([
        fetchBoardName(boardId),
        fetchSprintsForBoard(boardId, "closed"),
      ]);

      // Also fetch active sprint to include current sprint progress
      const activeSprints = await fetchSprintsForBoard(boardId, "active");

      // Sort by end date descending, take last 20 sprints max
      const allSprints = [...closedSprints, ...activeSprints]
        .filter((s) => s.startDate) // must have start date
        .sort((a, b) => {
          const dateA = a.completeDate || a.endDate || "";
          const dateB = b.completeDate || b.endDate || "";
          return dateB.localeCompare(dateA);
        })
        .slice(0, 20);

      // Fetch issues for each sprint (limited concurrency to avoid rate limits)
      const sprintData: SprintVelocityPoint[] = [];
      for (const sprint of allSprints) {
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

            // Track scope additions (issues created after sprint start)
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

      return {
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
    })
  );

  // Collect successful boards
  const boards = boardResults
    .filter(
      (r): r is PromiseFulfilledResult<{
        boardId: string;
        boardName: string;
        sprints: SprintVelocityPoint[];
        avgVelocity: number;
        avgCommitment: number;
        deliveryRate: number;
      }> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  // Log failures
  boardResults.forEach((result, idx) => {
    if (result.status === "rejected") {
      console.warn(
        `Failed to fetch velocity for board ${config.boardIds[idx]}:`,
        result.reason
      );
    }
  });

  // Merge all sprints for the combined view, sorted chronologically
  const allSprints = boards
    .flatMap((b) => b.sprints)
    .sort((a, b) => a.sprintEndDate.localeCompare(b.sprintEndDate));

  return {
    boards,
    allSprints,
    fetchedAt: new Date().toISOString(),
  };
}

let cachedField: string | null = null;
async function discoverAndCacheField(): Promise<string | null> {
  if (cachedField) return cachedField;
  cachedField = await discoverStoryPointsField();
  return cachedField;
}
