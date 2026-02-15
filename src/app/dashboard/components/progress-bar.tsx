"use client";

interface ProgressBarProps {
  done: number;
  inProgress: number;
  todo: number;
  total: number;
  showLabels?: boolean;
}

export function ProgressBar({
  done,
  inProgress,
  todo,
  total,
  showLabels = true,
}: ProgressBarProps) {
  const donePercent = total > 0 ? (done / total) * 100 : 0;
  const inProgressPercent = total > 0 ? (inProgress / total) * 100 : 0;
  const todoPercent = total > 0 ? (todo / total) * 100 : 0;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${donePercent}%` }}
          title={`Done: ${done} pts`}
        />
        <div
          className="bg-blue-500 transition-all duration-500"
          style={{ width: `${inProgressPercent}%` }}
          title={`In Progress: ${inProgress} pts`}
        />
        <div
          className="bg-gray-300 transition-all duration-500"
          style={{ width: `${todoPercent}%` }}
          title={`To Do: ${todo} pts`}
        />
      </div>
      {showLabels && (
        <div className="mt-2 flex gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Done {done} pts ({Math.round(donePercent)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            In Progress {inProgress} pts ({Math.round(inProgressPercent)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
            To Do {todo} pts ({Math.round(todoPercent)}%)
          </span>
        </div>
      )}
    </div>
  );
}
