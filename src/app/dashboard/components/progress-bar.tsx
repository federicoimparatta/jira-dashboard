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
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-smg-gray-100">
        <div
          className="smg-progress-done transition-all duration-700 ease-out"
          style={{ width: `${donePercent}%` }}
          title={`Done: ${done} pts`}
        />
        <div
          className="smg-progress-wip transition-all duration-700 ease-out"
          style={{ width: `${inProgressPercent}%` }}
          title={`In Progress: ${inProgress} pts`}
        />
        <div
          className="bg-smg-gray-200 transition-all duration-700 ease-out"
          style={{ width: `${todoPercent}%` }}
          title={`To Do: ${todo} pts`}
        />
      </div>
      {showLabels && (
        <div className="mt-3 flex gap-5 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-smg-gray-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-smg-teal" />
            Done {done} pts ({Math.round(donePercent)}%)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-smg-gray-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-smg-blue" />
            In Progress {inProgress} pts ({Math.round(inProgressPercent)}%)
          </span>
          <span className="flex items-center gap-1.5 font-medium text-smg-gray-700">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-smg-gray-200" />
            To Do {todo} pts ({Math.round(todoPercent)}%)
          </span>
        </div>
      )}
    </div>
  );
}
