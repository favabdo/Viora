"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Search, X } from "lucide-react";
import { getProjectLucideIcon, PROJECT_ICON_CATALOG } from "@/lib/projectIcons";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ColorPicker from "./ColorPicker";
import ProjectMark from "./ProjectMark";

async function fileToImageDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 160;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    const s = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - s) / 2;
    const sy = (bitmap.height - s) / 2;
    ctx.drawImage(bitmap, sx, sy, s, s, 0, 0, size, size);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}

export default function ProjectAppearanceFields({
  color,
  icon,
  imageUrl,
  onChange,
}: {
  color: string;
  icon: string;
  imageUrl?: string | null;
  onChange: (next: { color?: string; icon?: string; imageUrl?: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [showIcons, setShowIcons] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const iconsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const Icon = getProjectLucideIcon(icon);

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
    onChange({ imageUrl: url });
    setShowIcons(false);
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
            <ProjectMark icon={icon} imageUrl={imageUrl} size={22} />
          </div>
          <button
            type="button"
            onClick={() => {
              setShowIcons((v) => !v);
            }}
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
