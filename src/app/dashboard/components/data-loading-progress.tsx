"use client";

interface ProgressState {
  stage: string;
  message: string;
  percent: number;
  detail?: string;
}

interface DataLoadingProgressProps {
  title: string;
  subtitle?: string;
  progress: ProgressState | null;
  /** Skeleton elements to show faded below the progress card */
  children?: React.ReactNode;
}

export function DataLoadingProgress({
  title,
  subtitle,
  progress,
  children,
}: DataLoadingProgressProps) {
  const percent = progress?.percent ?? 0;
  const message = progress?.message ?? "Connecting to Jira...";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-smg-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-smg-gray-500">{subtitle}</p>
        )}
      </div>

      {/* Progress Card */}
      <div className="smg-card p-8">
        <div className="mx-auto max-w-lg">
          {/* Spinner with percentage */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-smg-gray-100" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-smg-blue animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-smg-blue">
                  {Math.round(percent)}%
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-smg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-smg-blue to-smg-blue-light transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Status message */}
          <p className="text-center text-sm font-medium text-smg-gray-700">
            {message}
          </p>

          {/* Detail */}
          {progress?.detail && (
            <p className="mt-1 text-center text-xs text-smg-gray-500">
              {progress.detail}
            </p>
          )}
        </div>
      </div>

      {/* Faded skeleton placeholders */}
      {children && <div className="opacity-20">{children}</div>}
    </div>
  );
}
