"use client";

interface HealthGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getColor(score: number): string {
  if (score > 70) return "#129E8F"; // teal
  if (score > 40) return "#E8A317"; // warning
  return "#E5384F"; // danger
}

function getTextColor(score: number): string {
  if (score > 70) return "text-smg-teal";
  if (score > 40) return "text-smg-warning";
  return "text-smg-danger";
}

function getLabel(score: number): string {
  if (score > 70) return "Healthy";
  if (score > 40) return "Needs Attention";
  return "Critical";
}

const ringSize = {
  sm: 96,
  md: 140,
  lg: 180,
};

const strokeWidth = {
  sm: 8,
  md: 10,
  lg: 12,
};

const fontSize = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
};

export function HealthGauge({ score, size = "md" }: HealthGaugeProps) {
  const dim = ringSize[size];
  const sw = strokeWidth[size];
  const radius = (dim - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;
  const color = getColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="#EAF0F6"
            strokeWidth={sw}
          />
          {/* Progress ring */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={sw + 2}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px ${color}60)`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${fontSize[size]} ${getTextColor(score)}`}>
            {score}
          </span>
          <span className="text-xs font-medium text-smg-gray-500">/100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${getTextColor(score)}`}>
        {getLabel(score)}
      </span>
    </div>
  );
}
