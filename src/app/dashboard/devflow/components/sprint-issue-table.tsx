"use client";

import { useState } from "react";
import { PrStatusBadge, getPrDisplayStatus } from "./pr-status-badge";
import type { GitHubTicketCorrelation, GitHubPR } from "@/lib/github/types";

interface SprintIssueTableProps {
  correlations: GitHubTicketCorrelation[];
  jiraBaseUrl?: string;
}

function formatAge(createdAt: string): { label: string; variant: "teal" | "warning" | "danger" } {
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 2) return { label: `${Math.round(days * 24)}h`, variant: "teal" };
  if (days < 5) return { label: `${Math.round(days)}d`, variant: "warning" };
  return { label: `${Math.round(days)}d`, variant: "danger" };
}

const ageColors = {
  teal: "text-smg-teal bg-smg-teal/10",
  warning: "text-smg-warning bg-smg-warning/10",
  danger: "text-smg-danger bg-smg-danger/10",
};

export function SprintIssueTable({ correlations, jiraBaseUrl }: SprintIssueTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filter to only show correlations that have PRs
  const withPrs = correlations.filter((c) => c.pullRequests.length > 0);

  if (withPrs.length === 0) {
    return (
      <div className="smg-card p-6 text-center">
        <p className="text-sm text-smg-gray-500">
          No PRs found for current sprint issues
        </p>
      </div>
    );
  }

  return (
    <div className="smg-card overflow-hidden">
      <div className="px-6 py-4">
        <h2 className="smg-section-label">Issue PR Mapping</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-smg-gray-100 bg-smg-gray-50">
              <th className="px-6 py-3 text-left font-semibold text-smg-gray-700">
                Issue
              </th>
              <th className="px-4 py-3 text-left font-semibold text-smg-gray-700">
                PR
              </th>
              <th className="px-4 py-3 text-left font-semibold text-smg-gray-700">
                Author
              </th>
              <th className="px-4 py-3 text-left font-semibold text-smg-gray-700">
                Review
              </th>
              <th className="px-4 py-3 text-center font-semibold text-smg-gray-700">
                CI
              </th>
              <th className="px-4 py-3 text-center font-semibold text-smg-gray-700">
                Deploy
              </th>
              <th className="px-4 py-3 text-right font-semibold text-smg-gray-700">
                Size
              </th>
              <th className="px-4 py-3 text-right font-semibold text-smg-gray-700">
                Age
              </th>
            </tr>
          </thead>
          <tbody>
            {withPrs.map((corr) =>
              corr.pullRequests.map((pr, prIdx) => {
                const isExpanded = expandedRow === `${corr.issueKey}-${pr.number}`;
                const age = formatAge(pr.createdAt);
                const prStatus = getPrDisplayStatus(pr);

                return (
                  <TableRow
                    key={`${corr.issueKey}-${pr.number}`}
                    corr={corr}
                    pr={pr}
                    prIdx={prIdx}
                    prStatus={prStatus}
                    age={age}
                    isExpanded={isExpanded}
                    jiraBaseUrl={jiraBaseUrl}
                    onToggle={() =>
                      setExpandedRow(
                        isExpanded ? null : `${corr.issueKey}-${pr.number}`
                      )
                    }
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableRow({
  corr,
  pr,
  prIdx,
  prStatus,
  age,
  isExpanded,
  jiraBaseUrl,
  onToggle,
}: {
  corr: GitHubTicketCorrelation;
  pr: GitHubPR;
  prIdx: number;
  prStatus: ReturnType<typeof getPrDisplayStatus>;
  age: { label: string; variant: "teal" | "warning" | "danger" };
  isExpanded: boolean;
  jiraBaseUrl?: string;
  onToggle: () => void;
}) {
  const repoShort = pr.repo.split("/").pop() || pr.repo;

  return (
    <>
      <tr
        className="cursor-pointer border-t border-smg-gray-100 transition-colors hover:bg-smg-gray-50/50"
        onClick={onToggle}
      >
        {/* Issue Key */}
        <td className="px-6 py-3">
          {prIdx === 0 ? (
            jiraBaseUrl ? (
              <a
                href={`${jiraBaseUrl}/browse/${corr.issueKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-semibold text-smg-blue hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {corr.issueKey}
              </a>
            ) : (
              <span className="font-mono font-semibold text-smg-gray-900">
                {corr.issueKey}
              </span>
            )
          ) : (
            <span className="text-smg-gray-300">&mdash;</span>
          )}
        </td>

        {/* PR number + link */}
        <td className="px-4 py-3">
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-smg-blue hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-smg-gray-400 text-xs">{repoShort}</span>
            #{pr.number}
          </a>
          <PrStatusBadge status={prStatus} className="ml-2" />
        </td>

        {/* Author */}
        <td className="px-4 py-3 text-smg-gray-700">{pr.author}</td>

        {/* Review status */}
        <td className="px-4 py-3">
          <ReviewSummary reviews={pr.reviews} />
        </td>

        {/* CI */}
        <td className="px-4 py-3 text-center">
          <CiBadge conclusion={pr.checksConclusion} />
        </td>

        {/* Deploy */}
        <td className="px-4 py-3 text-center">
          {corr.deployments.length > 0 ? (
            <span className="inline-block rounded-full bg-smg-teal/10 px-2 py-0.5 text-xs font-semibold text-smg-teal">
              {corr.deployments.length}
            </span>
          ) : (
            <span className="text-smg-gray-300">&mdash;</span>
          )}
        </td>

        {/* Size */}
        <td className="px-4 py-3 text-right">
          <span className="font-mono text-xs">
            <span className="text-smg-teal">+{pr.additions}</span>
            {" "}
            <span className="text-smg-danger">-{pr.deletions}</span>
          </span>
        </td>

        {/* Age */}
        <td className="px-4 py-3 text-right">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${ageColors[age.variant]}`}
          >
            {age.label}
          </span>
        </td>
      </tr>

      {/* Expanded details */}
      {isExpanded && (
        <tr className="border-t border-smg-gray-50">
          <td colSpan={8} className="bg-smg-gray-50/50 px-6 py-4">
            <PrDetailPanel pr={pr} corr={corr} />
          </td>
        </tr>
      )}
    </>
  );
}

function ReviewSummary({ reviews }: { reviews: GitHubPR["reviews"] }) {
  if (reviews.length === 0) {
    return <span className="text-xs text-smg-gray-400">No reviews</span>;
  }

  const approved = reviews.filter((r) => r.state === "APPROVED").length;
  const changesReq = reviews.filter(
    (r) => r.state === "CHANGES_REQUESTED"
  ).length;

  return (
    <div className="flex items-center gap-1.5">
      {approved > 0 && (
        <span className="rounded-full bg-smg-teal/10 px-1.5 py-0.5 text-xs font-semibold text-smg-teal">
          {approved} approved
        </span>
      )}
      {changesReq > 0 && (
        <span className="rounded-full bg-smg-warning/10 px-1.5 py-0.5 text-xs font-semibold text-smg-warning">
          {changesReq} changes
        </span>
      )}
      {approved === 0 && changesReq === 0 && (
        <span className="text-xs text-smg-gray-500">
          {reviews.length} comment{reviews.length !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function CiBadge({ conclusion }: { conclusion: string | null }) {
  if (!conclusion) return <span className="text-smg-gray-300">&mdash;</span>;

  const styles: Record<string, string> = {
    success: "bg-smg-teal/10 text-smg-teal",
    failure: "bg-smg-danger/10 text-smg-danger",
    pending: "bg-smg-warning/10 text-smg-warning",
    neutral: "bg-smg-gray-100 text-smg-gray-600",
  };

  const labels: Record<string, string> = {
    success: "Pass",
    failure: "Fail",
    pending: "...",
    neutral: "Skip",
  };

  const style = styles[conclusion] || styles.neutral;
  const label = labels[conclusion] || conclusion;

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${style}`}>
      {label}
    </span>
  );
}

function PrDetailPanel({
  pr,
  corr,
}: {
  pr: GitHubPR;
  corr: GitHubTicketCorrelation;
}) {
  return (
    <div className="space-y-3">
      {/* PR title */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
          PR Title
        </span>
        <p className="mt-0.5 text-sm text-smg-gray-900">{pr.title}</p>
      </div>

      {/* Branch */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
          Branch
        </span>
        <p className="mt-0.5 font-mono text-xs text-smg-gray-700">
          {pr.headRef}
        </p>
      </div>

      {/* Timeline */}
      <div className="flex gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
            Created
          </span>
          <p className="mt-0.5 text-xs text-smg-gray-700">
            {new Date(pr.createdAt).toLocaleDateString()}{" "}
            {new Date(pr.createdAt).toLocaleTimeString()}
          </p>
        </div>
        {pr.mergedAt && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
              Merged
            </span>
            <p className="mt-0.5 text-xs text-smg-gray-700">
              {new Date(pr.mergedAt).toLocaleDateString()}{" "}
              {new Date(pr.mergedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      {/* Reviews detail */}
      {pr.reviews.length > 0 && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
            Reviews
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {pr.reviews.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs text-smg-gray-700"
              >
                <span className="font-medium">{r.author}</span>
                <span
                  className={`font-semibold ${
                    r.state === "APPROVED"
                      ? "text-smg-teal"
                      : r.state === "CHANGES_REQUESTED"
                        ? "text-smg-warning"
                        : "text-smg-gray-500"
                  }`}
                >
                  {r.state.toLowerCase().replace(/_/g, " ")}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deployments */}
      {corr.deployments.length > 0 && (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
            Deployments
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {corr.deployments.map((d) => (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                  d.status === "success"
                    ? "bg-smg-teal/10 text-smg-teal"
                    : d.status === "failure" || d.status === "error"
                      ? "bg-smg-danger/10 text-smg-danger"
                      : "bg-smg-gray-100 text-smg-gray-600"
                }`}
              >
                {d.environment} - {d.status}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
