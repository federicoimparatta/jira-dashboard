"use client";

import { PrStatusBadge, getPrDisplayStatusFromLight } from "./pr-status-badge";
import { JiraLink } from "./jira-link";
import type { PRStatus } from "@/lib/github/types";

interface SprintIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  issueType: string | null;
}

interface GitHubSprintTableProps {
  issues: SprintIssue[];
  prStatuses: Record<string, PRStatus>;
  jiraBaseUrl?: string;
}

const statusCategoryOrder: Record<string, number> = {
  indeterminate: 0, // In Progress first
  new: 1,           // To Do second
  done: 2,          // Done last
};

function sortIssues(
  issues: SprintIssue[],
  prStatuses: Record<string, PRStatus>
): SprintIssue[] {
  return [...issues].sort((a, b) => {
    const aPR = prStatuses[a.key];
    const bPR = prStatuses[b.key];
    const aInProgress = a.statusCategory === "indeterminate";
    const bInProgress = b.statusCategory === "indeterminate";
    const aHasPR = aPR?.hasPR ?? false;
    const bHasPR = bPR?.hasPR ?? false;

    // In-progress without PR first (bottlenecks)
    if (aInProgress && !aHasPR && !(bInProgress && !bHasPR)) return -1;
    if (bInProgress && !bHasPR && !(aInProgress && !aHasPR)) return 1;

    // Then by status category
    const aCatOrder = statusCategoryOrder[a.statusCategory] ?? 1;
    const bCatOrder = statusCategoryOrder[b.statusCategory] ?? 1;
    if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder;

    // Within same category, PRs with open state first, then merged
    const stateOrder: Record<string, number> = { open: 0, merged: 1, closed: 2 };
    const aPROrder = aHasPR ? (stateOrder[aPR.prState ?? ""] ?? 3) : 3;
    const bPROrder = bHasPR ? (stateOrder[bPR.prState ?? ""] ?? 3) : 3;
    if (aPROrder !== bPROrder) return aPROrder - bPROrder;

    return a.key.localeCompare(b.key);
  });
}

function getRowBg(issue: SprintIssue, prStatus: PRStatus | undefined): string {
  if (issue.statusCategory === "done") return "opacity-60";
  if (issue.statusCategory === "indeterminate") {
    if (!prStatus?.hasPR) return "bg-red-50/50";
    if (prStatus.prState === "merged") return "bg-emerald-50/50";
  }
  return "";
}

export function GitHubSprintTable({
  issues,
  prStatuses,
  jiraBaseUrl,
}: GitHubSprintTableProps) {
  const sorted = sortIssues(issues, prStatuses);

  if (sorted.length === 0) return null;

  return (
    <div className="smg-card overflow-hidden">
      <div className="px-6 py-4">
        <h2 className="smg-section-label">Sprint Issues + GitHub</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-smg-gray-100 bg-smg-gray-50">
              <th className="px-6 py-2.5 text-left font-semibold text-smg-gray-700">
                Issue
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-smg-gray-700">
                Summary
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-smg-gray-700">
                Status
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-smg-gray-700">
                Assignee
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-smg-gray-700">
                PR
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue) => {
              const pr = prStatuses[issue.key];
              const rowBg = getRowBg(issue, pr);

              return (
                <tr
                  key={issue.key}
                  className={`border-t border-smg-gray-100 ${rowBg}`}
                >
                  <td className="px-6 py-2.5">
                    <JiraLink
                      issueKey={issue.key}
                      jiraBaseUrl={jiraBaseUrl}
                      className="font-mono text-xs font-semibold text-smg-blue"
                    />
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-smg-gray-700">
                    {issue.summary}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      status={issue.status}
                      category={issue.statusCategory}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-smg-gray-600">
                    {issue.assignee || (
                      <span className="text-smg-gray-300">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <PRCell prStatus={pr} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  category,
}: {
  status: string;
  category: string;
}) {
  const colors: Record<string, string> = {
    done: "bg-smg-teal/10 text-smg-teal",
    indeterminate: "bg-smg-blue/10 text-smg-blue",
    new: "bg-smg-gray-100 text-smg-gray-600",
  };
  const color = colors[category] ?? colors.new;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}

function PRCell({ prStatus }: { prStatus: PRStatus | undefined }) {
  if (!prStatus?.hasPR) {
    return <span className="text-xs text-smg-gray-300">No PR</span>;
  }

  const displayStatus = getPrDisplayStatusFromLight({
    prState: prStatus.prState,
    draft: prStatus.draft,
  });

  return (
    <span className="inline-flex items-center gap-1.5">
      <PrStatusBadge status={displayStatus} />
      <a
        href={prStatus.prUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-smg-blue hover:underline"
      >
        #{prStatus.prNumber}
      </a>
    </span>
  );
}
