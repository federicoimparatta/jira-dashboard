import { cookies } from "next/headers";
import { DashboardConfig } from "./types";

const JIRA_CREDS_COOKIE = "dash-jira-creds";
const BOARD_CONFIG_COOKIE = "dash-board-config";

interface JiraCreds {
  jiraBaseUrl: string;
  email: string;
  apiToken: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Read Jira credentials from the user's session cookie.
 * Falls back to env vars for cron jobs or when cookies aren't available.
 */
export async function getJiraCredsFromCookies(): Promise<JiraCreds | null> {
  try {
    const cookieStore = await cookies();
    const credsCookie = cookieStore.get(JIRA_CREDS_COOKIE);
    if (!credsCookie?.value) return null;
    const decoded = Buffer.from(credsCookie.value, "base64").toString("utf-8");
    return JSON.parse(decoded) as JiraCreds;
  } catch {
    return null;
  }
}

/**
 * Read the user's selected board IDs from their session cookie.
 */
export async function getBoardIdsFromCookies(): Promise<string[] | null> {
  try {
    const cookieStore = await cookies();
    const boardCookie = cookieStore.get(BOARD_CONFIG_COOKIE);
    if (!boardCookie?.value) return null;
    const decoded = Buffer.from(boardCookie.value, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as { boardIds: string[]; projectKey?: string };
    return parsed.boardIds;
  } catch {
    return null;
  }
}

/**
 * Read the user's selected project key from their session cookie.
 */
export async function getProjectKeyFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const boardCookie = cookieStore.get(BOARD_CONFIG_COOKIE);
    if (!boardCookie?.value) return null;
    const decoded = Buffer.from(boardCookie.value, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as { boardIds: string[]; projectKey?: string };
    return parsed.projectKey || null;
  } catch {
    return null;
  }
}

function parseBoardIdsFromEnv(): string[] {
  const boardIdsEnv = process.env.JIRA_BOARD_IDS;
  if (boardIdsEnv) {
    return boardIdsEnv.split(",").map((id) => id.trim()).filter(Boolean);
  }
  const boardIdEnv = process.env.JIRA_BOARD_ID;
  if (boardIdEnv) {
    return [boardIdEnv];
  }
  return [];
}

/**
 * Get the dashboard config.
 * Reads from user cookies first, falls back to env vars.
 */
export async function getConfig(): Promise<DashboardConfig> {
  const creds = await getJiraCredsFromCookies();
  const cookieBoardIds = await getBoardIdsFromCookies();
  const cookieProjectKey = await getProjectKeyFromCookies();

  const jiraBaseUrl = creds?.jiraBaseUrl || process.env.JIRA_BASE_URL || "";
  const boardIds = cookieBoardIds?.length ? cookieBoardIds : parseBoardIdsFromEnv();
  const projectKey = cookieProjectKey || process.env.JIRA_PROJECT_KEY || "";

  if (!jiraBaseUrl) {
    throw new Error("Jira is not configured. Please log in at /login.");
  }
  if (boardIds.length === 0) {
    throw new Error("No boards configured. Please select boards at /setup.");
  }

  return {
    jiraBaseUrl: jiraBaseUrl.replace(/\/$/, ""),
    projectKey,
    boardId: boardIds[0],
    boardIds,
    wipLimit: parseInt(process.env.WIP_LIMIT || "3", 10),
    staleDays: parseInt(process.env.STALE_DAYS || "60", 10),
    zombieDays: parseInt(process.env.ZOMBIE_DAYS || "90", 10),
    sprintIsrTtl: parseInt(process.env.SPRINT_ISR_TTL || "300", 10),
    backlogIsrTtl: parseInt(process.env.BACKLOG_ISR_TTL || "1800", 10),
    reportDay: parseInt(process.env.REPORT_DAY || "1", 10),
    storyPointsField: process.env.STORY_POINTS_FIELD || null,
    initiativeField: process.env.INITIATIVE_FIELD || null,
    startDateField: process.env.START_DATE_FIELD || "customfield_10015",
    endDateField: process.env.END_DATE_FIELD || "duedate",
    readyStatuses: (process.env.READY_STATUSES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/**
 * Get Jira auth credentials.
 * Reads from user cookies first, falls back to env vars.
 */
export async function getJiraAuth(): Promise<{ email: string; token: string }> {
  const creds = await getJiraCredsFromCookies();
  if (creds) {
    return { email: creds.email, token: creds.apiToken };
  }

  // Fallback to env vars (for cron jobs)
  const email = process.env.JIRA_API_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (email && token) {
    return { email, token };
  }

  throw new Error("Jira credentials not found. Please log in at /login.");
}

export function getCronSecret(): string {
  return requireEnv("CRON_SECRET");
}
