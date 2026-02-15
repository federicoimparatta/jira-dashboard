import { WeeklyReport } from "../jira/types";

export async function dispatchEmail(report: WeeklyReport): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  if (!apiKey || !to) return false;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: process.env.REPORT_EMAIL_FROM || "dashboard@resend.dev",
      to: to.split(",").map((e) => e.trim()),
      subject: `Weekly Sprint Report — ${report.reportDate}`,
      html: buildEmailHtml(report),
    });

    return true;
  } catch (error) {
    console.error("Email dispatch failed:", error);
    return false;
  }
}

export async function dispatchSlack(report: WeeklyReport): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `📊 Weekly Sprint Report — ${report.reportDate}`,
        blocks: buildSlackBlocks(report),
      }),
    });

    return res.ok;
  } catch (error) {
    console.error("Slack dispatch failed:", error);
    return false;
  }
}

function buildEmailHtml(report: WeeklyReport): string {
  const healthColor =
    report.backlogHealth.score > 70
      ? "#22c55e"
      : report.backlogHealth.score > 40
        ? "#f59e0b"
        : "#ef4444";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
        Weekly Sprint Report
      </h1>
      <p style="color: #6b7280;">Report date: ${report.reportDate}</p>

      <h2 style="color: #374151;">Sprint Summary</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Sprint</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${report.sprintSummary.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Velocity</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${report.sprintSummary.velocity} pts</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Completion</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${Math.round(report.sprintSummary.completionRate * 100)}%</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Carryover</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${report.sprintSummary.carryover} issues</td>
        </tr>
      </table>

      <h2 style="color: #374151;">Throughput</h2>
      <p>${report.throughput.total} issues completed</p>
      <ul>
        ${Object.entries(report.throughput.byType)
          .map(([type, count]) => `<li>${type}: ${count}</li>`)
          .join("")}
      </ul>

      <h2 style="color: #374151;">Cycle Time</h2>
      <p>Average: ${report.cycleTime.average.toFixed(1)} days | Median: ${report.cycleTime.median.toFixed(1)} days | P90: ${report.cycleTime.p90.toFixed(1)} days</p>

      ${
        report.blockers.length > 0
          ? `
        <h2 style="color: #ef4444;">Blockers (${report.blockers.length})</h2>
        <ul>
          ${report.blockers.map((b) => `<li><strong>${b.key}</strong>: ${b.summary}</li>`).join("")}
        </ul>
      `
          : ""
      }

      <h2 style="color: #374151;">Backlog Health</h2>
      <p style="font-size: 24px; font-weight: bold; color: ${healthColor};">
        ${report.backlogHealth.score}/100
      </p>
      ${
        report.backlogHealth.flags.length > 0
          ? `<ul>${report.backlogHealth.flags.map((f) => `<li>${f}</li>`).join("")}</ul>`
          : ""
      }
    </div>
  `;
}

function buildSlackBlocks(report: WeeklyReport) {
  const healthEmoji =
    report.backlogHealth.score > 70
      ? ":large_green_circle:"
      : report.backlogHealth.score > 40
        ? ":large_yellow_circle:"
        : ":red_circle:";

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Sprint Report — ${report.reportDate}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Sprint:* ${report.sprintSummary.name}`,
        },
        {
          type: "mrkdwn",
          text: `*Velocity:* ${report.sprintSummary.velocity} pts`,
        },
        {
          type: "mrkdwn",
          text: `*Completion:* ${Math.round(report.sprintSummary.completionRate * 100)}%`,
        },
        {
          type: "mrkdwn",
          text: `*Carryover:* ${report.sprintSummary.carryover} issues`,
        },
      ],
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Throughput:* ${report.throughput.total} issues`,
        },
        {
          type: "mrkdwn",
          text: `*Cycle Time:* ${report.cycleTime.average.toFixed(1)}d avg`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${healthEmoji} *Backlog Health:* ${report.backlogHealth.score}/100`,
      },
    },
    ...(report.blockers.length > 0
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*:warning: Blockers (${report.blockers.length}):*\n${report.blockers.map((b) => `• ${b.key}: ${b.summary}`).join("\n")}`,
            },
          },
        ]
      : []),
  ];
}
