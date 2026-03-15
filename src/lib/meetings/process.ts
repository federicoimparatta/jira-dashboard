import Anthropic from "@anthropic-ai/sdk";
import type { FellowMeetingInput, ProcessedMeeting } from "./types";
import { getConfig } from "../jira/config";
import { fetchSprintsForBoard } from "../jira/client";

const TEAM_PATTERNS: Record<string, string[]> = {
  Forge: ["forge"],
  Mobile: ["mobile"],
  "Data Core": ["data core", "datacore"],
  "Data Bridge": ["data bridge"],
  "Data Discovery": ["data discovery"],
  "Data Science": ["data science"],
  INDI: ["indi"],
  Arc: ["arc team", "arc standup"],
};

function detectTeam(title: string): string {
  const lower = title.toLowerCase();
  for (const [team, patterns] of Object.entries(TEAM_PATTERNS)) {
    if (patterns.some((p) => lower.includes(p))) return team;
  }
  return "General";
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
}

async function findSprintForDate(
  date: string,
  boardIds: string[]
): Promise<{ id: number; name: string } | null> {
  const meetingDate = new Date(date);

  for (const boardId of boardIds) {
    try {
      const sprints = await fetchSprintsForBoard(boardId, "active");
      for (const sprint of sprints) {
        if (!sprint.startDate || !sprint.endDate) continue;
        const start = new Date(sprint.startDate);
        const end = new Date(sprint.endDate);
        if (meetingDate >= start && meetingDate <= end) {
          return { id: sprint.id, name: sprint.name };
        }
      }
      // Check closed sprints too (for historical data)
      const closedSprints = await fetchSprintsForBoard(boardId, "closed");
      // Only check recent ones (last 5)
      const recent = closedSprints.slice(-5);
      for (const sprint of recent) {
        if (!sprint.startDate || !sprint.endDate) continue;
        const start = new Date(sprint.startDate);
        const end = new Date(sprint.endDate);
        if (meetingDate >= start && meetingDate <= end) {
          return { id: sprint.id, name: sprint.name };
        }
      }
    } catch {
      // Board might not have sprints
    }
  }
  return null;
}

export async function processMeetingsWithLLM(
  meetings: FellowMeetingInput[]
): Promise<ProcessedMeeting[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY environment variable");

  const anthropic = new Anthropic({ apiKey });
  const config = getConfig();
  const results: ProcessedMeeting[] = [];

  for (const meeting of meetings) {
    const summary =
      meeting.summaries?.[0]?.final_summary || meeting.note || "";
    if (!summary.trim()) continue;

    const teamName = detectTeam(meeting.title);
    const weekStart = getWeekStart(meeting.start_time);

    // Find sprint for this meeting date
    const sprint = await findSprintForDate(
      meeting.start_time,
      config.boardIds
    );

    // Call Claude to extract structured data
    const prompt = `Analyze this engineering team meeting and extract structured information.

Meeting: "${meeting.title}"
Date: ${meeting.start_time}
Team: ${teamName}

Meeting content:
${summary}

${meeting.note ? `\nMeeting notes:\n${meeting.note}` : ""}

Extract the following as JSON:
{
  "summary": "2-3 sentence summary of the meeting",
  "keyTopics": ["topic1", "topic2", ...],
  "blockers": [
    {"description": "what is blocked and why", "severity": "high|medium|low"}
  ],
  "actionItems": [
    {"description": "what needs to be done", "assignee": "person name or null", "dueDate": "YYYY-MM-DD or null"}
  ],
  "decisions": [
    {"description": "what was decided"}
  ]
}

Rules:
- Only include blockers that are actual impediments (something is preventing progress), not just to-do items
- severity: high = blocking critical path or multiple people, medium = blocking one person/story, low = minor impediment
- For action items, extract the assignee name if mentioned
- Be concise but specific
- Return valid JSON only, no markdown fences`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      // Parse JSON from response (handle potential markdown fences)
      const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      results.push({
        fellowMeetingId: meeting.meeting_id,
        teamName,
        boardId: null, // Will be mapped later if needed
        meetingTitle: meeting.title,
        meetingDate: meeting.start_time,
        weekStart,
        sprintName: sprint?.name || null,
        sprintId: sprint?.id || null,
        summary: parsed.summary || summary.slice(0, 500),
        keyTopics: parsed.keyTopics || [],
        participantCount: null,
        fellowUrl: meeting.url || null,
        blockers: (parsed.blockers || []).map(
          (b: { description: string; severity: string }) => ({
            description: b.description,
            severity: b.severity as "high" | "medium" | "low",
            jiraIssueKey: null,
          })
        ),
        actionItems: (parsed.actionItems || []).map(
          (a: {
            description: string;
            assignee: string | null;
            dueDate: string | null;
          }) => ({
            description: a.description,
            assignee: a.assignee || null,
            dueDate: a.dueDate || null,
          })
        ),
        decisions: (parsed.decisions || []).map(
          (d: { description: string }) => ({
            description: d.description,
          })
        ),
      });
    } catch (err) {
      console.error(`Failed to process meeting "${meeting.title}":`, err);
      // Still store the meeting with raw summary
      results.push({
        fellowMeetingId: meeting.meeting_id,
        teamName,
        boardId: null,
        meetingTitle: meeting.title,
        meetingDate: meeting.start_time,
        weekStart,
        sprintName: sprint?.name || null,
        sprintId: sprint?.id || null,
        summary: summary.slice(0, 500),
        keyTopics: [],
        participantCount: null,
        fellowUrl: meeting.url || null,
        blockers: [],
        actionItems: [],
        decisions: [],
      });
    }
  }

  return results;
}
