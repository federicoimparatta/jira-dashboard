import { NextRequest, NextResponse } from "next/server";

const BOARD_CONFIG_COOKIE = "dash-board-config";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  try {
    const { boardIds, projectKey } = await request.json();

    if (!boardIds || !Array.isArray(boardIds) || boardIds.length === 0) {
      return NextResponse.json(
        { error: "At least one board must be selected" },
        { status: 400 }
      );
    }

    const config = JSON.stringify({
      boardIds: boardIds.map(String),
      projectKey: projectKey || "",
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(BOARD_CONFIG_COOKIE, Buffer.from(config).toString("base64"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
