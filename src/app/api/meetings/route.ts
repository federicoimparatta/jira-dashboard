import { NextResponse } from "next/server";
import { queryMeetings, getMeetingsMeta, getBlockersSummary } from "@/lib/meetings/store";

export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const team = searchParams.get("team") || undefined;
    const weekStart = searchParams.get("week") || undefined;
    const sprintName = searchParams.get("sprint") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const [meetings, meta, blockersSummary] = await Promise.all([
      queryMeetings({ team, weekStart, sprintName, from, to }),
      getMeetingsMeta(),
      getBlockersSummary(),
    ]);

    return NextResponse.json({
      meetings,
      teams: meta.teams,
      sprints: meta.sprints,
      weekStarts: meta.weekStarts,
      blockersSummary,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Meetings API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meetings data" },
      { status: 500 }
    );
  }
}
