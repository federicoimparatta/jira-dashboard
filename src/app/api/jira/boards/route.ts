import { NextResponse } from "next/server";
import { getJiraAuth, getJiraCredsFromCookies } from "@/lib/jira/config";

export async function GET() {
  try {
    const creds = await getJiraCredsFromCookies();
    if (!creds) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in first." },
        { status: 401 }
      );
    }

    const { email, token } = await getJiraAuth();
    const encoded = Buffer.from(`${email}:${token}`).toString("base64");

    // Fetch all boards from the Jira instance
    const boards: { id: number; name: string; type: string; projectKey?: string; projectName?: string }[] = [];
    let startAt = 0;
    const maxResults = 50;

    do {
      const res = await fetch(
        `${creds.jiraBaseUrl}/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`,
        {
          headers: {
            Authorization: `Basic ${encoded}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (!res.ok) {
        const body = await res.text();
        return NextResponse.json(
          { error: `Failed to fetch boards: ${res.status} ${body}` },
          { status: res.status }
        );
      }

      const data = await res.json();
      for (const board of data.values || []) {
        boards.push({
          id: board.id,
          name: board.name,
          type: board.type,
          projectKey: board.location?.projectKey,
          projectName: board.location?.projectName,
        });
      }

      if (data.isLast || (data.values || []).length < maxResults) break;
      startAt += maxResults;
    } while (true);

    return NextResponse.json({ boards });
  } catch (error) {
    console.error("Boards API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch boards from Jira" },
      { status: 500 }
    );
  }
}
