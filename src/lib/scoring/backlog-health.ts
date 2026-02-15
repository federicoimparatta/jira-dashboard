import { JiraIssue, BacklogData, BacklogDimension, BacklogAlert } from "../jira/types";
import { getStoryPoints } from "../jira/client";

interface ScoringConfig {
  staleDays: number;
  zombieDays: number;
  storyPointsField: string;
  avgVelocity: number | null; // average points per sprint
}

export function scoreBacklogHealth(
  issues: JiraIssue[],
  config: ScoringConfig
): BacklogData {
  const dimensions: BacklogDimension[] = [];
  const alerts: BacklogAlert[] = [];
  const now = new Date();

  // 1. Grooming Freshness (20%) — % updated in last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentlyUpdated = issues.filter(
    (i) => new Date(i.fields.updated) >= thirtyDaysAgo
  );
  const groomingRatio = issues.length > 0 ? recentlyUpdated.length / issues.length : 0;
  const groomingScore = Math.min(100, (groomingRatio / 0.8) * 100);
  dimensions.push({
    name: "Grooming Freshness",
    weight: 0.2,
    score: Math.round(groomingScore),
    weightedScore: Math.round(groomingScore * 0.2),
    detail: `${recentlyUpdated.length}/${issues.length} updated in last 30d (${Math.round(groomingRatio * 100)}%)`,
  });

  // 2. Estimation Coverage (20%) — % with story points
  const estimated = issues.filter(
    (i) => getStoryPoints(i, config.storyPointsField) > 0
  );
  const estimationRatio = issues.length > 0 ? estimated.length / issues.length : 0;
  const estimationScore = Math.min(100, (estimationRatio / 0.9) * 100);
  dimensions.push({
    name: "Estimation Coverage",
    weight: 0.2,
    score: Math.round(estimationScore),
    weightedScore: Math.round(estimationScore * 0.2),
    detail: `${estimated.length}/${issues.length} estimated (${Math.round(estimationRatio * 100)}%)`,
  });

  const unestimated = issues.filter(
    (i) => getStoryPoints(i, config.storyPointsField) === 0
  );
  if (unestimated.length > 0) {
    alerts.push({
      type: "unestimated",
      message: `${unestimated.length} stories without story points`,
      count: unestimated.length,
      issues: unestimated.slice(0, 20).map((i) => i.key),
    });
  }

  // 3. Priority Distribution (10%) — entropy-based
  const priorityCounts: Record<string, number> = {};
  for (const issue of issues) {
    const p = issue.fields.priority?.name || "None";
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;
  }
  const priorityScore = scorePriorityDistribution(priorityCounts, issues.length);
  dimensions.push({
    name: "Priority Distribution",
    weight: 0.1,
    score: Math.round(priorityScore),
    weightedScore: Math.round(priorityScore * 0.1),
    detail: Object.entries(priorityCounts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", "),
  });

  // Check priority inflation
  const highPriority = Object.entries(priorityCounts)
    .filter(([k]) =>
      ["highest", "critical", "blocker"].includes(k.toLowerCase())
    )
    .reduce((sum, [, v]) => sum + v, 0);
  if (issues.length > 0 && highPriority / issues.length > 0.4) {
    alerts.push({
      type: "priority_inflation",
      message: `${Math.round((highPriority / issues.length) * 100)}% of issues marked Highest/Critical`,
      count: highPriority,
      issues: [],
    });
  }

  // 4. Age Distribution (15%) — % over 90 days
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const staleCount90 = issues.filter(
    (i) => new Date(i.fields.created) < ninetyDaysAgo
  ).length;
  const staleRatio = issues.length > 0 ? staleCount90 / issues.length : 0;
  const ageScore = Math.max(0, 100 - (staleRatio / 0.1) * 100);
  dimensions.push({
    name: "Age Distribution",
    weight: 0.15,
    score: Math.round(Math.max(0, Math.min(100, ageScore))),
    weightedScore: Math.round(Math.max(0, Math.min(100, ageScore)) * 0.15),
    detail: `${staleCount90}/${issues.length} older than 90d (${Math.round(staleRatio * 100)}%)`,
  });

  // 5. Backlog Size (10%) — 3-6 sprints runway
  const totalPoints = issues.reduce(
    (sum, i) => sum + getStoryPoints(i, config.storyPointsField),
    0
  );
  let sizeScore = 50; // default if no velocity data
  if (config.avgVelocity && config.avgVelocity > 0) {
    const sprintsRunway = totalPoints / config.avgVelocity;
    if (sprintsRunway >= 3 && sprintsRunway <= 6) {
      sizeScore = 100;
    } else if (sprintsRunway < 3) {
      sizeScore = Math.max(0, (sprintsRunway / 3) * 100);
    } else {
      sizeScore = Math.max(0, 100 - ((sprintsRunway - 6) / 6) * 100);
    }
  }
  dimensions.push({
    name: "Backlog Size",
    weight: 0.1,
    score: Math.round(sizeScore),
    weightedScore: Math.round(sizeScore * 0.1),
    detail: config.avgVelocity
      ? `${totalPoints} points / ${config.avgVelocity} velocity = ${(totalPoints / config.avgVelocity).toFixed(1)} sprints`
      : `${totalPoints} total points (no velocity data)`,
  });

  // 6. Acceptance Criteria (15%) — description length > 100 chars
  const withDescription = issues.filter((i) => {
    const desc = i.fields.description;
    if (!desc) return false;
    if (typeof desc === "string") return desc.length > 100;
    // ADF format — check if there's meaningful content
    return JSON.stringify(desc).length > 100;
  });
  const acRatio = issues.length > 0 ? withDescription.length / issues.length : 0;
  const acScore = Math.min(100, (acRatio / 0.8) * 100);
  dimensions.push({
    name: "Acceptance Criteria",
    weight: 0.15,
    score: Math.round(acScore),
    weightedScore: Math.round(acScore * 0.15),
    detail: `${withDescription.length}/${issues.length} have detailed descriptions (${Math.round(acRatio * 100)}%)`,
  });

  // 7. Dependencies (10%) — unresolved blocked-by links
  let totalLinks = 0;
  let unresolvedBlocks = 0;
  for (const issue of issues) {
    const links = (issue.fields as Record<string, unknown>).issuelinks as
      | { type: { name: string }; inwardIssue?: unknown }[]
      | undefined;
    if (links) {
      for (const link of links) {
        if (
          link.type.name.toLowerCase().includes("block") &&
          link.inwardIssue
        ) {
          totalLinks++;
          unresolvedBlocks++;
        }
      }
    }
  }
  const depScore = totalLinks > 0 ? Math.max(0, 100 - (unresolvedBlocks / totalLinks) * 100) : 100;
  dimensions.push({
    name: "Dependencies",
    weight: 0.1,
    score: Math.round(depScore),
    weightedScore: Math.round(depScore * 0.1),
    detail: unresolvedBlocks > 0
      ? `${unresolvedBlocks} unresolved blocking dependencies`
      : "No unresolved blocking dependencies",
  });

  // Compute alerts for stale and zombie items
  const staleDaysAgo = new Date(
    now.getTime() - config.staleDays * 24 * 60 * 60 * 1000
  );
  const staleItems = issues.filter(
    (i) => new Date(i.fields.updated) < staleDaysAgo
  );
  if (staleItems.length > 0) {
    alerts.push({
      type: "stale",
      message: `${staleItems.length} items not updated in ${config.staleDays}+ days`,
      count: staleItems.length,
      issues: staleItems.slice(0, 20).map((i) => i.key),
    });
  }

  const zombieDaysAgo = new Date(
    now.getTime() - config.zombieDays * 24 * 60 * 60 * 1000
  );
  const zombieItems = issues.filter((i) => {
    const created = new Date(i.fields.created);
    const updated = new Date(i.fields.updated);
    return created < zombieDaysAgo && updated < zombieDaysAgo;
  });
  if (zombieItems.length > 0) {
    alerts.push({
      type: "zombie",
      message: `${zombieItems.length} zombie issues (${config.zombieDays}+ days, no status change)`,
      count: zombieItems.length,
      issues: zombieItems.slice(0, 20).map((i) => i.key),
    });
  }

  // Composite score
  const healthScore = dimensions.reduce((sum, d) => sum + d.weightedScore, 0);

  return {
    issues,
    healthScore: Math.round(healthScore),
    dimensions,
    alerts,
    totalItems: issues.length,
    estimatedItems: estimated.length,
    staleItems: staleItems.length,
    zombieItems: zombieItems.length,
  };
}

function scorePriorityDistribution(
  counts: Record<string, number>,
  total: number
): number {
  if (total === 0) return 100;

  // Check if any single priority > 50%
  const maxRatio = Math.max(
    ...Object.values(counts).map((c) => c / total)
  );

  if (maxRatio > 0.5) {
    return Math.max(0, (1 - maxRatio) * 200);
  }

  // Shannon entropy
  const entropy = Object.values(counts).reduce((sum, count) => {
    if (count === 0) return sum;
    const p = count / total;
    return sum - p * Math.log2(p);
  }, 0);

  const maxEntropy = Math.log2(Object.keys(counts).length || 1);
  return maxEntropy > 0
    ? Math.round((entropy / maxEntropy) * 100)
    : 100;
}
