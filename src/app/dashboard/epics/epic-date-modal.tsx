"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { EpicProgress } from "@/lib/jira/types";
import { useEpicDateUpdate } from "@/lib/hooks/use-epic-dates";

interface EpicDateModalProps {
  epic: EpicProgress;
  jiraBaseUrl?: string;
  startDateField: string | null;
  endDateField: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function EpicDateModal({
  epic,
  startDateField,
  endDateField,
  onClose,
  onSaved,
}: EpicDateModalProps) {
  const [startDate, setStartDate] = useState(epic.startDate || "");
  const [endDate, setEndDate] = useState(epic.endDate || "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { saving, error, updateDates } = useEpicDateUpdate({
    startDateField,
    endDateField,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (startDate && endDate && endDate < startDate) {
      setValidationError("End date cannot be before start date");
    } else {
      setValidationError(null);
    }
  }, [startDate, endDate]);

  const hasChanges =
    (startDate || null) !== (epic.startDate || null) ||
    (endDate || null) !== (epic.endDate || null);

  const canSave = hasChanges && !validationError && !saving;

  async function handleSave() {
    if (!canSave) return;
    const success = await updateDates(
      epic.key,
      startDate || null,
      endDate || null
    );
    if (success) {
      onSaved();
      onClose();
    }
  }

  const duration =
    startDate && endDate && !validationError
      ? daysBetween(startDate, endDate)
      : null;

  const statusColor =
    epic.status.categoryKey === "done"
      ? "bg-smg-teal/10 text-smg-teal"
      : epic.status.categoryKey === "indeterminate"
        ? "bg-smg-blue/10 text-smg-blue"
        : "bg-smg-gray-100 text-smg-gray-500";

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center smg-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="smg-modal-enter mx-4 w-full max-w-md rounded-2xl border border-smg-gray-100 bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit dates for ${epic.key}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-smg-gray-900">Edit Dates</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-smg-gray-300 transition-colors hover:bg-smg-gray-50 hover:text-smg-gray-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Epic context */}
        <div className="mt-3 rounded-xl bg-smg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-smg-blue">{epic.key}</span>
            <span className="truncate text-sm text-smg-gray-700">{epic.summary}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor}`}>
              {epic.status.name}
            </span>
            <span className="text-xs text-smg-gray-500">{epic.priority.name}</span>
          </div>
        </div>

        {/* Date inputs */}
        <div className="mt-5 space-y-4">
          {startDateField && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
                Start Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 rounded-lg border border-smg-gray-200 px-3 py-2 text-sm text-smg-gray-700 outline-none transition-colors focus:border-smg-blue focus:ring-1 focus:ring-smg-blue/20"
                />
                {startDate && (
                  <button
                    onClick={() => setStartDate("")}
                    className="rounded-lg px-2 py-2 text-xs text-smg-gray-500 transition-colors hover:bg-smg-gray-50 hover:text-smg-danger"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {endDateField && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-smg-gray-500">
                End Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 rounded-lg border border-smg-gray-200 px-3 py-2 text-sm text-smg-gray-700 outline-none transition-colors focus:border-smg-blue focus:ring-1 focus:ring-smg-blue/20"
                />
                {endDate && (
                  <button
                    onClick={() => setEndDate("")}
                    className="rounded-lg px-2 py-2 text-xs text-smg-gray-500 transition-colors hover:bg-smg-gray-50 hover:text-smg-danger"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Duration display */}
          {duration !== null && duration >= 0 && (
            <p className="text-xs text-smg-gray-500">
              Duration: <span className="font-semibold text-smg-gray-700">{duration} day{duration !== 1 ? "s" : ""}</span>
            </p>
          )}
        </div>

        {/* Validation / API error */}
        {(validationError || error) && (
          <p className="mt-3 text-xs text-smg-danger">
            {validationError || error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-smg-gray-500 transition-colors hover:bg-smg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 rounded-lg bg-smg-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-smg-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
