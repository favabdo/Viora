"use client";

import { getProjectLucideIcon } from "@/lib/projectIcons";

export default function ProjectMark({
  icon,
  imageUrl,
  color,
  size = 18,
  className = "",
}: {
  icon: string;
  imageUrl?: string | null;
  color?: string;
  size?: number;
  className?: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`object-cover rounded-lg ${className}`} style={{ width: size + 8, height: size + 8 }} />;
  }
  const Icon = getProjectLucideIcon(icon);
  return <Icon size={size} strokeWidth={1.75} color={color} className={className} />;
}
