"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface JiraBoard {
  id: number;
  name: string;
  type: string;
  projectKey?: string;
  projectName?: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/jira/boards")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load boards");
        return res.json();
      })
      .then((data) => {
        setBoards(data.boards || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load boards from Jira");
        setLoading(false);
      });
  }, []);

  function toggleBoard(boardId: number) {
    setSelectedBoardIds((prev) => {
      const next = new Set(prev);
      if (next.has(boardId)) {
        next.delete(boardId);
      } else {
        next.add(boardId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (selectedBoardIds.size === 0) return;
    setSaving(true);
    setError("");

    try {
      // Derive project key from the first selected board
      const firstBoard = boards.find((b) => selectedBoardIds.has(b.id));
      const projectKey = firstBoard?.projectKey || "";

      const res = await fetch("/api/config/boards/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardIds: Array.from(selectedBoardIds),
          projectKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save configuration");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const filteredBoards = boards.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.projectKey?.toLowerCase() || "").includes(q) ||
      (b.projectName?.toLowerCase() || "").includes(q)
    );
  });

  // Group boards by project
  const grouped = new Map<string, JiraBoard[]>();
  for (const board of filteredBoards) {
    const key = board.projectName || board.projectKey || "Other";
    const existing = grouped.get(key) || [];
    existing.push(board);
    grouped.set(key, existing);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 dash-gradient-nav" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br from-dash-blue to-dash-blue-dark mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Select Your Boards</h1>
          <p className="mt-2 text-sm text-white/60">
            Choose the Jira boards you want to track on your dashboard
          </p>
        </div>

        {/* Main card */}
        <div className="dash-card p-6">
          {/* Top accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-[16px] bg-linear-to-r from-dash-blue via-dash-magenta to-dash-teal" />

          {loading ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="h-10 w-10 rounded-full border-4 border-dash-gray-100 border-t-dash-blue animate-spin" />
              <p className="text-sm text-dash-gray-500">Loading boards from Jira...</p>
            </div>
          ) : error && boards.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-dash-danger">{error}</p>
              <button
                onClick={() => router.push("/login")}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-dash-blue hover:bg-dash-blue/5"
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search boards or projects..."
                  className="w-full px-4 py-2.5 rounded-xl border border-dash-gray-200 bg-white text-sm text-dash-gray-900 placeholder:text-dash-gray-300 outline-none focus:border-dash-blue focus:ring-2 focus:ring-dash-blue/20"
                />
              </div>

              {/* Board list */}
              <div className="max-h-96 overflow-y-auto space-y-4">
                {Array.from(grouped.entries()).map(([projectName, projectBoards]) => (
                  <div key={projectName}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-dash-gray-500 mb-2 px-1">
                      {projectName}
                    </div>
                    <div className="space-y-1">
                      {projectBoards.map((board) => {
                        const isSelected = selectedBoardIds.has(board.id);
                        return (
                          <button
                            key={board.id}
                            onClick={() => toggleBoard(board.id)}
                            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150 ${
                              isSelected
                                ? "bg-dash-blue/5 border-2 border-dash-blue"
                                : "bg-white border-2 border-transparent hover:bg-dash-gray-50"
                            }`}
                          >
                            {/* Checkbox */}
                            <div
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                                isSelected
                                  ? "border-dash-blue bg-dash-blue"
                                  : "border-dash-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="none"
                                >
                                  <path
                                    d="M2.5 6L5 8.5L9.5 3.5"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>

                            {/* Board info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-dash-gray-900 truncate">
                                {board.name}
                              </div>
                              <div className="text-xs text-dash-gray-500">
                                {board.projectKey && (
                                  <span className="inline-block rounded bg-dash-gray-100 px-1.5 py-0.5 text-[10px] font-medium mr-1.5">
                                    {board.projectKey}
                                  </span>
                                )}
                                <span className="capitalize">{board.type}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {filteredBoards.length === 0 && (
                  <p className="py-8 text-center text-sm text-dash-gray-300">
                    {search ? "No boards match your search" : "No boards found in your Jira instance"}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="mt-3 text-xs font-medium text-dash-danger">{error}</p>
              )}

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-dash-gray-500">
                  {selectedBoardIds.size} board{selectedBoardIds.size !== 1 ? "s" : ""} selected
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || selectedBoardIds.size === 0}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-dash-blue to-dash-blue-light hover:shadow-lg hover:shadow-dash-blue/25 active:scale-[0.98]"
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="opacity-25"
                        />
                        <path
                          d="M4 12a8 8 0 018-8"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Continue to Dashboard"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
