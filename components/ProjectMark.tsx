"use client";

import { getProjectLucideIcon } from "@/lib/projectIcons";

export function clampImageScale(value?: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.min(160, Math.max(50, Math.round(n)));
}

export default function ProjectMark({
  icon,
  imageUrl,
  color,
  size = 18,
  imageScale = 100,
  className = "",
}: {
  icon: string;
  imageUrl?: string | null;
  color?: string;
  size?: number;
  imageScale?: number;
  className?: string;
}) {
  if (imageUrl) {
    const slot = size + 8;
    const scale = clampImageScale(imageScale) / 100;
    const display = slot * scale;
    return (
      <span className={`inline-flex items-center justify-center overflow-hidden rounded-lg ${className}`} style={{ width: slot, height: slot }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="object-cover max-w-none" style={{ width: display, height: display }} />
      </span>
    );
  }
  const Icon = getProjectLucideIcon(icon);
  return <Icon size={size} strokeWidth={1.75} color={color} className={className} />;
}
