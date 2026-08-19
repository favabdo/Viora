"use client";

/** دونات چارت بسيط بـ SVG بحت - من غير أي مكتبة رسوم بيانية خارجية */
export default function DonutChart({
  segments,
  size = 120,
  strokeWidth = 16,
  centerLabel,
  centerSubLabel,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const fraction = total > 0 ? s.value / total : 0;
      const dash = fraction * circumference;
      const el = (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
        />
      );
      offset += dash;
      return el;
    });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--color-paperDark))" strokeWidth={strokeWidth} />
        {arcs}
      </svg>
      {(centerLabel || centerSubLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && <span className="text-lg font-semibold text-ink">{centerLabel}</span>}
          {centerSubLabel && <span className="text-2xs text-inkFaint">{centerSubLabel}</span>}
        </div>
      )}
    </div>
  );
}
