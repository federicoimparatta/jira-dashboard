"use client";

import { useState } from "react";
import { generateDashboardPdf } from "@/lib/pdf/generate-report";

const EXPORT_PASSWORD = "pdf";

export function PdfExportButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    const entered = prompt("Enter password to export:");
    if (entered === null) return; // cancelled
    if (entered !== EXPORT_PASSWORD) {
      alert("Incorrect password.");
      return;
    }

    setLoading(true);
    try {
      await generateDashboardPdf();
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50"
      title="Export PDF report"
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )}
      <span className="hidden sm:inline">{loading ? "Generating\u2026" : "Export PDF"}</span>
    </button>
  );
}
