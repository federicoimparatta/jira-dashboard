# Inline Date Popover for Epics

## Problem

Editing epic start/end dates requires clicking a pencil icon to open a full-screen modal. This is heavyweight for a simple date change.

## Solution

Replace the modal with inline-clickable date chips in the epic card stats row. Each chip opens a small popover anchored below it for editing that single date.

## UI Changes

### Date chips (in stats row)

- Two independent clickable chips replace the current date text + pencil icon
- When date is set: `Start: Mar 5, 2026` / `End: Mar 31, 2026` (calendar icon, clickable)
- When date is null: `+ Start date` / `+ End date` (subtle placeholder, clickable)
- Only rendered when the corresponding date field is configured

### Popover (per date)

- Small card anchored below the clicked chip
- Contains: label, native date input, clear button, save button
- Dismiss: click outside or Escape (no save)
- Shows saving spinner, closes on success
- Inline validation: warns if end date < start date
- Inline error display for API failures

## What changes

- `epic-card-expandable.tsx`: Replace date text + pencil icon with `DateChip` components
- New `DatePopover` component (inline in same file or small separate file)
- Remove `EpicDateModal` component (no longer used)
- Remove modal import and `showDateModal` state from `ExpandableEpicCard`

## What stays the same

- `useEpicDateUpdate` hook — reused as-is
- API route (`/api/jira/issues/[issueKey]/route.ts`) — unchanged
- SWR cache invalidation flow — unchanged
- `DateFields` interface — unchanged
