import { NextResponse } from "next/server";
import { processMeetingsWithLLM } from "@/lib/meetings/process";
import { storeMeetings } from "@/lib/meetings/store";
import { getCronSecret } from "@/lib/jira/config";
import type { FellowMeetingInput } from "@/lib/meetings/types";

export const maxDuration = 300; // Allow up to 5 min for LLM processing

export async function POST(request: Request) {
  try {
    // Auth check — use same CRON_SECRET as other protected endpoints
    const authHeader = request.headers.get("authorization");
    const secret = getCronSecret();
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const meetings: FellowMeetingInput[] = body.meetings;

    if (!meetings || !Array.isArray(meetings) || meetings.length === 0) {
      return NextResponse.json(
        { error: "No meetings provided. Expected { meetings: [...] }" },
        { status: 400 }
      );
    }

    // Process through Claude API
    const processed = await processMeetingsWithLLM(meetings);

    // Store in database
    const storedCount = await storeMeetings(processed);

    return NextResponse.json({
      success: true,
      processed: processed.length,
      stored: storedCount,
      teams: [...new Set(processed.map((m) => m.teamName))],
      blockers: processed.reduce((sum, m) => sum + m.blockers.length, 0),
    });
  } catch (error) {
    console.error("Meetings ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest meetings", detail: String(error) },
      { status: 500 }
    );
  }
}
