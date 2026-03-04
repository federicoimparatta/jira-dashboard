import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "dash-auth";
const JIRA_CREDS_COOKIE = "dash-jira-creds";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  try {
    const { jiraBaseUrl, email, apiToken } = await request.json();

    if (!jiraBaseUrl || !email || !apiToken) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Normalize the base URL
    const normalizedUrl = jiraBaseUrl.replace(/\/+$/, "");

    // Validate credentials by making a test request to the Jira API
    const encoded = Buffer.from(`${email}:${apiToken}`).toString("base64");
    const testRes = await fetch(`${normalizedUrl}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: "application/json",
      },
    });

    if (!testRes.ok) {
      const status = testRes.status;
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: "Invalid credentials. Check your email and API token." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Could not connect to Jira (HTTP ${status}). Check your instance URL.` },
        { status: 400 }
      );
    }

    // Credentials are valid — store them in httpOnly cookies
    const creds = JSON.stringify({
      jiraBaseUrl: normalizedUrl,
      email,
      apiToken,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set(AUTH_COOKIE, "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    response.cookies.set(JIRA_CREDS_COOKIE, Buffer.from(creds).toString("base64"), {
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

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE);
  response.cookies.delete(JIRA_CREDS_COOKIE);
  return response;
}
