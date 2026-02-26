import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Theme colours (RGB tuples) ---
const NAVY: [number, number, number] = [15, 23, 42];
const TEAL: [number, number, number] = [13, 148, 136];
const BLUE: [number, number, number] = [59, 130, 246];
const WARNING: [number, number, number] = [245, 158, 11];
const DANGER: [number, number, number] = [239, 68, 68];
const GRAY_500: [number, number, number] = [107, 114, 128];
const GRAY_100: [number, number, number] = [243, 244, 246];
const WHITE: [number, number, number] = [255, 255, 255];

// --- Layout constants ---
const PAGE_W = 210; // A4
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// --- Lightweight response types (only what we render) ---

interface BoardSprint {
  boardName: string;
  sprint: { name: string; startDate?: string; endDate?: string; goal?: string };
  progress: {
    totalPoints: number;
    completedPoints: number;
    completionRate: number;
  };
  issueCount: { total: number; done: number; inProgress: number; todo: number };
  blockers: { key: string; summary: string; assignee: string; status: string }[];
}

interface SprintData {
  mode?: string;
  boards?: BoardSprint[];
  aggregate?: {
    totalPoints: number;
    completedPoints: number;
    completionRate: number;
    totalIssues: number;
    totalDone: number;
    totalInProgress: number;
    totalTodo: number;
    avgCycleTime: number | null;
    avgLeadTime: number | null;
    scopeChange: { added: number; removed: number; net: number };
  };
  wipPerAssignee?: Record<string, { count: number; points: number }>;
  blockers?: { key: string; summary: string; assignee: string; status: string; boardName?: string }[];
  // single-board fallback
  sprint?: { name: string; startDate?: string; endDate?: string };
  progress?: { totalPoints: number; completedPoints: number; completionRate: number };
  issueCount?: { total: number; done: number; inProgress: number; todo: number };
  fetchedAt?: string;
}

interface BacklogBoard {
  boardName: string;
  healthScore: number;
  stats: { totalItems: number; readyItems: number; blockedItems: number };
  dimensions: { name: string; score: number; weight: number; detail: string }[];
  alerts: { type: string; message: string; count: number }[];
}

interface BacklogData {
  mode?: string;
  boards?: BacklogBoard[];
  aggregate?: {
    healthScore: number;
    totalItems: number;
    readyItems: number;
    blockedItems: number;
    dimensions: { name: string; score: number; weight: number; detail: string }[];
    alerts: { type: string; message: string; count: number }[];
  };
  // single-board fallback
  healthScore?: number;
  dimensions?: { name: string; score: number; weight: number; detail: string }[];
  alerts?: { type: string; message: string; count: number }[];
  stats?: { totalItems: number; readyItems: number; blockedItems: number };
  fetchedAt?: string;
}

interface InitiativeEpic {
  key: string;
  summary: string;
  status: { name: string; categoryKey: string };
  childIssues: { total: number; done: number };
  storyPoints: { total: number; done: number };
  boardIds: string[];
}

interface Initiative {
  key: string;
  summary: string;
  epicCount: number;
  epics: InitiativeEpic[];
  childIssues: { total: number; done: number };
  storyPoints: { total: number; done: number };
  completionRate: number;
}

interface InitiativesData {
  initiatives: Initiative[];
  boards?: { id: string; name: string }[];
  summary: {
    totalInitiatives: number;
    totalEpics: number;
    avgCompletionRate: number;
    totalStoryPoints: number;
    totalDoneStoryPoints: number;
  };
  fetchedAt?: string;
}

interface EpicChild {
  key: string;
  summary: string;
  status: { name: string; categoryKey: string };
  assignee: string | null;
  storyPoints: number;
}

interface Epic {
  key: string;
  summary: string;
  status: { name: string; categoryKey: string };
  assignee: string | null;
  childIssues: { total: number; done: number; inProgress: number; todo: number };
  storyPoints: { total: number; done: number; inProgress: number; todo: number };
  children: EpicChild[];
  initiative?: { key: string; summary: string };
}

interface EpicBoard {
  boardName: string;
  epics: Epic[];
  summary: { totalEpics: number; totalChildIssues: number; totalDoneChildIssues: number; avgCompletionRate: number };
}

interface EpicsData {
  boards: EpicBoard[];
  ungrouped?: Epic[];
  summary: { totalEpics: number; avgCompletionRate: number; totalChildIssues: number; totalDoneChildIssues: number };
  fetchedAt?: string;
}

// ──────────────────── Helpers ────────────────────

let y = MARGIN; // running vertical cursor

function resetY() {
  y = MARGIN;
}

function ensureSpace(doc: jsPDF, needed: number) {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function fmtDate(iso?: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sectionTitle(doc: jsPDF, title: string) {
  ensureSpace(doc, 16);
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, y, CONTENT_W, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(title, MARGIN + 4, y + 7);
  y += 14;
  doc.setTextColor(...NAVY);
}

function subHeading(doc: jsPDF, text: string) {
  ensureSpace(doc, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(text, MARGIN, y + 5);
  y += 9;
}

function bodyText(doc: jsPDF, text: string, opts?: { color?: [number, number, number]; bold?: boolean }) {
  ensureSpace(doc, 7);
  doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
  doc.setFontSize(9);
  doc.setTextColor(...(opts?.color ?? GRAY_500));
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, y + 4);
  y += lines.length * 4.5 + 2;
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 70) return TEAL;
  if (score >= 40) return WARNING;
  return DANGER;
}

// ──────────────────── Cover page ────────────────────

function addCoverPage(
  doc: jsPDF,
  sprint: SprintData,
  backlog: BacklogData,
  initiatives: InitiativesData,
  epics: EpicsData,
) {
  // Background band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 100, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text("Engineering Dashboard", MARGIN, 40);

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255, 0.7);
  doc.text("Report", MARGIN, 52);

  // Date
  const now = new Date();
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(
    `Generated ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at ${now.toLocaleTimeString()}`,
    MARGIN,
    70,
  );

  // Sprint date range
  const sprintBoards = sprint.boards ?? [];
  if (sprintBoards.length > 0) {
    const starts = sprintBoards.map((b) => b.sprint.startDate).filter(Boolean) as string[];
    const ends = sprintBoards.map((b) => b.sprint.endDate).filter(Boolean) as string[];
    if (starts.length && ends.length) {
      const earliest = shortDate(starts.sort()[0]);
      const latest = shortDate(ends.sort().reverse()[0]);
      doc.text(`Active sprints: ${earliest} \u2013 ${latest}`, MARGIN, 82);
    }
  } else if (sprint.sprint?.startDate) {
    doc.text(
      `Sprint: ${shortDate(sprint.sprint.startDate)} \u2013 ${shortDate(sprint.sprint?.endDate)}`,
      MARGIN,
      82,
    );
  }

  // Summary boxes
  y = 115;
  const agg = sprint.aggregate ?? sprint.progress;
  const boxes = [
    { label: "Sprint Completion", value: agg ? pct(agg.completionRate) : "\u2014", color: TEAL },
    { label: "Backlog Health", value: `${backlog.aggregate?.healthScore ?? backlog.healthScore ?? "\u2014"}/100`, color: BLUE },
    { label: "Initiatives", value: String(initiatives.summary.totalInitiatives), color: NAVY },
    { label: "Active Epics", value: String(epics.summary.totalEpics), color: NAVY },
  ];

  const boxW = (CONTENT_W - 12) / 4;
  boxes.forEach((box, i) => {
    const bx = MARGIN + i * (boxW + 4);
    doc.setFillColor(...GRAY_100);
    doc.roundedRect(bx, y, boxW, 30, 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...box.color);
    doc.text(box.value, bx + boxW / 2, y + 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_500);
    doc.text(box.label, bx + boxW / 2, y + 23, { align: "center" });
  });

  y = 160;

  // Table of contents
  subHeading(doc, "Contents");
  const toc = ["1. Sprint Overview", "2. Backlog Health", "3. Initiatives", "4. Epics by Board"];
  toc.forEach((item) => bodyText(doc, item, { color: NAVY, bold: false }));
}

// ──────────────────── Sprint section ────────────────────

function addSprintSection(doc: jsPDF, data: SprintData) {
  doc.addPage();
  resetY();
  sectionTitle(doc, "1. Sprint Overview");

  if (data.mode === "overview" && data.boards) {
    // Aggregate stats
    const agg = data.aggregate!;
    bodyText(doc, `${pct(agg.completionRate)} complete \u00B7 ${agg.completedPoints}/${agg.totalPoints} pts \u00B7 ${agg.totalDone}/${agg.totalIssues} issues`, { color: NAVY, bold: true });

    if (agg.avgCycleTime != null) {
      bodyText(doc, `Cycle time: ${agg.avgCycleTime.toFixed(1)}d \u00B7 Lead time: ${agg.avgLeadTime?.toFixed(1) ?? "\u2014"}d \u00B7 Scope change: ${agg.scopeChange.net >= 0 ? "+" : ""}${agg.scopeChange.net} pts`);
    }

    y += 2;
    subHeading(doc, "Board Breakdown");

    autoTable(doc, {
      startY: y,
      head: [["Board", "Sprint", "Points", "Completion", "Issues (D/P/T)", "Blockers"]],
      body: data.boards.map((b) => [
        b.boardName,
        b.sprint.name,
        `${b.progress.completedPoints}/${b.progress.totalPoints}`,
        pct(b.progress.completionRate),
        `${b.issueCount.done}/${b.issueCount.inProgress}/${b.issueCount.todo}`,
        String(b.blockers.length),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: GRAY_100 },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // Blockers
    if (data.blockers && data.blockers.length > 0) {
      subHeading(doc, "Blockers");
      autoTable(doc, {
        startY: y,
        head: [["Key", "Summary", "Assignee", "Status", "Board"]],
        body: data.blockers.map((b) => [b.key, b.summary.slice(0, 60), b.assignee, b.status, b.boardName ?? ""]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: DANGER, textColor: WHITE, fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRAY_100 },
        margin: { left: MARGIN, right: MARGIN },
        columnStyles: { 1: { cellWidth: 60 } },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // WIP per assignee
    if (data.wipPerAssignee && Object.keys(data.wipPerAssignee).length > 0) {
      subHeading(doc, "WIP per Assignee");
      const entries = Object.entries(data.wipPerAssignee).sort((a, b) => b[1].points - a[1].points);
      autoTable(doc, {
        startY: y,
        head: [["Assignee", "Issues", "Points"]],
        body: entries.map(([name, v]) => [name, String(v.count), String(v.points)]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRAY_100 },
        margin: { left: MARGIN, right: MARGIN },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  } else {
    // Single board fallback
    const p = data.progress;
    if (p) {
      bodyText(doc, `${pct(p.completionRate)} complete \u00B7 ${p.completedPoints}/${p.totalPoints} pts`, { color: NAVY, bold: true });
    }
  }
}

// ──────────────────── Backlog section ────────────────────

function addBacklogSection(doc: jsPDF, data: BacklogData) {
  doc.addPage();
  resetY();
  sectionTitle(doc, "2. Backlog Health");

  const score = data.aggregate?.healthScore ?? data.healthScore ?? 0;
  const color = scoreColor(score);

  // Big score display
  ensureSpace(doc, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(...color);
  doc.text(`${Math.round(score)}`, MARGIN, y + 16);
  doc.setFontSize(14);
  doc.text("/100", MARGIN + doc.getTextWidth(`${Math.round(score)}`) + 2, y + 16);
  y += 24;

  const stats = data.aggregate ?? data.stats;
  if (stats) {
    bodyText(doc, `${stats.totalItems} total items \u00B7 ${stats.readyItems} ready \u00B7 ${stats.blockedItems} blocked`);
  }

  // Per-board health (overview mode)
  if (data.mode === "overview" && data.boards) {
    y += 2;
    subHeading(doc, "Board Health Scores");
    autoTable(doc, {
      startY: y,
      head: [["Board", "Score", "Items", "Ready", "Blocked"]],
      body: data.boards.map((b) => [
        b.boardName,
        `${Math.round(b.healthScore)}/100`,
        String(b.stats.totalItems),
        String(b.stats.readyItems),
        String(b.stats.blockedItems),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: GRAY_100 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Dimensions
  const dims = data.aggregate?.dimensions ?? data.dimensions ?? [];
  if (dims.length > 0) {
    subHeading(doc, "Health Dimensions");
    autoTable(doc, {
      startY: y,
      head: [["Dimension", "Score", "Weight", "Detail"]],
      body: dims.map((d) => [d.name, `${Math.round(d.score)}/100`, `${Math.round(d.weight * 100)}%`, d.detail]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: GRAY_100 },
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: { 3: { cellWidth: 70 } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Alerts
  const alerts = data.aggregate?.alerts ?? data.alerts ?? [];
  if (alerts.length > 0) {
    subHeading(doc, "Alerts");
    alerts.forEach((a) => {
      bodyText(doc, `\u26A0 ${a.message} (${a.count} issue${a.count !== 1 ? "s" : ""})`, { color: WARNING });
    });
  }
}

// ──────────────────── Initiatives section ────────────────────

function addInitiativesSection(doc: jsPDF, data: InitiativesData) {
  doc.addPage();
  resetY();
  sectionTitle(doc, "3. Initiatives");

  const s = data.summary;
  bodyText(
    doc,
    `${s.totalInitiatives} initiatives \u00B7 ${s.totalEpics} epics \u00B7 ${pct(s.avgCompletionRate)} avg completion \u00B7 ${s.totalDoneStoryPoints}/${s.totalStoryPoints} pts`,
    { color: NAVY, bold: true },
  );

  // Board name lookup
  const boardNames = new Map<string, string>();
  for (const b of data.boards ?? []) boardNames.set(b.id, b.name);

  y += 2;

  for (const init of data.initiatives) {
    ensureSpace(doc, 30);
    subHeading(doc, `${init.key} \u2014 ${init.summary}`);
    bodyText(
      doc,
      `${pct(init.completionRate)} complete \u00B7 ${init.epicCount} epics \u00B7 ${init.childIssues.done}/${init.childIssues.total} issues \u00B7 ${init.storyPoints.done}/${init.storyPoints.total} pts`,
    );

    if (init.epics.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Epic", "Summary", "Status", "Issues", "Points", "Board"]],
        body: init.epics.map((e) => [
          e.key,
          e.summary.length > 50 ? e.summary.slice(0, 50) + "\u2026" : e.summary,
          e.status.name,
          `${e.childIssues.done}/${e.childIssues.total}`,
          `${e.storyPoints.done}/${e.storyPoints.total}`,
          e.boardIds.map((id) => boardNames.get(id) ?? `Board ${id}`).join(", ") || "\u2014",
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRAY_100 },
        margin: { left: MARGIN, right: MARGIN },
        columnStyles: { 1: { cellWidth: 50 } },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }
}

// ──────────────────── Epics section ────────────────────

function addEpicsSection(doc: jsPDF, data: EpicsData) {
  doc.addPage();
  resetY();
  sectionTitle(doc, "4. Epics by Board");

  const s = data.summary;
  bodyText(
    doc,
    `${s.totalEpics} active epics \u00B7 ${pct(s.avgCompletionRate)} avg completion \u00B7 ${s.totalDoneChildIssues}/${s.totalChildIssues} issues done`,
    { color: NAVY, bold: true },
  );

  y += 2;

  for (const board of data.boards) {
    ensureSpace(doc, 20);
    subHeading(doc, `${board.boardName} (${board.summary.totalEpics} epics, ${pct(board.summary.avgCompletionRate)} complete)`);

    if (board.epics.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Epic", "Summary", "Status", "Assignee", "Issues (D/P/T)", "Points (D/P/T)"]],
        body: board.epics.map((e) => [
          e.key,
          e.summary.length > 45 ? e.summary.slice(0, 45) + "\u2026" : e.summary,
          e.status.name,
          e.assignee ?? "Unassigned",
          `${e.childIssues.done}/${e.childIssues.inProgress}/${e.childIssues.todo}`,
          `${e.storyPoints.done}/${e.storyPoints.inProgress}/${e.storyPoints.todo}`,
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRAY_100 },
        margin: { left: MARGIN, right: MARGIN },
        columnStyles: { 1: { cellWidth: 45 } },
      });
      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  // Ungrouped epics
  const ungrouped = data.ungrouped ?? [];
  if (ungrouped.length > 0) {
    ensureSpace(doc, 20);
    subHeading(doc, `Other (${ungrouped.length} epics)`);
    autoTable(doc, {
      startY: y,
      head: [["Epic", "Summary", "Status", "Assignee", "Issues (D/P/T)", "Points (D/P/T)"]],
      body: ungrouped.map((e) => [
        e.key,
        e.summary.length > 45 ? e.summary.slice(0, 45) + "\u2026" : e.summary,
        e.status.name,
        e.assignee ?? "Unassigned",
        `${e.childIssues.done}/${e.childIssues.inProgress}/${e.childIssues.todo}`,
        `${e.storyPoints.done}/${e.storyPoints.inProgress}/${e.storyPoints.todo}`,
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: GRAY_100 },
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: { 1: { cellWidth: 45 } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
}

// ──────────────────── Footer on every page ────────────────────

function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_500);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });
    doc.text("Confidential", PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }
}

// ──────────────────── Public API ────────────────────

export async function generateDashboardPdf(): Promise<void> {
  // 1. Fetch all four endpoints in parallel
  const [sprintRes, backlogRes, initiativesRes, epicsRes] = await Promise.all([
    fetch("/api/jira/sprint?board=all"),
    fetch("/api/jira/backlog?board=all"),
    fetch("/api/jira/initiatives"),
    fetch("/api/jira/epics"),
  ]);

  if (!sprintRes.ok || !backlogRes.ok || !initiativesRes.ok || !epicsRes.ok) {
    throw new Error("Failed to fetch dashboard data for PDF export");
  }

  const [sprint, backlog, initiatives, epics]: [SprintData, BacklogData, InitiativesData, EpicsData] =
    await Promise.all([sprintRes.json(), backlogRes.json(), initiativesRes.json(), epicsRes.json()]);

  // 2. Create password-protected PDF
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    encryption: {
      userPassword: "pdf",
      ownerPassword: "pdf",
      userPermissions: ["print", "copy"],
    },
  });

  // 3. Build the report
  addCoverPage(doc, sprint, backlog, initiatives, epics);
  addSprintSection(doc, sprint);
  addBacklogSection(doc, backlog);
  addInitiativesSection(doc, initiatives);
  addEpicsSection(doc, epics);
  addFooters(doc);

  // 4. Build descriptive filename
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  // Try to include sprint date range
  let sprintLabel = "";
  const boards = sprint.boards ?? [];
  if (boards.length > 0) {
    const ends = boards.map((b) => b.sprint.endDate).filter(Boolean) as string[];
    if (ends.length) {
      const latestEnd = ends.sort().reverse()[0].split("T")[0];
      sprintLabel = `-sprint-ending-${latestEnd}`;
    }
  }

  doc.save(`engineering-dashboard${sprintLabel}-${dateStr}.pdf`);
}
