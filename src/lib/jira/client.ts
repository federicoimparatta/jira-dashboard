import { getConfig, getJiraAuth } from "./config";
import { JiraIssue, JiraSprint, ChangelogHistory } from "./types";

function getHeaders(): HeadersInit {
  const { email, token } = getJiraAuth();
  const encoded = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function jiraFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const config = getConfig();
  const url = `${config.jiraBaseUrl}${path}`;
  const headers = getHeaders();

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
      cache: "no-store",
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
      const jitter = Math.random() * 1000;
      const delay = retryAfter * 1000 + jitter;
      console.warn(`Rate limited by Jira. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      retries++;
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Jira API error ${res.status}: ${res.statusText} - ${body}`
      );
    }

    return res.json() as Promise<T>;
  }

  throw new Error("Jira API: max retries exceeded after rate limiting");
}

// Paginate using the v3 search/jql endpoint with nextPageToken
export async function fetchAllIssues(
  jql: string,
  fields: string[],
  options?: { expand?: string }
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let nextPageToken: string | null = null;
  let restartCount = 0;
  const maxRestarts = 2;

  do {
    try {
      const body: Record<string, unknown> = {
        jql,
        fields,
        maxResults: 100,
      };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      if (options?.expand) body.expand = options.expand;

      const data = await jiraFetch<{
        issues: JiraIssue[];
        nextPageToken?: string;
      }>("/rest/api/3/search/jql", {
        method: "POST",
        body: JSON.stringify(body),
      });

      allIssues.push(...data.issues);
      nextPageToken = data.nextPageToken || null;
    } catch (err) {
      // Token expired, restart pagination
      if (restartCount < maxRestarts) {
        console.warn("Pagination token expired, restarting...");
        allIssues.length = 0;
        nextPageToken = null;
        restartCount++;
      } else {
        throw err;
      }
    }
  } while (nextPageToken);

  return allIssues;
}

// Fetch sprints from agile API (offset-based pagination)
// Board-specific version - use this for multi-board support
export async function fetchSprintsForBoard(
  boardId: string,
  state?: "active" | "future" | "closed"
): Promise<JiraSprint[]> {
  const allSprints: JiraSprint[] = [];
  let startAt = 0;
  const maxResults = 50;

  do {
    const stateParam = state ? `&state=${state}` : "";
    const data = await jiraFetch<{
      values: JiraSprint[];
      isLast: boolean;
    }>(
      `/rest/agile/1.0/board/${boardId}/sprint?startAt=${startAt}&maxResults=${maxResults}${stateParam}`
    );

    allSprints.push(...data.values);
    if (data.isLast || data.values.length < maxResults) break;
    startAt += maxResults;
  } while (true);

  return allSprints;
}

// @deprecated - use fetchSprintsForBoard instead
export async function fetchSprints(
  state?: "active" | "future" | "closed"
): Promise<JiraSprint[]> {
  const config = getConfig();
  return fetchSprintsForBoard(config.boardId, state);
}

// Fetch issues in a specific sprint (agile API, offset-based)
export async function fetchSprintIssues(
  sprintId: number,
  fields: string[]
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  do {
    const data = await jiraFetch<{
      issues: JiraIssue[];
      total: number;
    }>(
      `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${fields.join(",")}`
    );

    allIssues.push(...data.issues);
    if (startAt + maxResults >= data.total) break;
    startAt += maxResults;
  } while (true);

  return allIssues;
}

// Fetch backlog issues (agile API, offset-based)
// Board-specific version - use this for multi-board support
export async function fetchBacklogIssuesForBoard(
  boardId: string,
  fields: string[]
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  do {
    const data = await jiraFetch<{
      issues: JiraIssue[];
      total: number;
    }>(
      `/rest/agile/1.0/board/${boardId}/backlog?startAt=${startAt}&maxResults=${maxResults}&fields=${fields.join(",")}`
    );

    allIssues.push(...data.issues);
    if (startAt + maxResults >= data.total) break;
    startAt += maxResults;
  } while (true);

  return allIssues;
}

// @deprecated - use fetchBacklogIssuesForBoard instead
export async function fetchBacklogIssues(
  fields: string[]
): Promise<JiraIssue[]> {
  const config = getConfig();
  return fetchBacklogIssuesForBoard(config.boardId, fields);
}

// Fetch changelog for a single issue
export async function fetchIssueChangelog(
  issueKey: string
): Promise<ChangelogHistory[]> {
  const allHistories: ChangelogHistory[] = [];
  let startAt = 0;
  const maxResults = 100;

  do {
    const data = await jiraFetch<{
      values: ChangelogHistory[];
      isLast: boolean;
    }>(
      `/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=${maxResults}`
    );

    allHistories.push(...data.values);
    if (data.isLast || data.values.length < maxResults) break;
    startAt += maxResults;
  } while (true);

  return allHistories;
}

// Fetch non-done epics for a specific board (agile API, offset-based)
export async function fetchBoardEpics(
  boardId: string
): Promise<{ id: number; key: string; name: string; done: boolean }[]> {
  const allEpics: { id: number; key: string; name: string; done: boolean }[] = [];
  let startAt = 0;
  const maxResults = 50;

  do {
    const data = await jiraFetch<{
      values: { id: number; key: string; name: string; done: boolean }[];
      isLast: boolean;
    }>(
      `/rest/agile/1.0/board/${boardId}/epic?done=false&startAt=${startAt}&maxResults=${maxResults}`
    );

    allEpics.push(...data.values);
    if (data.isLast || data.values.length < maxResults) break;
    startAt += maxResults;
  } while (true);

  return allEpics;
}

// Fetch the display name of a board
export async function fetchBoardName(boardId: string): Promise<string> {
  try {
    const data = await jiraFetch<{ id: number; name: string }>(
      `/rest/agile/1.0/board/${boardId}`
    );
    return data.name || `Board ${boardId}`;
  } catch {
    console.warn(`Failed to fetch board ${boardId} name`);
    return `Board ${boardId}`;
  }
}

// Discover story points custom field ID
export async function discoverStoryPointsField(): Promise<string | null> {
  const fields = await jiraFetch<{ id: string; name: string }[]>(
    "/rest/api/3/field"
  );

  // Common names for story points field
  const names = ["story points", "story point estimate", "story point"];
  const field = fields.find((f) =>
    names.includes(f.name.toLowerCase())
  );

  return field?.id || null;
}

// Discover initiative custom field ID
export async function discoverInitiativeField(): Promise<string | null> {
  const fields = await jiraFetch<{ id: string; name: string }[]>(
    "/rest/api/3/field"
  );

  const names = ["initiative", "initiative name", "initiative link"];
  const field = fields.find((f) =>
    names.includes(f.name.toLowerCase())
  );

  return field?.id || null;
}

// Resolve which parent (epic) keys are linked to an initiative via the parent chain.
// Collects parent keys from issues, then batch-fetches those parents to check
// if they themselves have a parent (the initiative level).
export async function resolveInitiativeLinkedEpics(
  issues: JiraIssue[]
): Promise<Set<string>> {
  const parentKeys = new Set<string>();
  for (const issue of issues) {
    const parent = issue.fields.parent as
      | { key: string }
      | undefined;
    if (parent?.key) {
      parentKeys.add(parent.key);
    }
  }

  if (parentKeys.size === 0) return new Set();

  const linkedKeys = new Set<string>();
  const keyList = Array.from(parentKeys);

  // Batch in chunks of 50 to stay within JQL IN-clause limits
  for (let i = 0; i < keyList.length; i += 50) {
    const chunk = keyList.slice(i, i + 50);
    const jql = `key in (${chunk.join(",")})`;
    const epics = await fetchAllIssues(jql, ["parent"]);
    for (const epic of epics) {
      const epicParent = epic.fields.parent as
        | { key: string }
        | undefined;
      if (epicParent?.key) {
        linkedKeys.add(epic.key);
      }
    }
  }

  return linkedKeys;
}

// T-shirt size to story point mapping
const TSHIRT_TO_SP: Record<string, number> = {
  xs: 1,
  s: 2,
  m: 5,
  l: 8,
  xl: 13,
  xxl: 21,
};

function parseTShirtSize(raw: unknown): number {
  const str =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "value" in raw
        ? String((raw as { value: unknown }).value)
        : null;
  if (!str) return 0;
  return TSHIRT_TO_SP[str.trim().toLowerCase()] ?? 0;
}

// Get story points from an issue, using discovered or configured field
export function getStoryPoints(
  issue: JiraIssue,
  storyPointsField: string
): number {
  const value = issue.fields[storyPointsField];
  if (typeof value === "number") return value;
  return parseTShirtSize(value);
}
