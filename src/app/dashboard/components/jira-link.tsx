"use client";

export function JiraLink({
  issueKey,
  jiraBaseUrl,
  className,
}: {
  issueKey: string;
  jiraBaseUrl?: string;
  className?: string;
}) {
  if (!jiraBaseUrl) {
    return <span className={className}>{issueKey}</span>;
  }

  return (
    <a
      href={`${jiraBaseUrl}/browse/${issueKey}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`${className ?? ""} hover:underline`}
    >
      {issueKey}
    </a>
  );
}
