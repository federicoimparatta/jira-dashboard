import { NextResponse } from "next/server";
import { fetchAllIssues, getStoryPoints } from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import { JiraIssue, EpicProgress } from "@/lib/jira/types";

export const revalidate = 600; // 10 minutes ISR TTL
export const maxDuration = 300;

export async function GET() {
  try {
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = [...getIssueFields(spField), "parent"];

    // Step 1: Fetch all non-done epics in the project
    const epicJql = `issuetype = Epic AND statusCategory != Done AND project = ${config.projectKey} ORDER BY priority ASC, updated DESC`;
    const epics = await fetchAllIssues(epicJql, [
      "summary",
      "status",
      "assignee",
      "priority",
      "issuetype",
      "updated",
    ]);

    if (epics.length === 0) {
      return NextResponse.json({
        epics: [],
        summary: {
          totalEpics: 0,
          avgCompletionRate: 0,
          totalChildIssues: 0,
          totalDoneChildIssues: 0,
        },
        fetchedAt: new Date().toISOString(),
      });
    }

    // Step 2: Fetch all child issues in batches to stay under JQL length limits
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

    // Step 4: Build per-epic progress
    const epicProgressList: EpicProgress[] = epics.map((epic) => {
      const children = childrenByEpic.get(epic.key) || [];

      const childIssues = { total: children.length, done: 0, inProgress: 0, todo: 0 };
      const storyPoints = { total: 0, done: 0, inProgress: 0, todo: 0 };

      for (const child of children) {
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
        assignee: epic.fields.assignee?.displayName || null,
        priority: {
          name: epic.fields.priority.name,
          id: epic.fields.priority.id,
        },
        childIssues,
        storyPoints,
        updated: epic.fields.updated,
      };
    });

    // Step 5: Compute summary
    const totalChildIssues = epicProgressList.reduce((s, e) => s + e.childIssues.total, 0);
    const totalDoneChildIssues = epicProgressList.reduce((s, e) => s + e.childIssues.done, 0);
    const avgCompletionRate =
      totalChildIssues > 0 ? totalDoneChildIssues / totalChildIssues : 0;

    return NextResponse.json({
      epics: epicProgressList,
      summary: {
        totalEpics: epicProgressList.length,
        avgCompletionRate,
        totalChildIssues,
        totalDoneChildIssues,
      },
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
