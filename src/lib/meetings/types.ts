export interface FellowMeetingInput {
  meeting_id: string;
  title: string;
  start_time: string;
  end_time: string;
  note_id?: number;
  note?: string;
  url?: string;
  summaries?: {
    final_summary?: string;
  }[];
  quotes?: {
    speaker?: string;
    text?: string;
    start_timestamp?: number;
  }[];
}

export interface ProcessedMeeting {
  fellowMeetingId: string;
  teamName: string;
  boardId: string | null;
  meetingTitle: string;
  meetingDate: string;
  weekStart: string;
  sprintName: string | null;
  sprintId: number | null;
  summary: string;
  keyTopics: string[];
  participantCount: number | null;
  fellowUrl: string | null;
  blockers: {
    description: string;
    severity: "high" | "medium" | "low";
    jiraIssueKey: string | null;
  }[];
  actionItems: {
    description: string;
    assignee: string | null;
    dueDate: string | null;
  }[];
  decisions: {
    description: string;
  }[];
}

export interface MeetingDigestResponse {
  id: number;
  fellowMeetingId: string;
  teamName: string;
  boardId: string | null;
  meetingTitle: string;
  meetingDate: string;
  weekStart: string;
  sprintName: string | null;
  summary: string;
  keyTopics: string[];
  participantCount: number | null;
  fellowUrl: string | null;
  blockers: {
    id: number;
    description: string;
    severity: "high" | "medium" | "low";
    jiraIssueKey: string | null;
    status: "open" | "resolved";
  }[];
  actionItems: {
    id: number;
    description: string;
    assignee: string | null;
    dueDate: string | null;
    completed: boolean;
  }[];
  decisions: {
    id: number;
    description: string;
  }[];
}

export interface MeetingsPageResponse {
  meetings: MeetingDigestResponse[];
  teams: string[];
  sprints: { id: number; name: string }[];
  weekStarts: string[];
  blockersSummary: {
    total: number;
    open: number;
    linkedToJira: number;
  };
  fetchedAt: string;
}

// Team → Board mapping (configured via env or auto-discovered)
export interface TeamBoardMapping {
  teamName: string;
  meetingPatterns: string[]; // Patterns to match meeting titles
  boardId: string | null;
}
