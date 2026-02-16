import { NextResponse } from "next/server";
import { getConfig, getJiraAuth } from "@/lib/jira/config";

async function fetchBoardName(boardId: string): Promise<string> {
  const config = getConfig();
  const { email, token } = getJiraAuth();
  const encoded = Buffer.from(`${email}:${token}`).toString("base64");

  try {
    const res = await fetch(`${config.jiraBaseUrl}/rest/agile/1.0/board/${boardId}`, {
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`Failed to fetch board ${boardId} name: ${res.status}`);
      return `Board ${boardId}`;
    }

    const data = await res.json();
    return data.name || `Board ${boardId}`;
  } catch (error) {
    console.warn(`Error fetching board ${boardId} name:`, error);
    return `Board ${boardId}`;
  }
}

export async function GET() {
  try {
    const config = getConfig();

    // Fetch real board names from Jira API
    const boardPromises = config.boardIds.map(async (id) => ({
      id,
      name: await fetchBoardName(id),
    }));

    const boards = await Promise.all(boardPromises);

    return NextResponse.json({ boards });
  } catch (error) {
    console.error("Boards config API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch boards configuration" },
      { status: 500 }
    );
  }
}
