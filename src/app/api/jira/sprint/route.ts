import { NextResponse } from "next/server";
import { getActiveSprintData, computeCycleTimes } from "@/lib/jira/sprint";

export const revalidate = 300; // 5 minutes ISR TTL
export const maxDuration = 300; // Fluid Compute

export async function GET() {
  try {
    const sprintData = await getActiveSprintData();

    if (!sprintData) {
      return NextResponse.json(
        { error: "No active sprint found" },
        { status: 404 }
      );
    }

    // Compute cycle times for done issues
    const { avgCycleTime, avgLeadTime } = await computeCycleTimes(
      sprintData.issues
    );

    const response = {
      sprint: {
        id: sprintData.sprint.id,
        name: sprintData.sprint.name,
        state: sprintData.sprint.state,
        startDate: sprintData.sprint.startDate,
        endDate: sprintData.sprint.endDate,
        goal: sprintData.sprint.goal,
      },
      progress: {
        totalPoints: sprintData.totalPoints,
        completedPoints: sprintData.completedPoints,
        inProgressPoints: sprintData.inProgressPoints,
        todoPoints: sprintData.todoPoints,
        completionRate: sprintData.completionRate,
      },
      burndown: sprintData.burndown,
      blockers: sprintData.blockers.map((b) => ({
        key: b.key,
        summary: b.fields.summary,
        assignee: b.fields.assignee?.displayName || "Unassigned",
        status: b.fields.status.name,
      })),
      wipPerAssignee: sprintData.wipPerAssignee,
      unassignedCount: sprintData.unassignedCount,
      scopeChange: sprintData.scopeChange,
      cycleTime: avgCycleTime,
      leadTime: avgLeadTime,
      issueCount: {
        total: sprintData.issues.length,
        done: sprintData.issues.filter(
          (i) => i.fields.status.statusCategory.key === "done"
        ).length,
        inProgress: sprintData.issues.filter(
          (i) => i.fields.status.statusCategory.key === "indeterminate"
        ).length,
        todo: sprintData.issues.filter(
          (i) => i.fields.status.statusCategory.key === "new"
        ).length,
      },
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sprint API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sprint data" },
      { status: 500 }
    );
  }
}
