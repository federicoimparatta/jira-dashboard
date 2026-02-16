export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: {
        key: string; // "new" | "indeterminate" | "done"
        name: string;
      };
    };
    assignee: {
      displayName: string;
      accountId: string;
      emailAddress?: string;
    } | null;
    priority: {
      name: string;
      id: string;
    };
    issuetype: {
      name: string;
      subtask: boolean;
    };
    created: string;
    updated: string;
    description?: unknown;
    flagged?: boolean;
    [key: string]: unknown; // for custom fields like story points
  };
  changelog?: {
    histories: ChangelogHistory[];
  };
}

export interface ChangelogHistory {
  id: string;
  created: string;
  items: ChangelogItem[];
}

export interface ChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface JiraSprint {
  id: number;
  self: string;
  state: "active" | "future" | "closed";
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
}

export interface SprintData {
  sprint: JiraSprint;
  issues: JiraIssue[];
  totalPoints: number;
  completedPoints: number;
  inProgressPoints: number;
  todoPoints: number;
  completionRate: number;
  burndown: BurndownPoint[];
  blockers: JiraIssue[];
  wipPerAssignee: Record<string, { count: number; points: number }>;
  unassignedCount: number;
  scopeChange: {
    added: number;
    removed: number;
    net: number;
  };
  avgCycleTime: number | null;
  avgLeadTime: number | null;
}

export interface BurndownPoint {
  date: string;
  ideal: number;
  actual: number;
}

export interface BacklogData {
  issues: JiraIssue[];
  healthScore: number;
  dimensions: BacklogDimension[];
  alerts: BacklogAlert[];
  totalItems: number;
  estimatedItems: number;
  staleItems: number;
  zombieItems: number;
}

export interface BacklogDimension {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  detail: string;
}

export interface BacklogAlert {
  type: "stale" | "zombie" | "unestimated" | "priority_inflation";
  message: string;
  count: number;
  issues: string[]; // issue keys
}

export interface ChildIssue {
  key: string;
  summary: string;
  status: {
    name: string;
    categoryKey: string;
  };
  assignee: string | null;
  storyPoints: number;
  issuetype: string;
  priority: {
    name: string;
    id: string;
  };
}

export interface EpicProgress {
  key: string;
  summary: string;
  status: {
    name: string;
    categoryKey: string; // "new" | "indeterminate" | "done"
  };
  assignee: string | null;
  priority: {
    name: string;
    id: string;
  };
  childIssues: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
  };
  storyPoints: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
  };
  updated: string;
  children: ChildIssue[];
  boardIds: string[];
}

export interface BoardGroup {
  boardId: string;
  boardName: string;
  epics: EpicProgress[];
  summary: {
    totalEpics: number;
    totalChildIssues: number;
    totalDoneChildIssues: number;
    avgCompletionRate: number;
  };
}

export interface VelocityPoint {
  sprintId: number;
  sprintName: string;
  committed: number;
  completed: number;
  endDate: string;
}

export interface CycleTimeEntry {
  issueKey: string;
  issueType: string;
  startDate: string;
  endDate: string;
  cycleDays: number;
}

export interface WeeklyReport {
  reportDate: string;
  sprintSummary: {
    name: string;
    velocity: number;
    completionRate: number;
    carryover: number;
  };
  throughput: {
    total: number;
    byType: Record<string, number>;
    weekOverWeekDelta: number;
  };
  cycleTime: {
    average: number;
    median: number;
    p90: number;
  };
  blockers: {
    key: string;
    summary: string;
    daysBlocked: number;
  }[];
  teamLoad: Record<
    string,
    {
      issues: number;
      points: number;
      wipViolation: boolean;
    }
  >;
  backlogHealth: {
    score: number;
    flags: string[];
  };
  velocityTrend: VelocityPoint[];
}

export interface BoardSprintSummary {
  boardId: string;
  boardName: string;
  sprint: {
    id: number;
    name: string;
    state: string;
    startDate?: string;
    endDate?: string;
    goal?: string;
  };
  progress: {
    totalPoints: number;
    completedPoints: number;
    inProgressPoints: number;
    todoPoints: number;
    completionRate: number;
  };
  issueCount: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
  };
  blockers: {
    key: string;
    summary: string;
    assignee: string;
    status: string;
  }[];
}

export interface OverviewSprintResponse {
  mode: "overview";
  boards: BoardSprintSummary[];
  aggregate: {
    totalPoints: number;
    completedPoints: number;
    inProgressPoints: number;
    todoPoints: number;
    completionRate: number;
    totalIssues: number;
    totalDone: number;
    totalInProgress: number;
    totalTodo: number;
    avgCycleTime: number | null;
    avgLeadTime: number | null;
    scopeChange: { added: number; removed: number; net: number };
  };
  wipPerAssignee: Record<string, { count: number; points: number }>;
  unassignedCount: number;
  blockers: {
    key: string;
    summary: string;
    assignee: string;
    status: string;
    boardName: string;
  }[];
  jiraBaseUrl: string;
  fetchedAt: string;
}

export interface DashboardConfig {
  jiraBaseUrl: string;
  projectKey: string;
  boardId: string; // @deprecated - use boardIds instead
  boardIds: string[]; // Array of board IDs for multi-board support
  wipLimit: number;
  staleDays: number;
  zombieDays: number;
  sprintIsrTtl: number;
  backlogIsrTtl: number;
  reportDay: number;
  storyPointsField: string | null;
}
