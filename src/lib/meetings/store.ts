import { getDatabase } from "@/db";
import {
  meetingDigests,
  meetingBlockers,
  meetingActionItems,
  meetingDecisions,
} from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import type { ProcessedMeeting, MeetingDigestResponse } from "./types";

export async function storeMeetings(
  meetings: ProcessedMeeting[]
): Promise<number> {
  const db = getDatabase();
  let stored = 0;

  for (const m of meetings) {
    // Upsert: skip if already exists
    const existing = await db
      .select({ id: meetingDigests.id })
      .from(meetingDigests)
      .where(eq(meetingDigests.fellowMeetingId, m.fellowMeetingId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing digest
      const digestId = existing[0].id;
      await db
        .update(meetingDigests)
        .set({
          summary: m.summary,
          keyTopics: m.keyTopics,
          sprintName: m.sprintName,
          sprintId: m.sprintId,
          processedAt: new Date(),
        })
        .where(eq(meetingDigests.id, digestId));

      // Replace child records
      await db
        .delete(meetingBlockers)
        .where(eq(meetingBlockers.digestId, digestId));
      await db
        .delete(meetingActionItems)
        .where(eq(meetingActionItems.digestId, digestId));
      await db
        .delete(meetingDecisions)
        .where(eq(meetingDecisions.digestId, digestId));

      await insertChildren(db, digestId, m);
      stored++;
      continue;
    }

    // Insert new digest
    const [inserted] = await db
      .insert(meetingDigests)
      .values({
        fellowMeetingId: m.fellowMeetingId,
        teamName: m.teamName,
        boardId: m.boardId,
        meetingTitle: m.meetingTitle,
        meetingDate: new Date(m.meetingDate),
        weekStart: m.weekStart,
        sprintName: m.sprintName,
        sprintId: m.sprintId,
        summary: m.summary,
        keyTopics: m.keyTopics,
        participantCount: m.participantCount,
        fellowUrl: m.fellowUrl,
      })
      .returning({ id: meetingDigests.id });

    await insertChildren(db, inserted.id, m);
    stored++;
  }

  return stored;
}

async function insertChildren(
  db: ReturnType<typeof getDatabase>,
  digestId: number,
  m: ProcessedMeeting
) {
  if (m.blockers.length > 0) {
    await db.insert(meetingBlockers).values(
      m.blockers.map((b) => ({
        digestId,
        description: b.description,
        severity: b.severity,
        jiraIssueKey: b.jiraIssueKey,
        status: "open" as const,
      }))
    );
  }

  if (m.actionItems.length > 0) {
    await db.insert(meetingActionItems).values(
      m.actionItems.map((a) => ({
        digestId,
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        completed: false,
      }))
    );
  }

  if (m.decisions.length > 0) {
    await db.insert(meetingDecisions).values(
      m.decisions.map((d) => ({
        digestId,
        description: d.description,
      }))
    );
  }
}

export async function queryMeetings(filters: {
  team?: string;
  weekStart?: string;
  sprintName?: string;
  from?: string;
  to?: string;
}): Promise<MeetingDigestResponse[]> {
  const db = getDatabase();

  const conditions = [];
  if (filters.team) {
    conditions.push(eq(meetingDigests.teamName, filters.team));
  }
  if (filters.weekStart) {
    conditions.push(eq(meetingDigests.weekStart, filters.weekStart));
  }
  if (filters.sprintName) {
    conditions.push(eq(meetingDigests.sprintName, filters.sprintName));
  }
  if (filters.from) {
    conditions.push(gte(meetingDigests.meetingDate, new Date(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(meetingDigests.meetingDate, new Date(filters.to)));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const digests = await db
    .select()
    .from(meetingDigests)
    .where(whereClause)
    .orderBy(desc(meetingDigests.meetingDate))
    .limit(100);

  // Fetch children for each digest
  const results: MeetingDigestResponse[] = [];

  for (const d of digests) {
    const [blockers, actions, decisions] = await Promise.all([
      db
        .select()
        .from(meetingBlockers)
        .where(eq(meetingBlockers.digestId, d.id)),
      db
        .select()
        .from(meetingActionItems)
        .where(eq(meetingActionItems.digestId, d.id)),
      db
        .select()
        .from(meetingDecisions)
        .where(eq(meetingDecisions.digestId, d.id)),
    ]);

    results.push({
      id: d.id,
      fellowMeetingId: d.fellowMeetingId,
      teamName: d.teamName,
      boardId: d.boardId,
      meetingTitle: d.meetingTitle,
      meetingDate: d.meetingDate.toISOString(),
      weekStart: d.weekStart,
      sprintName: d.sprintName,
      summary: d.summary,
      keyTopics: (d.keyTopics as string[]) || [],
      participantCount: d.participantCount,
      fellowUrl: d.fellowUrl,
      blockers: blockers.map((b) => ({
        id: b.id,
        description: b.description,
        severity: b.severity as "high" | "medium" | "low",
        jiraIssueKey: b.jiraIssueKey,
        status: b.status as "open" | "resolved",
      })),
      actionItems: actions.map((a) => ({
        id: a.id,
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        completed: a.completed ?? false,
      })),
      decisions: decisions.map((dd) => ({
        id: dd.id,
        description: dd.description,
      })),
    });
  }

  return results;
}

export async function getMeetingsMeta(): Promise<{
  teams: string[];
  sprints: { id: number; name: string }[];
  weekStarts: string[];
}> {
  const db = getDatabase();

  const [teamsResult, sprintsResult, weeksResult] = await Promise.all([
    db
      .selectDistinct({ teamName: meetingDigests.teamName })
      .from(meetingDigests)
      .orderBy(meetingDigests.teamName),
    db
      .selectDistinct({
        sprintId: meetingDigests.sprintId,
        sprintName: meetingDigests.sprintName,
      })
      .from(meetingDigests)
      .where(sql`${meetingDigests.sprintName} IS NOT NULL`)
      .orderBy(desc(meetingDigests.sprintId)),
    db
      .selectDistinct({ weekStart: meetingDigests.weekStart })
      .from(meetingDigests)
      .orderBy(desc(meetingDigests.weekStart)),
  ]);

  return {
    teams: teamsResult.map((t) => t.teamName),
    sprints: sprintsResult
      .filter((s) => s.sprintId && s.sprintName)
      .map((s) => ({ id: s.sprintId!, name: s.sprintName! })),
    weekStarts: weeksResult.map((w) => w.weekStart),
  };
}

export async function getBlockersSummary(): Promise<{
  total: number;
  open: number;
  linkedToJira: number;
}> {
  const db = getDatabase();

  const [total, open, linked] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(meetingBlockers),
    db
      .select({ count: sql<number>`count(*)` })
      .from(meetingBlockers)
      .where(eq(meetingBlockers.status, "open")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(meetingBlockers)
      .where(sql`${meetingBlockers.jiraIssueKey} IS NOT NULL`),
  ]);

  return {
    total: Number(total[0]?.count || 0),
    open: Number(open[0]?.count || 0),
    linkedToJira: Number(linked[0]?.count || 0),
  };
}
