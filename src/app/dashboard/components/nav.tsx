"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/dashboard", label: "Sprint" },
  { href: "/dashboard/backlog", label: "Backlog Health" },
  { href: "/dashboard/trends", label: "Trends" },
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
        setBoards(data.boards || []);
        // Set initial board from URL or default to first board
        const boardParam = searchParams.get("board");
        setSelectedBoard(boardParam || data.boards[0]?.id || "");
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

  return (
    <nav className="smg-gradient-nav shadow-lg">
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

            {/* Board selector */}
            {boards.length > 1 && (
              <div className="hidden sm:block">
                <select
                  value={selectedBoard}
                  onChange={(e) => handleBoardChange(e.target.value)}
                  className="smg-select rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  {boards.map((board) => (
                    <option key={board.id} value={board.id} className="bg-smg-navy text-white">
                      {board.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation tabs */}
          <div className="flex gap-1">
            {links.map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={`${link.href}${selectedBoard ? `?board=${selectedBoard}` : ""}`}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white text-smg-navy shadow-md"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile board selector */}
      {boards.length > 1 && (
        <div className="border-t border-white/10 px-4 py-2 sm:hidden">
          <select
            value={selectedBoard}
            onChange={(e) => handleBoardChange(e.target.value)}
            className="smg-select w-full rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm"
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id} className="bg-smg-navy text-white">
                {board.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </nav>
  );
}
