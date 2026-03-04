"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PdfExportButton } from "./pdf-export-button";

const links = [
  { href: "/dashboard", label: "Sprint" },
  { href: "/dashboard/velocity", label: "Velocity" },
  { href: "/dashboard/backlog", label: "Backlog Health" },
  { href: "/dashboard/initiatives", label: "Initiatives" },
  { href: "/dashboard/epics", label: "Epics" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");

  useEffect(() => {
    // Fetch available boards from config
    fetch("/api/config/boards")
      .then((res) => res.json())
      .then((data) => {
        const fetchedBoards = data.boards || [];
        setBoards(fetchedBoards);
        // Set initial board from URL, default to "all" for multi-board or first board for single
        const boardParam = searchParams.get("board");
        const defaultBoard = fetchedBoards.length > 1 ? "all" : fetchedBoards[0]?.id || "";
        const selected = boardParam || defaultBoard;
        setSelectedBoard(selected);
        // Push default board to URL if not already set
        if (!boardParam && selected) {
          const params = new URLSearchParams(searchParams);
          params.set("board", selected);
          router.replace(`${pathname}?${params.toString()}`);
        }
      })
      .catch(() => {
        // Fallback to single board from env
        const boardId = searchParams.get("board") || "1";
        setBoards([{ id: boardId, name: `Board ${boardId}` }]);
        setSelectedBoard(boardId);
      });
  }, [searchParams]);

  const handleBoardChange = (boardId: string) => {
    setSelectedBoard(boardId);
    const params = new URLSearchParams(searchParams);
    params.set("board", boardId);
    router.push(`${pathname}?${params.toString()}`);
  };

  const isCrossBoardPage = pathname === "/dashboard/epics" || pathname === "/dashboard/initiatives" || pathname === "/dashboard/velocity";

  return (
    <nav className="dash-gradient-nav shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Brand mark */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="1" width="7" height="7" rx="2" fill="white" opacity="0.9"/>
                  <rect x="10" y="1" width="7" height="7" rx="2" fill="white" opacity="0.6"/>
                  <rect x="1" y="10" width="7" height="7" rx="2" fill="white" opacity="0.6"/>
                  <rect x="10" y="10" width="7" height="7" rx="2" fill="white" opacity="0.3"/>
                </svg>
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">
                Engineering
              </span>
            </div>

            {/* Board selector (hidden on cross-board pages like Epics) */}
            {boards.length > 1 && !isCrossBoardPage && (
              <div className="hidden sm:block">
                <select
                  value={selectedBoard}
                  onChange={(e) => handleBoardChange(e.target.value)}
                  className="dash-select rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <option value="all" className="bg-dash-navy text-white">
                    All Boards
                  </option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id} className="bg-dash-navy text-white">
                      {board.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation tabs + export */}
          <div className="flex items-center gap-1">
            {links.map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              const href =
                link.href === "/dashboard/epics" || link.href === "/dashboard/initiatives" || link.href === "/dashboard/velocity"
                  ? link.href
                  : `${link.href}${selectedBoard ? `?board=${selectedBoard}` : ""}`;
              return (
                <Link
                  key={link.href}
                  href={href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white text-dash-navy shadow-md"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="ml-2 flex items-center gap-1 border-l border-white/20 pl-2">
              <PdfExportButton />
              <Link
                href="/setup"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Change tracked boards"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <button
                onClick={async () => {
                  await fetch("/api/auth", { method: "DELETE" });
                  window.location.href = "/login";
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Sign out"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile board selector (hidden on cross-board pages like Epics) */}
      {boards.length > 1 && !isCrossBoardPage && (
        <div className="border-t border-white/10 px-4 py-2 sm:hidden">
          <select
            value={selectedBoard}
            onChange={(e) => handleBoardChange(e.target.value)}
            className="dash-select w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm"
          >
            <option value="all" className="bg-dash-navy text-white">
              All Boards
            </option>
            {boards.map((board) => (
              <option key={board.id} value={board.id} className="bg-dash-navy text-white">
                {board.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
}
