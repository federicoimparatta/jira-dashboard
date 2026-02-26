import { NextResponse } from "next/server";
import { fetchAllIssues, getStoryPoints } from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import type {
  JiraIssue,
  InitiativeProgress,
  InitiativeEpicSummary,
} from "@/lib/jira/types";

export const revalidate = 600; // 10 minutes ISR TTL
export const maxDuration = 300;

export async function GET() {
  try {
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = [...getIssueFields(spField), "parent"];

    // Step 1: Fetch all non-done epics
    const epics = await fetchAllIssues(
      `issuetype = Epic AND statusCategory != Done AND project = ${config.projectKey} ORDER BY priority ASC, updated DESC`,
      ["summary", "status", "assignee", "priority", "issuetype", "updated", "parent"]
    );

    // Step 2: Filter to epics that belong to an initiative (have a parent)
    const epicsWithInitiative = epics.filter((epic) => {
      const parent = epic.fields.parent as
        | { key: string; fields?: { summary?: string } }
        | undefined;
      return parent?.key;
    });

    if (epicsWithInitiative.length === 0) {
      return NextResponse.json({
        initiatives: [],
        summary: {
          totalInitiatives: 0,
          totalEpics: 0,
          avgCompletionRate: 0,
          totalChildIssues: 0,
          totalDoneChildIssues: 0,
          totalStoryPoints: 0,
          totalDoneStoryPoints: 0,
        },
        jiraBaseUrl: config.jiraBaseUrl,
        fetchedAt: new Date().toISOString(),
      });
    }

    // Step 3: Group epics by initiative (parent key)
    const initiativeMap = new Map<
      string,
      { key: string; summary: string; epicKeys: string[]; epics: JiraIssue[] }
    >();

    for (const epic of epicsWithInitiative) {
      const parent = epic.fields.parent as {
        key: string;
        fields?: { summary?: string };
      };
      const existing = initiativeMap.get(parent.key);
      if (existing) {
        existing.epicKeys.push(epic.key);
        existing.epics.push(epic);
      } else {
        initiativeMap.set(parent.key, {
          key: parent.key,
          summary: parent.fields?.summary || parent.key,
          epicKeys: [epic.key],
          epics: [epic],
        });
      }
    }

    // Step 4: Fetch child issues in batches for all epics with initiatives
    const epicKeys = epicsWithInitiative.map((e) => e.key);
    const allChildren: JiraIssue[] = [];
    const BATCH_SIZE = 40;

    for (let i = 0; i < epicKeys.length; i += BATCH_SIZE) {
      const batch = epicKeys.slice(i, i + BATCH_SIZE);
      const keyList = batch.map((k) => `"${k}"`).join(", ");
      const childJql = `parent in (${keyList}) AND project = ${config.projectKey}`;
      const children = await fetchAllIssues(childJql, fields);
      allChildren.push(...children);
    }

    // Step 5: Group children by epic parent key
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

    // Step 6: Build initiative progress objects
    const initiatives: InitiativeProgress[] = Array.from(
      initiativeMap.values()
    ).map((init) => {
      const epicSummaries: InitiativeEpicSummary[] = init.epics.map((epic) => {
        const rawChildren = childrenByEpic.get(epic.key) || [];

        const childIssues = { total: rawChildren.length, done: 0, inProgress: 0, todo: 0 };
        const storyPoints = { total: 0, done: 0, inProgress: 0, todo: 0 };

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
        }

        return {
          key: epic.key,
          summary: epic.fields.summary,
          status: {
            name: epic.fields.status.name,
            categoryKey: epic.fields.status.statusCategory.key,
          },
          priority: {
            name: epic.fields.priority.name,
            id: epic.fields.priority.id,
          },
          assignee: epic.fields.assignee?.displayName || null,
          childIssues,
          storyPoints,
        };
      });

      const totalChildIssues = epicSummaries.reduce((s, e) => s + e.childIssues.total, 0);
      const totalDone = epicSummaries.reduce((s, e) => s + e.childIssues.done, 0);
      const totalInProgress = epicSummaries.reduce((s, e) => s + e.childIssues.inProgress, 0);
      const totalTodo = epicSummaries.reduce((s, e) => s + e.childIssues.todo, 0);

      const totalSP = epicSummaries.reduce((s, e) => s + e.storyPoints.total, 0);
      const doneSP = epicSummaries.reduce((s, e) => s + e.storyPoints.done, 0);
      const inProgressSP = epicSummaries.reduce((s, e) => s + e.storyPoints.inProgress, 0);
      const todoSP = epicSummaries.reduce((s, e) => s + e.storyPoints.todo, 0);

      return {
        key: init.key,
        summary: init.summary,
        epicCount: init.epics.length,
        epics: epicSummaries,
        childIssues: {
          total: totalChildIssues,
          done: totalDone,
          inProgress: totalInProgress,
          todo: totalTodo,
        },
        storyPoints: {
          total: totalSP,
          done: doneSP,
          inProgress: inProgressSP,
          todo: todoSP,
        },
        completionRate: totalChildIssues > 0 ? totalDone / totalChildIssues : 0,
      };
    });

    // Sort by completion rate ascending (least complete first)
    initiatives.sort((a, b) => a.completionRate - b.completionRate);

    // Step 7: Global summary
    const totalChildIssues = initiatives.reduce((s, i) => s + i.childIssues.total, 0);
    const totalDoneChildIssues = initiatives.reduce((s, i) => s + i.childIssues.done, 0);
    const totalStoryPoints = initiatives.reduce((s, i) => s + i.storyPoints.total, 0);
    const totalDoneStoryPoints = initiatives.reduce((s, i) => s + i.storyPoints.done, 0);
    const totalEpics = initiatives.reduce((s, i) => s + i.epicCount, 0);

    return NextResponse.json({
      initiatives,
      summary: {
        totalInitiatives: initiatives.length,
        totalEpics,
        avgCompletionRate: totalChildIssues > 0 ? totalDoneChildIssues / totalChildIssues : 0,
        totalChildIssues,
        totalDoneChildIssues,
        totalStoryPoints,
        totalDoneStoryPoints,
      },
      jiraBaseUrl: config.jiraBaseUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Initiatives API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch initiatives data" },
      { status: 500 }
    );
  }
}
