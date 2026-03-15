CREATE TABLE "backlog_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"health_score" integer NOT NULL,
	"total_items" integer NOT NULL,
	"estimated_items" integer,
	"stale_count" integer,
	"unestimated_count" integer,
	"zombie_count" integer,
	"dimensions_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cycle_time_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_key" text NOT NULL,
	"issue_type" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"cycle_days" real,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_id" integer NOT NULL,
	"description" text NOT NULL,
	"assignee" text,
	"due_date" date,
	"completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_blockers" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_id" integer NOT NULL,
	"description" text NOT NULL,
	"severity" text NOT NULL,
	"jira_issue_key" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"digest_id" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meeting_digests" (
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
);
--> statement-breakpoint
CREATE TABLE "sprint_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"sprint_id" integer NOT NULL,
	"sprint_name" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"velocity" real,
	"completion_rate" real,
	"total_points" real,
	"completed_points" real,
	"in_progress_points" real,
	"todo_points" real,
	"carryover" integer,
	"scope_change_pct" real,
	"blocker_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "velocity_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"sprint_id" integer NOT NULL,
	"sprint_name" text NOT NULL,
	"committed_points" real,
	"completed_points" real,
	"sprint_end_date" date,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "velocity_history_sprint_id_unique" UNIQUE("sprint_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_date" date NOT NULL,
	"report_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
