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
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-gray-900">
              Jira Dashboard
            </span>
            {boards.length > 1 && (
              <select
                value={selectedBoard}
                onChange={(e) => handleBoardChange(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            )}
          </div>
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
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
