import { createSSEStream, ProgressEvent } from "@/lib/streaming/create-stream";
import {
  fetchAllIssues,
  fetchBoardEpics,
  fetchBoardName,
  getStoryPoints,
} from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import type { JiraIssue, InitiativeProgress, InitiativeEpicSummary } from "@/lib/jira/types";

export const maxDuration = 300;

export async function GET() {
  return createSSEStream(async (onProgress: (e: ProgressEvent) => void) => {
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = [...getIssueFields(spField), "parent"];

    onProgress({ stage: "epics", message: "Fetching active epics...", percent: 5 });

    const [epics, ...boardResults] = await Promise.all([
      fetchAllIssues(
        `issuetype = Epic AND statusCategory != Done AND project = ${config.projectKey} ORDER BY priority ASC, updated DESC`,
        ["summary", "status", "assignee", "priority", "issuetype", "updated", "parent"]
      ),
      ...config.boardIds.map(async (boardId) => {
        const [boardEpics, boardName] = await Promise.all([
          fetchBoardEpics(boardId),
          fetchBoardName(boardId),
        ]);
        return { boardId, boardName, epicKeys: boardEpics.map((e) => e.key) };
      }),
    ]);

    const epicBoardMap = new Map<string, string[]>();
    for (const { boardId, epicKeys: keys } of boardResults) {
      for (const key of keys) {
        const existing = epicBoardMap.get(key) || [];
        existing.push(boardId);
        epicBoardMap.set(key, existing);
      }
    }

    const boardNameMap = new Map<string, string>();
    for (const { boardId, boardName } of boardResults) boardNameMap.set(boardId, boardName);

    onProgress({ stage: "filtering", message: "Identifying initiative-linked epics...", percent: 20 });

    const epicsWithInitiative = epics.filter((epic) => {
      const parent = epic.fields.parent as { key: string } | undefined;
      return parent?.key;
    });

    if (epicsWithInitiative.length === 0) {
      return {
        initiatives: [],
        boards: config.boardIds.map((id) => ({ id, name: boardNameMap.get(id) || `Board ${id}` })),
        summary: {
          totalInitiatives: 0, totalEpics: 0, avgCompletionRate: 0,
          totalChildIssues: 0, totalDoneChildIssues: 0, totalStoryPoints: 0, totalDoneStoryPoints: 0,
        },
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      };
    }

    onProgress({
      stage: "filtering",
      message: `Found ${epicsWithInitiative.length} epics linked to initiatives`,
      percent: 25,
    });

    // Group epics by initiative
    const initiativeMap = new Map<string, { key: string; summary: string; epics: JiraIssue[] }>();
    for (const epic of epicsWithInitiative) {
      const parent = epic.fields.parent as { key: string; fields?: { summary?: string } };
      const existing = initiativeMap.get(parent.key);
      if (existing) {
        existing.epics.push(epic);
      } else {
        initiativeMap.set(parent.key, {
          key: parent.key,
          summary: parent.fields?.summary || parent.key,
          epics: [epic],
        });
      }
    }

    // Fetch child issues in batches
    const epicKeys = epicsWithInitiative.map((e) => e.key);
    const BATCH_SIZE = 40;
    const totalBatches = Math.ceil(epicKeys.length / BATCH_SIZE);
    const allChildren: JiraIssue[] = [];

    for (let i = 0; i < epicKeys.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      onProgress({
        stage: "children",
        message: `Loading child issues (batch ${batchNum}/${totalBatches})...`,
        percent: 30 + (50 * batchNum) / totalBatches,
        detail: `${allChildren.length} issues loaded so far`,
      });

      const batch = epicKeys.slice(i, i + BATCH_SIZE);
      const keyList = batch.map((k) => `"${k}"`).join(", ");
      const children = await fetchAllIssues(
        `parent in (${keyList}) AND project = ${config.projectKey}`,
        fields
      );
      allChildren.push(...children);
    }

    onProgress({ stage: "building", message: "Building initiative metrics...", percent: 85 });

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

    const initiatives: InitiativeProgress[] = Array.from(initiativeMap.values()).map((init) => {
      const epicSummaries: InitiativeEpicSummary[] = init.epics.map((epic) => {
        const rawChildren = childrenByEpic.get(epic.key) || [];
        const childIssues = { total: rawChildren.length, done: 0, inProgress: 0, todo: 0 };
        const storyPoints = { total: 0, done: 0, inProgress: 0, todo: 0 };

        for (const child of rawChildren) {
          const sp = getStoryPoints(child, spField);
          storyPoints.total += sp;
          const cat = child.fields.status.statusCategory.key;
          if (cat === "done") { childIssues.done++; storyPoints.done += sp; }
          else if (cat === "indeterminate") { childIssues.inProgress++; storyPoints.inProgress += sp; }
          else { childIssues.todo++; storyPoints.todo += sp; }
        }

        return {
          key: epic.key,
          summary: epic.fields.summary,
          status: { name: epic.fields.status.name, categoryKey: epic.fields.status.statusCategory.key },
          priority: { name: epic.fields.priority.name, id: epic.fields.priority.id },
          assignee: epic.fields.assignee?.displayName || null,
          boardIds: epicBoardMap.get(epic.key) || [],
          childIssues,
          storyPoints,
        };
      });

      const totalCI = epicSummaries.reduce((s, e) => s + e.childIssues.total, 0);
      const doneCI = epicSummaries.reduce((s, e) => s + e.childIssues.done, 0);
      const totalSP = epicSummaries.reduce((s, e) => s + e.storyPoints.total, 0);
      const doneSP = epicSummaries.reduce((s, e) => s + e.storyPoints.done, 0);

      return {
        key: init.key,
        summary: init.summary,
        epicCount: init.epics.length,
        epics: epicSummaries,
        childIssues: {
          total: totalCI,
          done: doneCI,
          inProgress: epicSummaries.reduce((s, e) => s + e.childIssues.inProgress, 0),
          todo: epicSummaries.reduce((s, e) => s + e.childIssues.todo, 0),
        },
        storyPoints: {
          total: totalSP,
          done: doneSP,
          inProgress: epicSummaries.reduce((s, e) => s + e.storyPoints.inProgress, 0),
          todo: epicSummaries.reduce((s, e) => s + e.storyPoints.todo, 0),
        },
        completionRate: totalCI > 0 ? doneCI / totalCI : 0,
      };
    });

    initiatives.sort((a, b) => a.completionRate - b.completionRate);

    const totalCI = initiatives.reduce((s, i) => s + i.childIssues.total, 0);
    const doneCI = initiatives.reduce((s, i) => s + i.childIssues.done, 0);
    const totalSP = initiatives.reduce((s, i) => s + i.storyPoints.total, 0);
    const doneSP = initiatives.reduce((s, i) => s + i.storyPoints.done, 0);

    return {
      initiatives,
      boards: config.boardIds.map((id) => ({ id, name: boardNameMap.get(id) || `Board ${id}` })),
      summary: {
        totalInitiatives: initiatives.length,
        totalEpics: initiatives.reduce((s, i) => s + i.epicCount, 0),
        avgCompletionRate: totalCI > 0 ? doneCI / totalCI : 0,
        totalChildIssues: totalCI,
        totalDoneChildIssues: doneCI,
        totalStoryPoints: totalSP,
        totalDoneStoryPoints: doneSP,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      fetchedAt: new Date().toISOString(),
    };
  });
}
