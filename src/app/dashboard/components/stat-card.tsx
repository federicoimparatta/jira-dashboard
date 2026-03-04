"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

const variantAccents: Record<string, string> = {
  default: "from-dash-blue to-dash-blue-light",
  success: "from-dash-teal to-emerald-400",
  warning: "from-dash-warning to-amber-400",
  danger: "from-dash-danger to-rose-400",
};

const trendIcons = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const trendColors = {
  up: "text-dash-teal",
  down: "text-dash-danger",
  flat: "text-dash-gray-500",
};

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  variant = "default",
}: StatCardProps) {
  return (
    <div className="dash-card relative overflow-hidden p-5">
      {/* Top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${variantAccents[variant]}`} />

      <div className="text-xs font-semibold uppercase tracking-wider text-dash-gray-500">
        {title}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-dash-gray-900">{value}</span>
        {trend && trendValue && (
          <span className={`text-sm font-semibold ${trendColors[trend]}`}>
            {trendIcons[trend]} {trendValue}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-1.5 text-xs text-dash-gray-500">{subtitle}</div>
      )}
    </div>
  );
}
