// Standard fields to request for sprint/backlog issues
export const ISSUE_FIELDS = [
  "summary",
  "status",
  "assignee",
  "priority",
  "issuetype",
  "created",
  "updated",
  "description",
  "flagged",
  "labels",
  "issuelinks",
];

// Build field list with dynamic story points field
export function getIssueFields(storyPointsField: string | null): string[] {
  const fields = [...ISSUE_FIELDS];
  if (storyPointsField) {
    fields.push(storyPointsField);
  }
  return fields;
}
