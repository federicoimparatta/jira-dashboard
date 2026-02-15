import { NextRequest, NextResponse } from "next/server";
import { getCronSecret, getConfig } from "@/lib/jira/config";
import { compileWeeklyReport } from "@/lib/reports/compile";
import { dispatchEmail, dispatchSlack } from "@/lib/reports/dispatch";
import { getDatabase } from "@/db";
import { weeklyReports } from "@/db/schema";

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

    // Check if today is the configured report day
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0=Sunday, 1=Monday, etc.
    if (dayOfWeek !== config.reportDay) {
      return NextResponse.json({
        skipped: true,
        reason: `Today is day ${dayOfWeek}, report day is ${config.reportDay}`,
      });
    }

    // Compile report
    const report = await compileWeeklyReport();

    // Dispatch
    const emailSent = await dispatchEmail(report);
    const slackSent = await dispatchSlack(report);

    // Archive to Postgres
    try {
      const db = getDatabase();
      await db.insert(weeklyReports).values({
        reportDate: report.reportDate,
        reportJson: report,
      });
    } catch {
      console.warn("Failed to archive report to Postgres (may not be set up)");
    }

    return NextResponse.json({
      success: true,
      reportDate: report.reportDate,
      dispatched: {
        email: emailSent,
        slack: slackSent,
      },
    });
  } catch (error) {
    console.error("Weekly report error:", error);
    return NextResponse.json(
      { error: "Report generation failed", details: String(error) },
      { status: 500 }
    );
  }
}
