"use client";

import { useState, useCallback } from "react";
import { mutate } from "swr";

interface UseEpicDateUpdateOptions {
  startDateField: string | null;
  endDateField: string | null;
}

export function useEpicDateUpdate({
  startDateField,
  endDateField,
}: UseEpicDateUpdateOptions) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDates = useCallback(
    async (
      issueKey: string,
      startDate: string | null,
      endDate: string | null
    ) => {
      setSaving(true);
      setError(null);

      const fields: Record<string, string | null> = {};
      if (startDateField) fields[startDateField] = startDate || null;
      if (endDateField) fields[endDateField] = endDate || null;

      try {
        const res = await fetch(`/api/jira/issues/${issueKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update dates");
        }

        // Revalidate epics SWR cache
        await mutate("/api/jira/epics");
        setSaving(false);
        return true;
      } catch (err) {
        setSaving(false);
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [startDateField, endDateField]
  );

  return { saving, error, updateDates };
}
