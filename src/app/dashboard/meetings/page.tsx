"use client";

import { Suspense, useState } from "react";
import { useMeetingsData } from "@/lib/hooks/use-dashboard-data";
import { StatCard } from "../components/stat-card";
import type { MeetingDigestResponse, MeetingsPageResponse } from "@/lib/meetings/types";

function MeetingsContent() {
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [selectedSprint, setSelectedSprint] = useState<string>("");
  const [expandedMeeting, setExpandedMeeting] = useState<number | null>(null);

  const { data, error, isLoading } = useMeetingsData({
    team: selectedTeam || undefined,
    week: selectedWeek || undefined,
    sprint: selectedSprint || undefined,
  }) as { data: MeetingsPageResponse | undefined; error: unknown; isLoading: boolean };

  if (isLoading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="smg-card border-smg-danger/20 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-smg-danger">
          Failed to load meetings data
        </h2>
        <p className="mt-1 text-sm text-smg-danger/70">
          {data && "error" in data ? String((data as Record<string, unknown>).error) : "No meeting data available. Run the ingestion script to sync Fellow meetings."}
        </p>
      </div>
    );
  }

  const meetings = data.meetings || [];
  const allBlockers = meetings.flatMap((m) =>
    m.blockers.map((b) => ({ ...b, meetingTitle: m.meetingTitle, teamName: m.teamName, meetingDate: m.meetingDate }))
  );
  const openBlockers = allBlockers.filter((b) => b.status === "open");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-smg-gray-900">
            Meeting Intelligence
          </h1>
          <p className="mt-1 text-sm text-smg-gray-500">
            Team meeting summaries, decisions, and blockers from Fellow
          </p>
        </div>
        <div className="rounded-full bg-smg-gray-100 px-3 py-1 text-xs font-medium text-smg-gray-500">
          {meetings.length} meetings
        </div>
      </div>

      {/* Filters */}
      <div className="smg-card flex flex-wrap items-center gap-3 p-4">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="rounded-lg border border-smg-gray-200 bg-white px-3 py-1.5 text-sm text-smg-gray-700 focus:outline-none focus:ring-2 focus:ring-smg-blue/30"
        >
          <option value="">All Teams</option>
          {(data.teams || []).map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>

        <select
          value={selectedSprint}
          onChange={(e) => {
            setSelectedSprint(e.target.value);
            setSelectedWeek(""); // Clear week when sprint selected
          }}
          className="rounded-lg border border-smg-gray-200 bg-white px-3 py-1.5 text-sm text-smg-gray-700 focus:outline-none focus:ring-2 focus:ring-smg-blue/30"
        >
          <option value="">All Sprints</option>
          {(data.sprints || []).map((sprint) => (
            <option key={sprint.id} value={sprint.name}>
              {sprint.name}
            </option>
          ))}
        </select>

        <select
          value={selectedWeek}
          onChange={(e) => {
            setSelectedWeek(e.target.value);
            setSelectedSprint(""); // Clear sprint when week selected
          }}
          className="rounded-lg border border-smg-gray-200 bg-white px-3 py-1.5 text-sm text-smg-gray-700 focus:outline-none focus:ring-2 focus:ring-smg-blue/30"
        >
          <option value="">All Weeks</option>
          {(data.weekStarts || []).map((week) => (
            <option key={week} value={week}>
              Week of {new Date(week + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </option>
          ))}
        </select>

        {(selectedTeam || selectedWeek || selectedSprint) && (
          <button
            onClick={() => {
              setSelectedTeam("");
              setSelectedWeek("");
              setSelectedSprint("");
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-smg-blue hover:bg-smg-blue/5"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Meetings"
          value={meetings.length}
          subtitle={`across ${new Set(meetings.map((m) => m.teamName)).size} teams`}
        />
        <StatCard
          title="Open Blockers"
          value={openBlockers.length}
          variant={openBlockers.length > 0 ? "danger" : "success"}
          subtitle={`${allBlockers.length} total identified`}
        />
        <StatCard
          title="Action Items"
          value={meetings.reduce((sum, m) => sum + m.actionItems.length, 0)}
          subtitle={`${meetings.reduce((sum, m) => sum + m.actionItems.filter((a) => a.completed).length, 0)} completed`}
        />
        <StatCard
          title="Decisions"
          value={meetings.reduce((sum, m) => sum + m.decisions.length, 0)}
          subtitle="documented"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Meeting Cards — 2 cols */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="smg-section-label">Meetings</h2>
          {meetings.length === 0 ? (
            <div className="smg-card p-8 text-center">
              <p className="text-sm text-smg-gray-400">
                No meetings found for the selected filters
              </p>
            </div>
          ) : (
            meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                isExpanded={expandedMeeting === meeting.id}
                onToggle={() =>
                  setExpandedMeeting(
                    expandedMeeting === meeting.id ? null : meeting.id
                  )
                }
              />
            ))
          )}
        </div>

        {/* Blockers Panel — 1 col */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="smg-section-label">Blockers</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                openBlockers.length > 0
                  ? "bg-smg-danger/10 text-smg-danger"
                  : "bg-smg-teal/10 text-smg-teal"
              }`}
            >
              {openBlockers.length} open
            </span>
          </div>

          {openBlockers.length === 0 ? (
            <div className="smg-card p-6">
              <p className="text-sm text-smg-gray-300">No open blockers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openBlockers.map((blocker) => (
                <div
                  key={blocker.id}
                  className="smg-card p-4"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                        blocker.severity === "high"
                          ? "bg-smg-danger"
                          : blocker.severity === "medium"
                            ? "bg-smg-warning"
                            : "bg-smg-gray-400"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-smg-gray-700">
                        {blocker.description}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-smg-gray-500">
                        <span className="font-medium text-smg-blue">
                          {blocker.teamName}
                        </span>
                        <span>
                          {new Date(blocker.meetingDate).toLocaleDateString()}
                        </span>
                        {blocker.jiraIssueKey && (
                          <span className="rounded bg-smg-blue/10 px-1.5 py-0.5 font-medium text-smg-blue">
                            {blocker.jiraIssueKey}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MeetingCard({
  meeting,
  isExpanded,
  onToggle,
}: {
  meeting: MeetingDigestResponse;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasBlockers = meeting.blockers.some((b) => b.status === "open");

  return (
    <div className={`smg-card overflow-hidden ${hasBlockers ? "border-smg-danger/20" : ""}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-smg-gray-50/50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-smg-gray-900">
              {meeting.meetingTitle}
            </h3>
            {hasBlockers && (
              <span className="rounded-full bg-smg-danger/10 px-2 py-0.5 text-[10px] font-bold text-smg-danger">
                BLOCKER
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-smg-gray-500">
            <span className="rounded bg-smg-blue/10 px-1.5 py-0.5 font-medium text-smg-blue">
              {meeting.teamName}
            </span>
            <span>
              {new Date(meeting.meetingDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            {meeting.sprintName && (
              <span className="text-smg-gray-400">{meeting.sprintName}</span>
            )}
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-smg-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Summary (always visible) */}
      <div className="border-t border-smg-gray-100 px-4 py-3">
        <p className="text-sm leading-relaxed text-smg-gray-600">
          {meeting.summary}
        </p>
        {meeting.keyTopics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meeting.keyTopics.map((topic, i) => (
              <span
                key={i}
                className="rounded-full bg-smg-gray-100 px-2 py-0.5 text-[11px] text-smg-gray-600"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="space-y-4 border-t border-smg-gray-100 px-4 py-4">
          {/* Action Items */}
          {meeting.actionItems.length > 0 && (
            <div>
              <h4 className="smg-section-label mb-2">Action Items</h4>
              <ul className="space-y-1.5">
                {meeting.actionItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1 text-xs ${item.completed ? "text-smg-teal" : "text-smg-gray-400"}`}
                    >
                      {item.completed ? "\u2713" : "\u25CB"}
                    </span>
                    <div>
                      <span className="text-smg-gray-700">
                        {item.description}
                      </span>
                      {item.assignee && (
                        <span className="ml-1.5 text-xs text-smg-blue">
                          @{item.assignee}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions */}
          {meeting.decisions.length > 0 && (
            <div>
              <h4 className="smg-section-label mb-2">Decisions</h4>
              <ul className="space-y-1.5">
                {meeting.decisions.map((d) => (
                  <li key={d.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-xs text-smg-purple">&rarr;</span>
                    <span className="text-smg-gray-700">{d.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blockers */}
          {meeting.blockers.length > 0 && (
            <div>
              <h4 className="smg-section-label mb-2">Blockers</h4>
              <ul className="space-y-1.5">
                {meeting.blockers.map((b) => (
                  <li key={b.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                        b.severity === "high"
                          ? "bg-smg-danger"
                          : b.severity === "medium"
                            ? "bg-smg-warning"
                            : "bg-smg-gray-400"
                      }`}
                    />
                    <div>
                      <span className="text-smg-gray-700">{b.description}</span>
                      {b.jiraIssueKey && (
                        <span className="ml-1.5 rounded bg-smg-blue/10 px-1.5 py-0.5 text-xs font-medium text-smg-blue">
                          {b.jiraIssueKey}
                        </span>
                      )}
                      <span
                        className={`ml-1.5 text-xs ${
                          b.status === "open" ? "text-smg-danger" : "text-smg-teal"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fellow link */}
          {meeting.fellowUrl && (
            <a
              href={meeting.fellowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-smg-blue hover:underline"
            >
              Open in Fellow
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="smg-skeleton h-8 w-64" />
      <div className="smg-skeleton h-12" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="smg-skeleton h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="smg-skeleton h-32" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="smg-skeleton h-24" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <MeetingsContent />
    </Suspense>
  );
}
