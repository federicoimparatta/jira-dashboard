import { createSSEStream, ProgressEvent } from "@/lib/streaming/create-stream";
import {
  fetchAllIssues,
  fetchBoardEpics,
  fetchBoardName,
  getStoryPoints,
  discoverDateFields,
} from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import type { JiraIssue, EpicProgress, ChildIssue, BoardGroup } from "@/lib/jira/types";

export const maxDuration = 300;

export async function GET() {
  return createSSEStream(async (onProgress: (e: ProgressEvent) => void) => {
    const config = await getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = [...getIssueFields(spField), "parent"];

    // Discover date fields
    let startDateField = config.startDateField;
    let endDateField = config.endDateField;
    if (!startDateField || !endDateField) {
      const discovered = await discoverDateFields();
      startDateField = startDateField || discovered.startDateField;
      endDateField = endDateField || discovered.endDateField;
    }

    const epicFields = [
      "summary", "status", "assignee", "priority", "issuetype", "updated", "parent", "description",
      ...(startDateField ? [startDateField] : []),
      ...(endDateField ? [endDateField] : []),
    ];

    onProgress({ stage: "epics", message: "Fetching active epics...", percent: 5 });

    const [epics, ...boardResults] = await Promise.all([
      fetchAllIssues(
        `issuetype = Epic AND statusCategory != Done AND project = ${config.projectKey} ORDER BY priority ASC, updated DESC`,
        epicFields
      ),
      ...config.boardIds.map(async (boardId) => {
        const [boardEpics, boardName] = await Promise.all([
          fetchBoardEpics(boardId),
          fetchBoardName(boardId),
        ]);
        return { boardId, boardName, epicKeys: boardEpics.map((e) => e.key) };
      }),
    ]);

    onProgress({
      stage: "epics",
      message: `Found ${epics.length} active epics`,
      percent: 25,
      detail: `Across ${config.boardIds.length} board(s)`,
    });

    if (epics.length === 0) {
      return {
        boards: config.boardIds.map((id, i) => ({
          boardId: id,
          boardName: boardResults[i]?.boardName || `Board ${id}`,
          epics: [],
          summary: { totalEpics: 0, totalChildIssues: 0, totalDoneChildIssues: 0, avgCompletionRate: 0, readyEpics: 0 },
        })),
        ungrouped: [],
        summary: { totalEpics: 0, avgCompletionRate: 0, totalChildIssues: 0, totalDoneChildIssues: 0 },
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      };
    }

    const epicBoardMap = new Map<string, string[]>();
    for (const { boardId, epicKeys } of boardResults) {
      for (const key of epicKeys) {
        const existing = epicBoardMap.get(key) || [];
        existing.push(boardId);
        epicBoardMap.set(key, existing);
      }
    }

    // Fetch child issues in batches with progress
    const BATCH_SIZE = 40;
    const epicKeys = epics.map((e) => e.key);
    const totalBatches = Math.ceil(epicKeys.length / BATCH_SIZE);
    const allChildren: JiraIssue[] = [];

    for (let i = 0; i < epicKeys.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      onProgress({
        stage: "children",
        message: `Loading child issues (batch ${batchNum}/${totalBatches})...`,
        percent: 25 + (55 * batchNum) / totalBatches,
        detail: `${allChildren.length} issues loaded so far`,
      });

      const batch = epicKeys.slice(i, i + BATCH_SIZE);
      const keyList = batch.map((k) => `"${k}"`).join(", ");
      const childJql = `parent in (${keyList}) AND project = ${config.projectKey}`;
      const children = await fetchAllIssues(childJql, fields);
      allChildren.push(...children);
    }

    onProgress({ stage: "building", message: "Building epic progress...", percent: 85 });

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

    const epicProgressList: EpicProgress[] = epics.map((epic) => {
      const rawChildren = childrenByEpic.get(epic.key) || [];
      const childIssues = { total: rawChildren.length, done: 0, inProgress: 0, todo: 0 };
      const storyPoints = { total: 0, done: 0, inProgress: 0, todo: 0 };
      const childList: ChildIssue[] = [];

      for (const child of rawChildren) {
        const sp = getStoryPoints(child, spField);
        storyPoints.total += sp;
        const category = child.fields.status.statusCategory.key;
        if (category === "done") { childIssues.done++; storyPoints.done += sp; }
        else if (category === "indeterminate") { childIssues.inProgress++; storyPoints.inProgress += sp; }
        else { childIssues.todo++; storyPoints.todo += sp; }
        childList.push({
          key: child.key,
          summary: child.fields.summary,
          status: { name: child.fields.status.name, categoryKey: child.fields.status.statusCategory.key },
          assignee: child.fields.assignee?.displayName || null,
          storyPoints: sp,
          issuetype: child.fields.issuetype.name,
          priority: { name: child.fields.priority.name, id: child.fields.priority.id },
        });
      }

      const epicParent = epic.fields.parent as { key: string; fields?: { summary?: string } } | undefined;

      const criteria = {
        hasDescription: Boolean(epic.fields.description),
        childrenEstimated: rawChildren.length > 0 && rawChildren.every((c) => getStoryPoints(c, spField) > 0),
        hasPriority: epic.fields.priority.name !== "Medium",
        hasInitiative: Boolean(epicParent?.key),
        hasAssignee: Boolean(epic.fields.assignee),
        hasChildren: rawChildren.length > 0,
      };
      const score = Object.values(criteria).filter(Boolean).length;

      return {
        key: epic.key,
        summary: epic.fields.summary,
        status: { name: epic.fields.status.name, categoryKey: epic.fields.status.statusCategory.key },
        assignee: epic.fields.assignee?.displayName || null,
        priority: { name: epic.fields.priority.name, id: epic.fields.priority.id },
        childIssues,
        storyPoints,
        updated: epic.fields.updated,
        children: childList,
        boardIds: epicBoardMap.get(epic.key) || [],
        readiness: { score, criteria },
        startDate: startDateField
          ? (epic.fields[startDateField] as string | null) ?? null
          : null,
        endDate: endDateField
          ? (epic.fields[endDateField] as string | null) ?? null
          : null,
        ...(epicParent?.key && {
          initiative: { key: epicParent.key, summary: epicParent.fields?.summary || epicParent.key },
        }),
      };
    });

    onProgress({ stage: "grouping", message: "Grouping by board...", percent: 92 });

    const boardNameMap = new Map<string, string>();
    for (const { boardId, boardName } of boardResults) boardNameMap.set(boardId, boardName);

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
    const totalChildIssues = epicProgressList.reduce((s, e) => s + e.childIssues.total, 0);
    const totalDoneChildIssues = epicProgressList.reduce((s, e) => s + e.childIssues.done, 0);
    const readyEpics = epicProgressList.filter((e) => e.readiness.score === 6).length;

    return {
      boards,
      ungrouped,
      summary: {
        totalEpics: epicProgressList.length,
        avgCompletionRate: totalChildIssues > 0 ? totalDoneChildIssues / totalChildIssues : 0,
        totalChildIssues,
        totalDoneChildIssues,
        readyEpics,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      dateFields: { startDateField, endDateField },
      fetchedAt: new Date().toISOString(),
    };
  });
}
