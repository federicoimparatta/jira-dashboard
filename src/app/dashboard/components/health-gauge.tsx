"use client";

interface HealthGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getColor(score: number): string {
  if (score > 70) return "text-green-600";
  if (score > 40) return "text-amber-500";
  return "text-red-600";
}

function getBgColor(score: number): string {
  if (score > 70) return "bg-green-50 border-green-200";
  if (score > 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function getLabel(score: number): string {
  if (score > 70) return "Healthy";
  if (score > 40) return "Needs Attention";
  return "Critical";
}

const sizes = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
};

export function HealthGauge({ score, size = "md" }: HealthGaugeProps) {
  return (
    <div
      className={`inline-flex flex-col items-center rounded-xl border p-6 ${getBgColor(score)}`}
    >
      <div className={`font-bold ${sizes[size]} ${getColor(score)}`}>
        {score}
      </div>
      <div className="text-sm font-medium text-gray-600">/ 100</div>
      <div className={`mt-1 text-sm font-semibold ${getColor(score)}`}>
        {getLabel(score)}
      </div>
    </div>
  );
}
