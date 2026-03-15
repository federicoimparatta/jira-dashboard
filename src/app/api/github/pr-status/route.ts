import { NextResponse } from "next/server";
import { isGitHubConfigured } from "@/lib/github/config";
import { getPRStatusForKeys } from "@/lib/github/pr-status";

export const revalidate = 300; // 5 min ISR

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keysParam = searchParams.get("keys");

    if (!keysParam) {
      return NextResponse.json(
        { statuses: {}, configured: isGitHubConfigured(), fetchedAt: new Date().toISOString() }
      );
    }

    if (!isGitHubConfigured()) {
      return NextResponse.json({
        statuses: {},
        configured: false,
        fetchedAt: new Date().toISOString(),
      });
    }

    const keys = keysParam
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const statuses = await getPRStatusForKeys(keys);

    return NextResponse.json({
      statuses,
      configured: true,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("PR Status API error:", error);
    return NextResponse.json(
      {
        statuses: {},
        configured: true,
        error: "Failed to fetch PR statuses",
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
