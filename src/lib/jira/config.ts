import { DashboardConfig } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseBoardIds(): string[] {
  // Try new JIRA_BOARD_IDS format first (comma-separated)
  const boardIdsEnv = process.env.JIRA_BOARD_IDS;
  if (boardIdsEnv) {
    return boardIdsEnv.split(',').map(id => id.trim()).filter(Boolean);
  }

  // Fallback to legacy JIRA_BOARD_ID (single board)
  const boardIdEnv = process.env.JIRA_BOARD_ID;
  if (boardIdEnv) {
    return [boardIdEnv];
  }

  throw new Error("Missing required environment variable: JIRA_BOARD_ID or JIRA_BOARD_IDS");
}

export function getConfig(): DashboardConfig {
  const boardIds = parseBoardIds();
  return {
    jiraBaseUrl: requireEnv("JIRA_BASE_URL").replace(/\/$/, ""),
    projectKey: requireEnv("JIRA_PROJECT_KEY"),
    boardId: boardIds[0], // @deprecated - first board for backward compatibility
    boardIds,
    wipLimit: parseInt(process.env.WIP_LIMIT || "3", 10),
    staleDays: parseInt(process.env.STALE_DAYS || "60", 10),
    zombieDays: parseInt(process.env.ZOMBIE_DAYS || "90", 10),
    sprintIsrTtl: parseInt(process.env.SPRINT_ISR_TTL || "300", 10),
    backlogIsrTtl: parseInt(process.env.BACKLOG_ISR_TTL || "1800", 10),
    reportDay: parseInt(process.env.REPORT_DAY || "1", 10),
    storyPointsField: process.env.STORY_POINTS_FIELD || null,
    initiativeField: process.env.INITIATIVE_FIELD || null,
    readyStatuses: (process.env.READY_STATUSES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
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
