import { NextResponse } from "next/server";
import { fetchBacklogIssues } from "@/lib/jira/client";
import { getConfig } from "@/lib/jira/config";
import { getIssueFields } from "@/lib/jira/fields";
import { scoreBacklogHealth } from "@/lib/scoring/backlog-health";

export const revalidate = 1800; // 30 minutes ISR TTL
export const maxDuration = 300;

export async function GET() {
  try {
    const config = getConfig();
    const spField = config.storyPointsField || "customfield_10016";
    const fields = getIssueFields(spField);
    const issues = await fetchBacklogIssues(fields);

    const backlogData = scoreBacklogHealth(issues, {
      staleDays: config.staleDays,
      zombieDays: config.zombieDays,
      storyPointsField: spField,
      avgVelocity: null, // Will be populated from Postgres in Phase 2
    });

    const response = {
      healthScore: backlogData.healthScore,
      dimensions: backlogData.dimensions,
      alerts: backlogData.alerts,
      stats: {
        totalItems: backlogData.totalItems,
        estimatedItems: backlogData.estimatedItems,
        staleItems: backlogData.staleItems,
        zombieItems: backlogData.zombieItems,
      },
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Backlog API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch backlog data" },
      { status: 500 }
    );
  }
}
