import { JiraIssue, BacklogData, BacklogDimension, BacklogAlert } from "../jira/types";
import { getStoryPoints } from "../jira/client";

export interface ScoringConfig {
  staleDays: number;
  zombieDays: number;
  storyPointsField: string;
  initiativeField: string | null;
  readyStatuses: string[];
  avgVelocity: number | null;
}

export function scoreBacklogHealth(
  issues: JiraIssue[],
  config: ScoringConfig
): BacklogData {
  const dimensions: BacklogDimension[] = [];
  const alerts: BacklogAlert[] = [];
  const now = new Date();

  // ── 1. Strategic Allocation % (15%) ──────────────────────────────
  // SP with initiative / total SP
  let strategicAllocationPct = 0;
  if (config.initiativeField) {
    let spWithInitiative = 0;
    let totalSP = 0;
    for (const issue of issues) {
      const sp = getStoryPoints(issue, config.storyPointsField);
      totalSP += sp;
      if (issue.fields[config.initiativeField] && sp > 0) {
        spWithInitiative += sp;
      }
    }
    strategicAllocationPct = totalSP > 0 ? spWithInitiative / totalSP : 0;
    const strategicScore = Math.min(100, (strategicAllocationPct / 0.7) * 100);
    dimensions.push({
      name: "Strategic Allocation",
      weight: 0.15,
      score: Math.round(strategicScore),
      weightedScore: Math.round(strategicScore * 0.15),
      detail: `${Math.round(strategicAllocationPct * 100)}% of story points tied to initiatives`,
    });

    if (strategicAllocationPct < 0.3) {
      const unlinked = issues.filter(
        (i) =>
          !i.fields[config.initiativeField!] &&
          getStoryPoints(i, config.storyPointsField) > 0
      );
      alerts.push({
        type: "no_initiative",
        message: `${Math.round(strategicAllocationPct * 100)}% strategic allocation — ${unlinked.length} estimated items not linked to an initiative`,
        count: unlinked.length,
        issues: unlinked.slice(0, 20).map((i) => i.key),
      });
    }
  } else {
    dimensions.push({
      name: "Strategic Allocation",
      weight: 0.15,
      score: 50,
      weightedScore: Math.round(50 * 0.15),
      detail: "No initiative field configured — score neutral",
    });
  }

  // ── 2. Backlog Readiness % (20%) ─────────────────────────────────
  // Composite: description>100 + SP>0 + priority + initiative all populated
  const readyItems = issues.filter((i) => {
    const hasDescription = (() => {
      const desc = i.fields.description;
      if (!desc) return false;
      if (typeof desc === "string") return desc.length > 100;
      return JSON.stringify(desc).length > 100;
    })();
    const hasPoints = getStoryPoints(i, config.storyPointsField) > 0;
    const hasPriority =
      !!i.fields.priority?.name && i.fields.priority.name !== "None";
    const hasInitiative = config.initiativeField
      ? !!i.fields[config.initiativeField]
      : true;
    return hasDescription && hasPoints && hasPriority && hasInitiative;
  });
  const readinessRatio =
    issues.length > 0 ? readyItems.length / issues.length : 0;
  const readinessScore = Math.min(100, (readinessRatio / 0.7) * 100);
  dimensions.push({
    name: "Backlog Readiness",
    weight: 0.2,
    score: Math.round(readinessScore),
    weightedScore: Math.round(readinessScore * 0.2),
    detail: `${readyItems.length}/${issues.length} items fully defined (${Math.round(readinessRatio * 100)}%)`,
  });

  if (readinessRatio < 0.3 && issues.length > 0) {
    alerts.push({
      type: "low_readiness",
      message: `Only ${Math.round(readinessRatio * 100)}% of backlog items are fully defined`,
      count: issues.length - readyItems.length,
      issues: [],
    });
  }

  // ── 3. Dependencies (10%) ────────────────────────────────────────
  // Merge flagged field + issuelinks blocking type
  const blockedIssues = issues.filter((i) => {
    if (i.fields.flagged) return true;
    const links = (i.fields as Record<string, unknown>).issuelinks as
      | { type: { name: string }; inwardIssue?: unknown }[]
      | undefined;
    if (links) {
      for (const link of links) {
        if (
          link.type.name.toLowerCase().includes("block") &&
          link.inwardIssue
        ) {
          return true;
        }
      }
    }
    return false;
  });
  const blockedRatio =
    issues.length > 0 ? blockedIssues.length / issues.length : 0;
  const depScore = Math.max(0, Math.min(100, 100 - (blockedRatio / 0.15) * 100));
  dimensions.push({
    name: "Dependencies",
    weight: 0.1,
    score: Math.round(depScore),
    weightedScore: Math.round(depScore * 0.1),
    detail:
      blockedIssues.length > 0
        ? `${blockedIssues.length}/${issues.length} items blocked (${Math.round(blockedRatio * 100)}%)`
        : "No blocked items",
  });

  if (blockedIssues.length > 0) {
    alerts.push({
      type: "blocked",
      message: `${blockedIssues.length} items currently blocked`,
      count: blockedIssues.length,
      issues: blockedIssues.slice(0, 20).map((i) => i.key),
    });
  }

  // ── 4. Avg Blocked Duration (5%) ─────────────────────────────────
  // Proxy: now - updated for blocked items
  let avgBlockedDays = 0;
  if (blockedIssues.length > 0) {
    const totalBlockedDays = blockedIssues.reduce((sum, i) => {
      const updated = new Date(i.fields.updated);
      return (
        sum + (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
      );
    }, 0);
    avgBlockedDays = totalBlockedDays / blockedIssues.length;
  }
  const blockedDurationScore =
    blockedIssues.length > 0
      ? Math.max(0, Math.min(100, 100 - (avgBlockedDays / 14) * 100))
      : 100;
  dimensions.push({
    name: "Avg Blocked Duration",
    weight: 0.05,
    score: Math.round(blockedDurationScore),
    weightedScore: Math.round(blockedDurationScore * 0.05),
    detail:
      blockedIssues.length > 0
        ? `${avgBlockedDays.toFixed(1)} days avg blocked duration`
        : "No blocked items",
  });

  // ── 5. Priority Distribution (10%) ───────────────────────────────
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

  const highPriority = Object.entries(priorityCounts)
    .filter(([k]) =>
      ["highest", "critical", "blocker"].includes(k.toLowerCase())
    )
    .reduce((sum, [, v]) => sum + v, 0);
  if (issues.length > 0 && highPriority / issues.length > 0.5) {
    alerts.push({
      type: "priority_inflation",
      message: `${Math.round((highPriority / issues.length) * 100)}% of issues marked Highest/Critical`,
      count: highPriority,
      issues: [],
    });
  }

  // ── 6. Age Distribution (10%) ────────────────────────────────────
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const staleCount90 = issues.filter(
    (i) => new Date(i.fields.created) < ninetyDaysAgo
  ).length;
  const staleRatio = issues.length > 0 ? staleCount90 / issues.length : 0;
  const ageScore = Math.max(0, 100 - (staleRatio / 0.1) * 100);
  dimensions.push({
    name: "Age Distribution",
    weight: 0.1,
    score: Math.round(Math.max(0, Math.min(100, ageScore))),
    weightedScore: Math.round(Math.max(0, Math.min(100, ageScore)) * 0.1),
    detail: `${staleCount90}/${issues.length} older than 90d (${Math.round(staleRatio * 100)}%)`,
  });

  // ── 7. Grooming Freshness (15%) ──────────────────────────────────
  const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const recentlyUpdated = issues.filter(
    (i) => new Date(i.fields.updated) >= fortyFiveDaysAgo
  );
  const groomingRatio =
    issues.length > 0 ? recentlyUpdated.length / issues.length : 0;
  const groomingScore = Math.min(100, (groomingRatio / 0.8) * 100);
  dimensions.push({
    name: "Grooming Freshness",
    weight: 0.15,
    score: Math.round(groomingScore),
    weightedScore: Math.round(groomingScore * 0.15),
    detail: `${recentlyUpdated.length}/${issues.length} updated in last 45d (${Math.round(groomingRatio * 100)}%)`,
  });

  // ── 8. 2-Sprint Readiness Coverage (15%) ─────────────────────────
  let sprintReadyScore = 50; // default if no velocity
  if (config.avgVelocity && config.avgVelocity > 0) {
    let readySP: number;
    if (config.readyStatuses.length > 0) {
      const readyStatusNames = config.readyStatuses.map((s) =>
        s.toLowerCase()
      );
      readySP = issues
        .filter((i) =>
          readyStatusNames.includes(i.fields.status.name.toLowerCase())
        )
        .reduce(
          (sum, i) => sum + getStoryPoints(i, config.storyPointsField),
          0
        );
    } else {
      // Fallback: use field-completion readiness
      readySP = readyItems.reduce(
        (sum, i) => sum + getStoryPoints(i, config.storyPointsField),
        0
      );
    }
    const twoSprintTarget = config.avgVelocity * 2;
    const coverageRatio = readySP / twoSprintTarget;
    sprintReadyScore = Math.min(100, coverageRatio * 100);

    dimensions.push({
      name: "2-Sprint Readiness",
      weight: 0.15,
      score: Math.round(sprintReadyScore),
      weightedScore: Math.round(sprintReadyScore * 0.15),
      detail: `${readySP.toFixed(0)} ready SP / ${twoSprintTarget.toFixed(0)} target (${Math.round(coverageRatio * 100)}%)`,
    });

    if (sprintReadyScore < 50) {
      alerts.push({
        type: "low_sprint_coverage",
        message: `Only ${Math.round(coverageRatio * 100)}% of 2-sprint capacity has ready work`,
        count: 0,
        issues: [],
      });
    }
  } else {
    dimensions.push({
      name: "2-Sprint Readiness",
      weight: 0.15,
      score: 50,
      weightedScore: Math.round(50 * 0.15),
      detail: "No velocity data — score neutral",
    });
  }

  // ── Stale / Zombie alerts (alert-only, no dimension) ─────────────
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
      message: `${zombieItems.length} zombie issues (${config.zombieDays}+ days, no activity)`,
      count: zombieItems.length,
      issues: zombieItems.slice(0, 20).map((i) => i.key),
    });
  }

  // Unestimated alert
  const unestimated = issues.filter(
    (i) => getStoryPoints(i, config.storyPointsField) === 0
  );
  if (unestimated.length > 0) {
    alerts.push({
      type: "unestimated",
      message: `${unestimated.length} stories without estimates`,
      count: unestimated.length,
      issues: unestimated.slice(0, 20).map((i) => i.key),
    });
  }

  // ── Composite score ──────────────────────────────────────────────
  const healthScore = dimensions.reduce((sum, d) => sum + d.weightedScore, 0);

  return {
    issues,
    healthScore: Math.round(healthScore),
    dimensions,
    alerts,
    totalItems: issues.length,
    readyItems: readyItems.length,
    blockedItems: blockedIssues.length,
    strategicAllocationPct: Math.round(strategicAllocationPct * 100),
    staleItems: staleItems.length,
    zombieItems: zombieItems.length,
  };
}

function scorePriorityDistribution(
  counts: Record<string, number>,
  total: number
): number {
  if (total === 0) return 100;

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
