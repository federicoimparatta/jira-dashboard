"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "bg-white border-gray-200",
  success: "bg-white border-green-200",
  warning: "bg-white border-amber-200",
  danger: "bg-white border-red-200",
};

const trendIcons = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const trendColors = {
  up: "text-green-600",
  down: "text-red-600",
  flat: "text-gray-500",
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
    <div
      className={`rounded-lg border p-4 shadow-sm ${variantStyles[variant]}`}
    >
      <div className="text-sm font-medium text-gray-500">{title}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend && trendValue && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
            {trendIcons[trend]} {trendValue}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-gray-500">{subtitle}</div>
      )}
    </div>
  );
}
