import { getActiveSprintData, computeCycleTimes } from "../jira/sprint";
import { fetchBacklogIssues, discoverInitiativeField } from "../jira/client";
import { getConfig } from "../jira/config";
import { getIssueFields } from "../jira/fields";
import { scoreBacklogHealth } from "../scoring/backlog-health";
import { getAvgVelocity } from "@/db/velocity";
import { getDatabase } from "@/db";
import { velocityHistory } from "@/db/schema";
import { desc } from "drizzle-orm";
import { WeeklyReport } from "../jira/types";

export async function compileWeeklyReport(): Promise<WeeklyReport> {
  const config = getConfig();
  const db = getDatabase();

  // Fetch current sprint data
  const sprintData = await getActiveSprintData();

  // Fetch velocity history for trend
  const velHistory = await db
    .select()
    .from(velocityHistory)
    .orderBy(desc(velocityHistory.sprintEndDate))
    .limit(6);

  // Fetch backlog
  const spField = config.storyPointsField || "customfield_10016";
  const initField = config.initiativeField || (await discoverInitiativeField());
  const fields = getIssueFields(spField, initField);
  const avgVelocity = await getAvgVelocity();
  const backlogIssues = await fetchBacklogIssues(fields);
  const backlogData = scoreBacklogHealth(backlogIssues, {
    staleDays: config.staleDays,
    zombieDays: config.zombieDays,
    storyPointsField: spField,
    initiativeField: initField,
    readyStatuses: config.readyStatuses,
    avgVelocity,
  });

  // Compute cycle times
  const cycleTimes = sprintData
    ? await computeCycleTimes(sprintData.issues)
    : { avgCycleTime: null, avgLeadTime: null, entries: [] };

  const cycleValues = cycleTimes.entries
    .map((e) => e.cycleDays)
    .sort((a, b) => a - b);

  // Throughput by type
  const doneIssues = sprintData
    ? sprintData.issues.filter(
        (i) => i.fields.status.statusCategory.key === "done"
      )
    : [];
  const byType: Record<string, number> = {};
  for (const issue of doneIssues) {
    const type = issue.fields.issuetype.name;
    byType[type] = (byType[type] || 0) + 1;
  }

  // Team load
  const teamLoad: WeeklyReport["teamLoad"] = {};
  if (sprintData) {
    for (const issue of sprintData.issues) {
      const name = issue.fields.assignee?.displayName || "Unassigned";
      if (!teamLoad[name]) {
        teamLoad[name] = { issues: 0, points: 0, wipViolation: false };
      }
      teamLoad[name].issues++;
      const wip = sprintData.wipPerAssignee[name];
      if (wip && wip.count > config.wipLimit) {
        teamLoad[name].wipViolation = true;
      }
    }
  }

  return {
    reportDate: new Date().toISOString().split("T")[0],
    sprintSummary: {
      name: sprintData?.sprint.name || "No active sprint",
      velocity: sprintData?.completedPoints || 0,
      completionRate: sprintData?.completionRate || 0,
      carryover: sprintData
        ? sprintData.issues.filter(
            (i) => i.fields.status.statusCategory.key !== "done"
          ).length
        : 0,
    },
    throughput: {
      total: doneIssues.length,
      byType,
      weekOverWeekDelta: 0, // Requires previous week data from Postgres
    },
    cycleTime: {
      average: cycleTimes.avgCycleTime || 0,
      median:
        cycleValues.length > 0
          ? cycleValues[Math.floor(cycleValues.length / 2)]
          : 0,
      p90:
        cycleValues.length > 0
          ? cycleValues[Math.floor(cycleValues.length * 0.9)]
          : 0,
    },
    blockers: sprintData
      ? sprintData.blockers.map((b) => ({
          key: b.key,
          summary: b.fields.summary,
          daysBlocked: 0, // Requires changelog analysis
        }))
      : [],
    teamLoad,
    backlogHealth: {
      score: backlogData.healthScore,
      flags: backlogData.alerts.map((a) => a.message),
    },
    velocityTrend: velHistory.reverse().map((v) => ({
      sprintId: v.sprintId,
      sprintName: v.sprintName,
      committed: v.committedPoints || 0,
      completed: v.completedPoints || 0,
      endDate: v.sprintEndDate || "",
    })),
  };
}
