import { NextRequest, NextResponse } from "next/server";
import { getConfig, getJiraAuth } from "@/lib/jira/config";
import { discoverDateFields } from "@/lib/jira/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> }
) {
  try {
    const { issueKey } = await params;
    const body = await request.json();

    const config = getConfig();

    // Build allowed field set from config/discovery + built-in duedate
    const allowedFields = new Set<string>(["duedate"]);
    let startDateField = config.startDateField;
    let endDateField = config.endDateField;
    if (!startDateField || !endDateField) {
      const discovered = await discoverDateFields();
      startDateField = startDateField || discovered.startDateField;
      endDateField = endDateField || discovered.endDateField;
    }
    if (startDateField) allowedFields.add(startDateField);
    if (endDateField) allowedFields.add(endDateField);

    const fieldsToUpdate: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      (body.fields || {}) as Record<string, unknown>
    )) {
      if (allowedFields.has(key)) {
        fieldsToUpdate[key] = value;
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { email, token } = getJiraAuth();
    const encoded = Buffer.from(`${email}:${token}`).toString("base64");

    const res = await fetch(
      `${config.jiraBaseUrl}/rest/api/3/issue/${issueKey}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Basic ${encoded}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ fields: fieldsToUpdate }),
      }
    );

    if (!res.ok) {
      const errorBody = await res.text();
      return NextResponse.json(
        { error: `Jira update failed: ${res.status}`, detail: errorBody },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Issue update error:", error);
    return NextResponse.json(
      { error: "Failed to update issue" },
      { status: 500 }
    );
  }
}
