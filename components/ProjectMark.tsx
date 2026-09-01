"use client";

import { getProjectLucideIcon } from "@/lib/projectIcons";

export function clampImageScale(value?: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.min(200, Math.max(40, Math.round(n)));
}

export function clampImagePos(value?: number | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function resolveImageFit(opts: {
  imageScale?: number;
  imageScaleX?: number;
  imageScaleY?: number;
  imagePosX?: number;
  imagePosY?: number;
}) {
  const fallback = opts.imageScale ?? 100;
  return {
    scaleX: clampImageScale(opts.imageScaleX ?? fallback),
    scaleY: clampImageScale(opts.imageScaleY ?? fallback),
    posX: clampImagePos(opts.imagePosX),
    posY: clampImagePos(opts.imagePosY),
  };
}

export default function ProjectMark({
  icon,
  imageUrl,
  color,
  size = 18,
  imageScale = 100,
  imageScaleX,
  imageScaleY,
  imagePosX,
  imagePosY,
  className = "",
}: {
  icon: string;
  imageUrl?: string | null;
  color?: string;
  size?: number;
  imageScale?: number;
  imageScaleX?: number;
  imageScaleY?: number;
  imagePosX?: number;
  imagePosY?: number;
  className?: string;
}) {
  if (imageUrl) {
    const slot = size + 8;
    const fit = resolveImageFit({ imageScale, imageScaleX, imageScaleY, imagePosX, imagePosY });
    return (
      <span className={`inline-flex items-center justify-center overflow-hidden rounded-lg ${className}`} style={{ width: slot, height: slot }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="max-w-none select-none"
          draggable={false}
          style={{
            width: slot * (fit.scaleX / 100),
            height: slot * (fit.scaleY / 100),
            objectFit: "cover",
            objectPosition: `${fit.posX}% ${fit.posY}%`,
          }}
        />
      </span>
    );
  }
  const Icon = getProjectLucideIcon(icon);
  return <Icon size={size} strokeWidth={1.75} color={color} className={className} />;
}
