"use client";

type ProjectionStatus = "on-track" | "at-risk" | "off-track" | "too-early";

const statusConfig: Record<ProjectionStatus, { bg: string; text: string; label: string }> = {
  "on-track":  { bg: "bg-smg-teal/10",   text: "text-smg-teal",    label: "On Track" },
  "at-risk":   { bg: "bg-smg-warning/10", text: "text-smg-warning", label: "At Risk" },
  "off-track": { bg: "bg-smg-danger/10",  text: "text-smg-danger",  label: "Off Track" },
  "too-early": { bg: "bg-smg-gray-100",   text: "text-smg-gray-500", label: "Too Early" },
};

interface SprintProjectionProps {
  sprint: { startDate?: string; endDate?: string };
  progress: {
    totalPoints: number;
    completedPoints: number;
    inProgressPoints: number;
  };
  blockerCount: number;
}

export function SprintProjection({ sprint, progress, blockerCount }: SprintProjectionProps) {
  if (!sprint.startDate || !sprint.endDate || progress.totalPoints === 0) {
    return null;
  }

  const now = new Date();
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);

  if (now < start) return null;

  const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const daysElapsed = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(totalDays - daysElapsed));
  const percentElapsed = totalDays > 0 ? daysElapsed / totalDays : 0;

  // Too early: less than 20% of sprint elapsed — burn rate unreliable
  if (percentElapsed < 0.2) {
    const cfg = statusConfig["too-early"];
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    );
  }

  // Adjusted burn rate: in-progress gets 50% credit
  const adjustedCompleted = progress.completedPoints + (progress.inProgressPoints * 0.5);
  const dailyBurnRate = daysElapsed > 0 ? adjustedCompleted / daysElapsed : 0;
  const projectedTotal = dailyBurnRate * totalDays;
  const projectedRate = Math.round((projectedTotal / progress.totalPoints) * 100);

  let status: ProjectionStatus;
  if (projectedRate >= 80) status = "on-track";
  else if (projectedRate >= 60) status = "at-risk";
  else status = "off-track";

  // Blockers downgrade on-track → at-risk
  if (blockerCount > 0 && status === "on-track") {
    status = "at-risk";
  }

  const cfg = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      <span className="text-xs text-smg-gray-500">
        {projectedRate}% projected · {daysRemaining}d left
      </span>
    </div>
  );
}
