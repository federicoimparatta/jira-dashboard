import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, getConfig } from "@/lib/jira/config";
import { getActiveSprintData, computeCycleTimes } from "@/lib/jira/sprint";
import { fetchBacklogIssues, discoverInitiativeField, resolveInitiativeLinkedIssues } from "@/lib/jira/client";
import { getIssueFields } from "@/lib/jira/fields";
import { scoreBacklogHealth } from "@/lib/scoring/backlog-health";
import { getDatabase } from "@/db";
import { getAvgVelocity } from "@/db/velocity";
import {
  sprintSnapshots,
  backlogSnapshots,
  cycleTimeLog,
  velocityHistory,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${getCronSecret()}`;
  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = getConfig();
    const db = getDatabase();
    const today = new Date().toISOString().split("T")[0];

    // 1. Fetch and snapshot active sprint
    const sprintData = await getActiveSprintData();
    if (sprintData) {
      await db.insert(sprintSnapshots).values({
        sprintId: sprintData.sprint.id,
        sprintName: sprintData.sprint.name,
        snapshotDate: today,
        velocity: sprintData.completedPoints,
        completionRate: sprintData.completionRate,
        totalPoints: sprintData.totalPoints,
        completedPoints: sprintData.completedPoints,
        inProgressPoints: sprintData.inProgressPoints,
        todoPoints: sprintData.todoPoints,
        carryover: 0,
        scopeChangePct:
          sprintData.totalPoints > 0
            ? sprintData.scopeChange.net / sprintData.totalPoints
            : 0,
        blockerCount: sprintData.blockers.length,
      });

      // Compute and store cycle times
      const { entries } = await computeCycleTimes(sprintData.issues);
      for (const entry of entries) {
        await db.insert(cycleTimeLog).values({
          issueKey: entry.issueKey,
          issueType: entry.issueType,
          startDate: new Date(entry.startDate),
          endDate: new Date(entry.endDate),
          cycleDays: entry.cycleDays,
        });
      }

      // Sprint close detection — check if sprint ended today
      if (sprintData.sprint.completeDate) {
        const completeDate = sprintData.sprint.completeDate.split("T")[0];
        if (completeDate === today) {
          // Check if already recorded
          const existing = await db
            .select()
            .from(velocityHistory)
            .where(eq(velocityHistory.sprintId, sprintData.sprint.id))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(velocityHistory).values({
              sprintId: sprintData.sprint.id,
              sprintName: sprintData.sprint.name,
              committedPoints: sprintData.totalPoints,
              completedPoints: sprintData.completedPoints,
              sprintEndDate: today,
            });
          }
        }
      }
    }

    // 2. Fetch and snapshot backlog
    const spField = config.storyPointsField || "customfield_10016";
    const initField = config.initiativeField || (await discoverInitiativeField());
    const fields = getIssueFields(spField, initField);
    const avgVelocity = await getAvgVelocity();
    const backlogIssues = await fetchBacklogIssues(fields);
    const initiativeLinkedIssueKeys = await resolveInitiativeLinkedIssues(backlogIssues);
    const backlogData = scoreBacklogHealth(backlogIssues, {
      staleDays: config.staleDays,
      zombieDays: config.zombieDays,
      storyPointsField: spField,
      initiativeField: initField,
      initiativeLinkedIssueKeys,
      readyStatuses: config.readyStatuses,
      avgVelocity,
    });

    await db.insert(backlogSnapshots).values({
      snapshotDate: today,
      healthScore: backlogData.healthScore,
      totalItems: backlogData.totalItems,
      estimatedItems: backlogData.readyItems,
      staleCount: backlogData.staleItems,
      unestimatedCount: backlogData.blockedItems,
      zombieCount: backlogData.zombieItems,
      dimensionsJson: backlogData.dimensions,
    });

    return NextResponse.json({
      success: true,
      date: today,
      sprint: sprintData
        ? {
            name: sprintData.sprint.name,
            completionRate: sprintData.completionRate,
          }
        : null,
      backlog: {
        healthScore: backlogData.healthScore,
        totalItems: backlogData.totalItems,
      },
    });
  } catch (error) {
    console.error("Daily snapshot error:", error);
    return NextResponse.json(
      { error: "Snapshot failed", details: String(error) },
      { status: 500 }
    );
  }
}
