import { NextResponse } from "next/server";
import {
  fetchAllIssues,
  fetchBoardEpics,
  fetchBoardName,
  getStoryPoints,
} from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import {
  JiraIssue,
  EpicProgress,
  ChildIssue,
  BoardGroup,
} from "@/lib/jira/types";

export const revalidate = 600; // 10 minutes ISR TTL
export const maxDuration = 300;

export async function GET() {
  try {
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = [...getIssueFields(spField), "parent"];

    // Step 1: Fetch all non-done epics + board mappings in parallel
    const [epics, ...boardResults] = await Promise.all([
      fetchAllIssues(
        `issuetype = Epic AND statusCategory != Done AND project = ${config.projectKey} ORDER BY priority ASC, updated DESC`,
        ["summary", "status", "assignee", "priority", "issuetype", "updated"]
      ),
      ...config.boardIds.map(async (boardId) => {
        const [boardEpics, boardName] = await Promise.all([
          fetchBoardEpics(boardId),
          fetchBoardName(boardId),
        ]);
        return { boardId, boardName, epicKeys: boardEpics.map((e) => e.key) };
      }),
    ]);

    if (epics.length === 0) {
      return NextResponse.json({
        boards: config.boardIds.map((id, i) => ({
          boardId: id,
          boardName: boardResults[i]?.boardName || `Board ${id}`,
          epics: [],
          summary: { totalEpics: 0, totalChildIssues: 0, totalDoneChildIssues: 0, avgCompletionRate: 0 },
        })),
        ungrouped: [],
        summary: { totalEpics: 0, avgCompletionRate: 0, totalChildIssues: 0, totalDoneChildIssues: 0 },
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Build epicKey -> boardId[] mapping
    const epicBoardMap = new Map<string, string[]>();
    for (const { boardId, epicKeys } of boardResults) {
      for (const key of epicKeys) {
        const existing = epicBoardMap.get(key) || [];
        existing.push(boardId);
        epicBoardMap.set(key, existing);
      }
    }

    // Step 2: Fetch all child issues in batches
    const BATCH_SIZE = 40;
    const epicKeys = epics.map((e) => e.key);
    const allChildren: JiraIssue[] = [];

    for (let i = 0; i < epicKeys.length; i += BATCH_SIZE) {
      const batch = epicKeys.slice(i, i + BATCH_SIZE);
      const keyList = batch.map((k) => `"${k}"`).join(", ");
      const childJql = `parent in (${keyList}) AND project = ${config.projectKey}`;
      const children = await fetchAllIssues(childJql, fields);
      allChildren.push(...children);
    }

    // Step 3: Group children by epic parent key
    const childrenByEpic = new Map<string, JiraIssue[]>();
    for (const child of allChildren) {
      const parentKey =
        (child.fields as Record<string, unknown>).parent != null
          ? ((child.fields as Record<string, unknown>).parent as { key: string }).key
          : null;
      if (parentKey) {
        const existing = childrenByEpic.get(parentKey) || [];
        existing.push(child);
        childrenByEpic.set(parentKey, existing);
      }
    }

    // Step 4: Build per-epic progress with children and board mapping
    const epicProgressList: EpicProgress[] = epics.map((epic) => {
      const rawChildren = childrenByEpic.get(epic.key) || [];

      const childIssues = { total: rawChildren.length, done: 0, inProgress: 0, todo: 0 };
      const storyPoints = { total: 0, done: 0, inProgress: 0, todo: 0 };
      const childList: ChildIssue[] = [];

      for (const child of rawChildren) {
        const sp = getStoryPoints(child, spField);
        storyPoints.total += sp;
        const category = child.fields.status.statusCategory.key;
        if (category === "done") {
          childIssues.done++;
          storyPoints.done += sp;
        } else if (category === "indeterminate") {
          childIssues.inProgress++;
          storyPoints.inProgress += sp;
        } else {
          childIssues.todo++;
          storyPoints.todo += sp;
        }

        childList.push({
          key: child.key,
          summary: child.fields.summary,
          status: {
            name: child.fields.status.name,
            categoryKey: child.fields.status.statusCategory.key,
          },
          assignee: child.fields.assignee?.displayName || null,
          storyPoints: sp,
          issuetype: child.fields.issuetype.name,
          priority: {
            name: child.fields.priority.name,
            id: child.fields.priority.id,
          },
        });
      }

      return {
        key: epic.key,
        summary: epic.fields.summary,
        status: {
          name: epic.fields.status.name,
          categoryKey: epic.fields.status.statusCategory.key,
        },
        assignee: epic.fields.assignee?.displayName || null,
        priority: {
          name: epic.fields.priority.name,
          id: epic.fields.priority.id,
        },
        childIssues,
        storyPoints,
        updated: epic.fields.updated,
        children: childList,
        boardIds: epicBoardMap.get(epic.key) || [],
      };
    });

    // Step 5: Group into boards
    const boardNameMap = new Map<string, string>();
    for (const { boardId, boardName } of boardResults) {
      boardNameMap.set(boardId, boardName);
    }

    const boards: BoardGroup[] = config.boardIds.map((boardId) => {
      const boardEpics = epicProgressList.filter((e) => e.boardIds.includes(boardId));
      const totalChild = boardEpics.reduce((s, e) => s + e.childIssues.total, 0);
      const totalDone = boardEpics.reduce((s, e) => s + e.childIssues.done, 0);
      return {
        boardId,
        boardName: boardNameMap.get(boardId) || `Board ${boardId}`,
        epics: boardEpics,
        summary: {
          totalEpics: boardEpics.length,
          totalChildIssues: totalChild,
          totalDoneChildIssues: totalDone,
          avgCompletionRate: totalChild > 0 ? totalDone / totalChild : 0,
        },
      };
    });

    const ungrouped = epicProgressList.filter((e) => e.boardIds.length === 0);

    // Step 6: Global summary
    const totalChildIssues = epicProgressList.reduce((s, e) => s + e.childIssues.total, 0);
    const totalDoneChildIssues = epicProgressList.reduce((s, e) => s + e.childIssues.done, 0);
    const avgCompletionRate =
      totalChildIssues > 0 ? totalDoneChildIssues / totalChildIssues : 0;

    return NextResponse.json({
      boards,
      ungrouped,
      summary: {
        totalEpics: epicProgressList.length,
        avgCompletionRate,
        totalChildIssues,
        totalDoneChildIssues,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Epics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch epics data" },
      { status: 500 }
    );
  }
}
