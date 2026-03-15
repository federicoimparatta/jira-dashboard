"use client";

import type { TicketBottleneck, BottleneckFlag } from "@/lib/github/types";

interface BottleneckPanelsProps {
  bottlenecks: TicketBottleneck[];
  jiraBaseUrl?: string;
}

interface BottleneckGroup {
  flag: BottleneckFlag;
  label: string;
  variant: "danger" | "warning" | "info";
  description: string;
}

const BOTTLENECK_GROUPS: BottleneckGroup[] = [
  {
    flag: "review_stale",
    label: "Stale Reviews",
    variant: "danger",
    description: "PRs waiting >24h for first review",
  },
  {
    flag: "ci_failing",
    label: "Failed CI",
    variant: "danger",
    description: "PRs with failing checks",
  },
  {
    flag: "merge_blocked",
    label: "Changes Requested",
    variant: "warning",
    description: "PRs blocked by review feedback",
  },
  {
    flag: "long_cycle",
    label: "Long Cycle",
    variant: "warning",
    description: "PRs open for >5 days",
  },
  {
    flag: "no_pr",
    label: "No PR",
    variant: "info",
    description: "In-progress issues without a PR",
  },
  {
    flag: "no_deploy",
    label: "Deploy Gap",
    variant: "warning",
    description: "Merged PRs without a deployment",
  },
  {
    flag: "deploy_failed",
    label: "Deploy Failed",
    variant: "danger",
    description: "Deployments in failed state",
  },
];

const variantStyles: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  danger: {
    border: "border-smg-danger/20",
    bg: "bg-red-50",
    icon: "text-smg-danger",
    text: "text-smg-danger",
  },
  warning: {
    border: "border-smg-warning/20",
    bg: "bg-amber-50",
    icon: "text-smg-warning",
    text: "text-smg-warning",
  },
  info: {
    border: "border-smg-blue/20",
    bg: "bg-blue-50",
    icon: "text-smg-blue",
    text: "text-smg-blue",
  },
};

export function BottleneckPanels({ bottlenecks, jiraBaseUrl }: BottleneckPanelsProps) {
  if (bottlenecks.length === 0) {
    return (
      <div className="smg-card p-6 text-center">
        <p className="text-sm font-medium text-smg-teal">No bottlenecks detected</p>
        <p className="mt-1 text-xs text-smg-gray-500">
          All sprint issues have healthy dev flow
        </p>
      </div>
    );
  }

  // Group bottlenecks by flag type
  const grouped = new Map<BottleneckFlag, string[]>();
  for (const b of bottlenecks) {
    for (const flag of b.flags) {
      const list = grouped.get(flag) || [];
      list.push(b.issueKey);
      grouped.set(flag, list);
    }
  }

  // Only show groups that have issues
  const activeGroups = BOTTLENECK_GROUPS.filter((g) => grouped.has(g.flag));

  if (activeGroups.length === 0) return null;

  return (
    <div>
      <h2 className="smg-section-label mb-3">Bottlenecks</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {activeGroups.map((group) => {
          const keys = grouped.get(group.flag) || [];
          const style = variantStyles[group.variant];

          return (
            <div
              key={group.flag}
              className={`rounded-xl border p-4 ${style.border} ${style.bg}`}
            >
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${style.text}`}>
                  {group.label}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${style.text} bg-white/60`}
                >
                  {keys.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-smg-gray-600">
                {group.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {keys.slice(0, 8).map((key) => (
                  <JiraLink key={key} issueKey={key} baseUrl={jiraBaseUrl} />
                ))}
                {keys.length > 8 && (
                  <span className="text-xs text-smg-gray-500">
                    +{keys.length - 8} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JiraLink({
  issueKey,
  baseUrl,
}: {
  issueKey: string;
  baseUrl?: string;
}) {
  if (baseUrl) {
    return (
      <a
        href={`${baseUrl}/browse/${issueKey}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded bg-white/80 px-2 py-0.5 text-xs font-mono font-medium text-smg-blue hover:underline"
      >
        {issueKey}
      </a>
    );
  }
  return (
    <span className="inline-block rounded bg-white/80 px-2 py-0.5 text-xs font-mono font-medium text-smg-gray-700">
      {issueKey}
    </span>
  );
}
