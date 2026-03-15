import {
  pgTable,
  serial,
  integer,
  text,
  date,
  real,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

export const sprintSnapshots = pgTable("sprint_snapshots", {
  id: serial("id").primaryKey(),
  sprintId: integer("sprint_id").notNull(),
  sprintName: text("sprint_name").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  velocity: real("velocity"),
  completionRate: real("completion_rate"),
  totalPoints: real("total_points"),
  completedPoints: real("completed_points"),
  inProgressPoints: real("in_progress_points"),
  todoPoints: real("todo_points"),
  carryover: integer("carryover"),
  scopeChangePct: real("scope_change_pct"),
  blockerCount: integer("blocker_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const backlogSnapshots = pgTable("backlog_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  healthScore: integer("health_score").notNull(),
  totalItems: integer("total_items").notNull(),
  estimatedItems: integer("estimated_items"),
  staleCount: integer("stale_count"),
  unestimatedCount: integer("unestimated_count"),
  zombieCount: integer("zombie_count"),
  dimensionsJson: jsonb("dimensions_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cycleTimeLog = pgTable("cycle_time_log", {
  id: serial("id").primaryKey(),
  issueKey: text("issue_key").notNull(),
  issueType: text("issue_type").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  cycleDays: real("cycle_days"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const velocityHistory = pgTable("velocity_history", {
  id: serial("id").primaryKey(),
  sprintId: integer("sprint_id").notNull().unique(),
  sprintName: text("sprint_name").notNull(),
  committedPoints: real("committed_points"),
  completedPoints: real("completed_points"),
  sprintEndDate: date("sprint_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyReports = pgTable("weekly_reports", {
  id: serial("id").primaryKey(),
  reportDate: date("report_date").notNull(),
  reportJson: jsonb("report_json").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Meeting Intelligence (Fellow integration) ──────────────────────

export const meetingDigests = pgTable("meeting_digests", {
  id: serial("id").primaryKey(),
  fellowMeetingId: text("fellow_meeting_id").notNull().unique(),
  teamName: text("team_name").notNull(),
  boardId: text("board_id"),
  meetingTitle: text("meeting_title").notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  weekStart: date("week_start").notNull(),
  sprintName: text("sprint_name"),
  sprintId: integer("sprint_id"),
  summary: text("summary").notNull(),
  keyTopics: jsonb("key_topics").$type<string[]>(),
  participantCount: integer("participant_count"),
  fellowUrl: text("fellow_url"),
  rawJson: jsonb("raw_json"),
  processedAt: timestamp("processed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingBlockers = pgTable("meeting_blockers", {
  id: serial("id").primaryKey(),
  digestId: integer("digest_id").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().$type<"high" | "medium" | "low">(),
  jiraIssueKey: text("jira_issue_key"),
  status: text("status").notNull().$type<"open" | "resolved">().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingActionItems = pgTable("meeting_action_items", {
  id: serial("id").primaryKey(),
  digestId: integer("digest_id").notNull(),
  description: text("description").notNull(),
  assignee: text("assignee"),
  dueDate: date("due_date"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetingDecisions = pgTable("meeting_decisions", {
  id: serial("id").primaryKey(),
  digestId: integer("digest_id").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
