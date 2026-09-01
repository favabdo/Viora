"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronDown, ImagePlus, Minus, Plus, Search, X } from "lucide-react";
import { getProjectLucideIcon, PROJECT_ICON_CATALOG } from "@/lib/projectIcons";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ColorPicker from "./ColorPicker";
import ProjectMark, { clampImagePos, clampImageScale, resolveImageFit } from "./ProjectMark";

export type ProjectAppearancePatch = {
  color?: string;
  icon?: string;
  imageUrl?: string | null;
  imageScale?: number;
  imageScaleX?: number;
  imageScaleY?: number;
  imagePosX?: number;
  imagePosY?: number;
};

async function fileToImageDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = objectUrl;
    });
    const max = 720;
    const scale = Math.min(1, max / Math.max(image.width, image.height, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function FitSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-inkFaint">{label}</label>
        <span className="text-[11px] tabular-nums text-inkSoft">{value}%</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clampImageScale(value - 10))}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line text-inkSoft hover:text-ink"
        >
          <Minus size={14} />
        </button>
        <input
          type="range"
          min={40}
          max={200}
          step={5}
          value={value}
          onChange={(e) => onChange(clampImageScale(Number(e.target.value)))}
          className="flex-1 accent-[#6C5CE7]"
        />
        <button
          type="button"
          onClick={() => onChange(clampImageScale(value + 10))}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line text-inkSoft hover:text-ink"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ProjectAppearanceFields({
  color,
  icon,
  imageUrl,
  imageScale = 100,
  imageScaleX,
  imageScaleY,
  imagePosX,
  imagePosY,
  onChange,
}: {
  color: string;
  icon: string;
  imageUrl?: string | null;
  imageScale?: number;
  imageScaleX?: number;
  imageScaleY?: number;
  imagePosX?: number;
  imagePosY?: number;
  onChange: (next: ProjectAppearancePatch) => void;
}) {
  const { t } = useTranslation();
  const [showIcons, setShowIcons] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const iconsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const Icon = getProjectLucideIcon(icon);
  const fit = resolveImageFit({ imageScale, imageScaleX, imageScaleY, imagePosX, imagePosY });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (iconsRef.current && !iconsRef.current.contains(target)) setShowIcons(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredIcons = iconQuery.trim()
    ? PROJECT_ICON_CATALOG.filter((item) => item.id.includes(iconQuery.trim().toLowerCase()))
    : PROJECT_ICON_CATALOG;

  async function onFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const url = await fileToImageDataUrl(file);
    onChange({
      imageUrl: url,
      imageScaleX: 100,
      imageScaleY: 100,
      imagePosX: 50,
      imagePosY: 50,
      imageScale: 100,
    });
    setShowIcons(false);
  }

  function onPreviewPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!imageUrl) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, posX: fit.posX, posY: fit.posY };
  }

  function onPreviewPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const box = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - drag.x) / Math.max(box.width, 1)) * 100;
    const dy = ((e.clientY - drag.y) / Math.max(box.height, 1)) * 100;
    onChange({
      imagePosX: clampImagePos(drag.posX - dx),
      imagePosY: clampImagePos(drag.posY - dy),
    });
  }

  function onPreviewPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="space-y-4">
      <div ref={iconsRef}>
        <label className="block text-xs font-medium text-inkFaint mb-2">{t("projects.iconLabel")}</label>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <ProjectMark
              icon={icon}
              imageUrl={imageUrl}
              size={22}
              imageScale={imageScale}
              imageScaleX={imageScaleX}
              imageScaleY={imageScaleY}
              imagePosX={imagePosX}
              imagePosY={imagePosY}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowIcons((v) => !v)}
            className="h-10 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm text-inkSoft hover:text-ink"
          >
            <Icon size={16} />
            <ChevronDown size={14} className={`transition-transform ${showIcons ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-10 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs text-inkSoft hover:text-ink"
          >
            <ImagePlus size={14} />
            {t("projects.uploadImage")}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => onChange({ imageUrl: null })}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-line text-inkFaint hover:text-ink"
              aria-label={t("projects.removeImage")}
            >
              <X size={14} />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {imageUrl && (
          <div className="mt-3 space-y-3">
            <div
              className="relative mx-auto h-28 w-28 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing touch-none"
              style={{ backgroundColor: `${color}22` }}
              onPointerDown={onPreviewPointerDown}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={onPreviewPointerUp}
              onPointerCancel={onPreviewPointerUp}
            >
              <ProjectMark
                icon={icon}
                imageUrl={imageUrl}
                size={104}
                imageScale={imageScale}
                imageScaleX={imageScaleX}
                imageScaleY={imageScaleY}
                imagePosX={imagePosX}
                imagePosY={imagePosY}
              />
            </div>
            <p className="text-[11px] text-inkFaint text-center">{t("projects.imagePosition")}</p>
            <FitSlider label={t("projects.imageWidth")} value={fit.scaleX} onChange={(next) => onChange({ imageScaleX: next })} />
            <FitSlider label={t("projects.imageHeight")} value={fit.scaleY} onChange={(next) => onChange({ imageScaleY: next })} />
          </div>
        )}
        {showIcons && (
          <div className="mt-2 w-full rounded-xl border border-line bg-paperDark/60 p-2">
            <div className="relative mb-2">
              <Search size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-inkFaint" />
              <input
                autoFocus
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                placeholder={t("projects.searchIcons")}
                className="w-full rounded-lg border-0 bg-surface ps-8 pe-2 py-1.5 text-xs text-ink outline-none"
              />
            </div>
            <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto thin-scroll">
              {filteredIcons.map(({ id, icon: Item }) => (
                <button
                  key={id}
                  type="button"
                  title={id}
                  onClick={() => {
                    onChange({ icon: id, imageUrl: null });
                    setShowIcons(false);
                    setIconQuery("");
                  }}
                  className={`h-8 w-8 rounded-lg inline-flex items-center justify-center ${
                    icon === id && !imageUrl ? "bg-[#6C5CE7]/20 text-[#6C5CE7]" : "text-inkSoft hover:bg-surface"
                  }`}
                >
                  <Item size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-inkFaint mb-2">{t("projects.colorLabel")}</label>
        <ColorPicker value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#6C5CE7"} onChange={(next) => onChange({ color: next })} />
      </div>
    </div>
  );
}
