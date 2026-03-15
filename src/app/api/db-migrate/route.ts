import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

export async function POST() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: "No database URL" }, { status: 500 });
  }

  const pool = new Pool({ connectionString: databaseUrl });

  const statements = [
    `CREATE TABLE IF NOT EXISTS "meeting_digests" (
      "id" serial PRIMARY KEY NOT NULL,
      "fellow_meeting_id" text NOT NULL,
      "team_name" text NOT NULL,
      "board_id" text,
      "meeting_title" text NOT NULL,
      "meeting_date" timestamp NOT NULL,
      "week_start" date NOT NULL,
      "sprint_name" text,
      "sprint_id" integer,
      "summary" text NOT NULL,
      "key_topics" jsonb,
      "participant_count" integer,
      "fellow_url" text,
      "raw_json" jsonb,
      "processed_at" timestamp DEFAULT now(),
      "created_at" timestamp DEFAULT now(),
      CONSTRAINT "meeting_digests_fellow_meeting_id_unique" UNIQUE("fellow_meeting_id")
    )`,
    `CREATE TABLE IF NOT EXISTS "meeting_blockers" (
      "id" serial PRIMARY KEY NOT NULL,
      "digest_id" integer NOT NULL,
      "description" text NOT NULL,
      "severity" text NOT NULL,
      "jira_issue_key" text,
      "status" text DEFAULT 'open' NOT NULL,
      "created_at" timestamp DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "meeting_action_items" (
      "id" serial PRIMARY KEY NOT NULL,
      "digest_id" integer NOT NULL,
      "description" text NOT NULL,
      "assignee" text,
      "due_date" date,
      "completed" boolean DEFAULT false,
      "created_at" timestamp DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS "meeting_decisions" (
      "id" serial PRIMARY KEY NOT NULL,
      "digest_id" integer NOT NULL,
      "description" text NOT NULL,
      "created_at" timestamp DEFAULT now()
    )`,
  ];

  const results = [];
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      results.push({ status: "ok" });
    } catch (err) {
      results.push({ status: "error", error: String(err) });
    }
  }

  await pool.end();
  return NextResponse.json({ success: true, results });
}
