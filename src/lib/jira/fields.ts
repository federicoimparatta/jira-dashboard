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
  "parent",
];

// Build field list with dynamic story points and initiative fields
export function getIssueFields(
  storyPointsField: string | null,
  initiativeField?: string | null
): string[] {
  const fields = [...ISSUE_FIELDS];
  if (storyPointsField) {
    fields.push(storyPointsField);
  }
  if (initiativeField) {
    fields.push(initiativeField);
  }
  return fields;
}
