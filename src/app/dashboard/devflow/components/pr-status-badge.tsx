"use client";

type PrStatus =
  | "draft"
  | "open"
  | "review"
  | "changes_requested"
  | "approved"
  | "merged"
  | "closed";

const statusConfig: Record<
  PrStatus,
  { label: string; bg: string; text: string }
> = {
  draft: {
    label: "Draft",
    bg: "bg-smg-gray-100",
    text: "text-smg-gray-600",
  },
  open: {
    label: "Open",
    bg: "bg-smg-blue/10",
    text: "text-smg-blue",
  },
  review: {
    label: "In Review",
    bg: "bg-smg-purple/10",
    text: "text-smg-purple",
  },
  changes_requested: {
    label: "Changes Requested",
    bg: "bg-smg-warning/10",
    text: "text-smg-warning",
  },
  approved: {
    label: "Approved",
    bg: "bg-smg-teal/10",
    text: "text-smg-teal",
  },
  merged: {
    label: "Merged",
    bg: "bg-smg-teal/20",
    text: "text-smg-teal",
  },
  closed: {
    label: "Closed",
    bg: "bg-smg-danger/10",
    text: "text-smg-danger",
  },
};

interface PrStatusBadgeProps {
  status: PrStatus;
  className?: string;
}

export function PrStatusBadge({ status, className = "" }: PrStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Determine the PR display status from PR state and review data.
 */
export function getPrDisplayStatus(pr: {
  state: "open" | "closed" | "merged";
  draft: boolean;
  reviews: { state: string }[];
}): PrStatus {
  if (pr.state === "merged") return "merged";
  if (pr.state === "closed") return "closed";
  if (pr.draft) return "draft";

  // Check reviews
  if (pr.reviews.length > 0) {
    const latestNonComment = [...pr.reviews]
      .reverse()
      .find((r) => r.state !== "COMMENTED");

    if (latestNonComment) {
      if (latestNonComment.state === "APPROVED") return "approved";
      if (latestNonComment.state === "CHANGES_REQUESTED")
        return "changes_requested";
    }
    return "review";
  }

  return "open";
}
