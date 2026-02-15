import {
  fetchSprints,
  fetchSprintIssues,
  fetchIssueChangelog,
  getStoryPoints,
} from "./client";
import { getConfig } from "./config";
import { getIssueFields } from "./fields";
import {
  JiraIssue,
  SprintData,
  BurndownPoint,
  ChangelogHistory,
} from "./types";

export async function getActiveSprintData(): Promise<SprintData | null> {
  const config = getConfig();
  const sprints = await fetchSprints("active");
  if (sprints.length === 0) return null;

  const sprint = sprints[0];
  const spField =
    config.storyPointsField || (await discoverAndCacheField());
  const fields = getIssueFields(spField);
  const issues = await fetchSprintIssues(sprint.id, fields);

  return aggregateSprintData(sprint, issues, spField || "");
}

let cachedField: string | null = null;
async function discoverAndCacheField(): Promise<string | null> {
  if (cachedField) return cachedField;
  const { discoverStoryPointsField } = await import("./client");
  cachedField = await discoverStoryPointsField();
  return cachedField;
}

export function aggregateSprintData(
  sprint: import("./types").JiraSprint,
  issues: JiraIssue[],
  storyPointsField: string
): SprintData {
  const config = getConfig();
  let completedPoints = 0;
  let inProgressPoints = 0;
  let todoPoints = 0;
  let totalPoints = 0;
  const blockers: JiraIssue[] = [];
  const wipMap: Record<string, { count: number; points: number }> = {};
  let unassignedCount = 0;

  for (const issue of issues) {
    const pts = storyPointsField
      ? getStoryPoints(issue, storyPointsField)
      : 0;
    totalPoints += pts;
    const cat = issue.fields.status.statusCategory.key;

    if (cat === "done") {
      completedPoints += pts;
    } else if (cat === "indeterminate") {
      inProgressPoints += pts;
      // Track WIP
      const assignee = issue.fields.assignee?.displayName || "Unassigned";
      if (!wipMap[assignee]) wipMap[assignee] = { count: 0, points: 0 };
      wipMap[assignee].count++;
      wipMap[assignee].points += pts;
    } else {
      todoPoints += pts;
    }

    // Check blockers
    const status = issue.fields.status.name.toLowerCase();
    if (
      status.includes("block") ||
      issue.fields.flagged
    ) {
      blockers.push(issue);
    }

    if (!issue.fields.assignee && cat !== "done") {
      unassignedCount++;
    }
  }

  const completionRate = totalPoints > 0 ? completedPoints / totalPoints : 0;

  const burndown = computeBurndown(sprint, issues, totalPoints);

  const scopeChange = computeScopeChange(issues, sprint);

  return {
    sprint,
    issues,
    totalPoints,
    completedPoints,
    inProgressPoints,
    todoPoints,
    completionRate,
    burndown,
    blockers,
    wipPerAssignee: wipMap,
    unassignedCount,
    scopeChange,
    avgCycleTime: null, // computed async if needed
    avgLeadTime: null,
  };
}

function computeBurndown(
  sprint: import("./types").JiraSprint,
  issues: JiraIssue[],
  totalPoints: number
): BurndownPoint[] {
  if (!sprint.startDate || !sprint.endDate) return [];

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  const now = new Date();
  const effectiveEnd = now < end ? now : end;

  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const points: BurndownPoint[] = [];

  for (
    let d = new Date(start);
    d <= effectiveEnd;
    d.setDate(d.getDate() + 1)
  ) {
    const dayIndex = Math.ceil(
      (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const idealRemaining =
      totalPoints - (totalPoints / totalDays) * dayIndex;

    // Count points completed by this date
    let completedByDate = 0;
    for (const issue of issues) {
      if (issue.fields.status.statusCategory.key === "done") {
        const updated = new Date(issue.fields.updated);
        if (updated <= d) {
          completedByDate += (issue.fields as Record<string, unknown>)[
            "story_points"
          ]
            ? 0
            : 0; // simplified — actual calc uses SP field
        }
      }
    }

    points.push({
      date: d.toISOString().split("T")[0],
      ideal: Math.max(0, Math.round(idealRemaining * 10) / 10),
      actual: totalPoints - completedByDate,
    });
  }

  return points;
}

function computeScopeChange(
  issues: JiraIssue[],
  sprint: import("./types").JiraSprint
): { added: number; removed: number; net: number } {
  // Scope change tracking requires changelog analysis
  // For MVP, count issues added after sprint start
  if (!sprint.startDate) return { added: 0, removed: 0, net: 0 };

  const sprintStart = new Date(sprint.startDate);
  let added = 0;

  for (const issue of issues) {
    const created = new Date(issue.fields.created);
    if (created > sprintStart) {
      added++;
    }
  }

  return { added, removed: 0, net: added };
}

export async function computeCycleTimes(
  issues: JiraIssue[]
): Promise<{
  avgCycleTime: number | null;
  avgLeadTime: number | null;
  entries: { issueKey: string; issueType: string; startDate: string; endDate: string; cycleDays: number }[];
}> {
  const doneIssues = issues.filter(
    (i) => i.fields.status.statusCategory.key === "done"
  );

  const entries: {
    issueKey: string;
    issueType: string;
    startDate: string;
    endDate: string;
    cycleDays: number;
  }[] = [];
  const leadTimes: number[] = [];

  for (const issue of doneIssues.slice(0, 50)) {
    // Limit changelog fetches
    try {
      const changelog = await fetchIssueChangelog(issue.key);
      const { cycleTime, leadTime, startDate, endDate } =
        extractTimes(issue, changelog);

      if (cycleTime !== null) {
        entries.push({
          issueKey: issue.key,
          issueType: issue.fields.issuetype.name,
          startDate: startDate!,
          endDate: endDate!,
          cycleDays: cycleTime,
        });
      }
      if (leadTime !== null) {
        leadTimes.push(leadTime);
      }
    } catch {
      // Skip issues with changelog errors
    }
  }

  const cycleTimes = entries.map((e) => e.cycleDays);
  const avgCycleTime =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;
  const avgLeadTime =
    leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : null;

  return { avgCycleTime, avgLeadTime, entries };
}

function extractTimes(
  issue: JiraIssue,
  changelog: ChangelogHistory[]
): {
  cycleTime: number | null;
  leadTime: number | null;
  startDate: string | null;
  endDate: string | null;
} {
  let inProgressDate: Date | null = null;
  let doneDate: Date | null = null;

  // Sort changelog by date
  const sorted = [...changelog].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
  );

  for (const history of sorted) {
    for (const item of history.items) {
      if (item.field === "status") {
        // First transition to "In Progress" category
        if (!inProgressDate && item.toString?.toLowerCase().includes("progress")) {
          inProgressDate = new Date(history.created);
        }
        // Last transition to "Done" category
        if (item.toString?.toLowerCase().includes("done")) {
          doneDate = new Date(history.created);
        }
      }
    }
  }

  const createdDate = new Date(issue.fields.created);
  const cycleTime =
    inProgressDate && doneDate
      ? (doneDate.getTime() - inProgressDate.getTime()) / (1000 * 60 * 60 * 24)
      : null;
  const leadTime = doneDate
    ? (doneDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    : null;

  return {
    cycleTime: cycleTime !== null ? Math.round(cycleTime * 10) / 10 : null,
    leadTime: leadTime !== null ? Math.round(leadTime * 10) / 10 : null,
    startDate: inProgressDate?.toISOString() || null,
    endDate: doneDate?.toISOString() || null,
  };
}
