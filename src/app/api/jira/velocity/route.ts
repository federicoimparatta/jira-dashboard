import { NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { velocityHistory } from "@/db/schema";
import { desc } from "drizzle-orm";

export const revalidate = 3600; // 1 hour — velocity data changes only on sprint close

export async function GET() {
  try {
    const db = getDatabase();

    const history = await db
      .select()
      .from(velocityHistory)
      .orderBy(desc(velocityHistory.sprintEndDate))
      .limit(10);

    const response = {
      velocity: history.reverse().map((h) => ({
        sprintId: h.sprintId,
        sprintName: h.sprintName,
        committed: h.committedPoints,
        completed: h.completedPoints,
        endDate: h.sprintEndDate,
      })),
      average:
        history.length > 0
          ? history.reduce((sum, h) => sum + (h.completedPoints || 0), 0) /
            history.length
          : null,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Velocity API error:", error);
    // Return empty data if Postgres isn't set up yet (Phase 1)
    return NextResponse.json({
      velocity: [],
      average: null,
      fetchedAt: new Date().toISOString(),
      note: "Velocity history requires Postgres setup (Phase 2)",
    });
  }
}
