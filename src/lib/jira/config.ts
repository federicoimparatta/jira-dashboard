import { DashboardConfig } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig(): DashboardConfig {
  return {
    jiraBaseUrl: requireEnv("JIRA_BASE_URL").replace(/\/$/, ""),
    projectKey: requireEnv("JIRA_PROJECT_KEY"),
    boardId: requireEnv("JIRA_BOARD_ID"),
    wipLimit: parseInt(process.env.WIP_LIMIT || "3", 10),
    staleDays: parseInt(process.env.STALE_DAYS || "60", 10),
    zombieDays: parseInt(process.env.ZOMBIE_DAYS || "90", 10),
    sprintIsrTtl: parseInt(process.env.SPRINT_ISR_TTL || "300", 10),
    backlogIsrTtl: parseInt(process.env.BACKLOG_ISR_TTL || "1800", 10),
    reportDay: parseInt(process.env.REPORT_DAY || "1", 10),
    storyPointsField: process.env.STORY_POINTS_FIELD || null,
  };
}

export function getJiraAuth(): { email: string; token: string } {
  return {
    email: requireEnv("JIRA_API_EMAIL"),
    token: requireEnv("JIRA_API_TOKEN"),
  };
}

export function getCronSecret(): string {
  return requireEnv("CRON_SECRET");
}
