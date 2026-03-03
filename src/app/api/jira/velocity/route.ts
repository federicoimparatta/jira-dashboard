import { NextResponse } from "next/server";
import { getVelocityData } from "@/lib/jira/velocity";

export const revalidate = 600; // 10 minutes ISR TTL (historical data doesn't change fast)
export const maxDuration = 300; // Fluid Compute — fetching many sprints can be slow

export async function GET() {
  try {
    const data = await getVelocityData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Velocity API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch velocity data" },
      { status: 500 }
    );
  }
}
