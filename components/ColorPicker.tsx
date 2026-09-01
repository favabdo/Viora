"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pipette } from "lucide-react";

type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };
type ChannelMode = "rgb" | "hex";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseHex(color: string): Rgb {
  const hex = color.replace("#", "").trim();
  if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) return { r: 108, g: 92, b: 231 };
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function hueCss(h: number) {
  return `hsl(${h}, 100%, 50%)`;
}

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const planeRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState<Hsv>(() => {
    const rgb = parseHex(value);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });
  const [mode, setMode] = useState<ChannelMode>("rgb");
  const [hexDraft, setHexDraft] = useState(value.toUpperCase());
  const dragging = useRef<"sv" | "hue" | null>(null);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [canEyedrop, setCanEyedrop] = useState(false);

  useEffect(() => {
    setCanEyedrop("EyeDropper" in window);
  }, []);

  useEffect(() => {
    const rgb = parseHex(value);
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHsv((prev) => ({ h: next.s === 0 ? prev.h : next.h, s: next.s, v: next.v }));
    setHexDraft(rgbToHex(rgb));
  }, [value]);

  function emit(next: Hsv) {
    hsvRef.current = next;
    setHsv(next);
    const hex = rgbToHex(hsvToRgb(next.h, next.s, next.v));
    setHexDraft(hex);
    onChangeRef.current(hex);
  }

  function svFromPointer(clientX: number, clientY: number) {
    const el = planeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    emit({ ...hsvRef.current, s, v });
  }

  function hueFromPointer(clientX: number) {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 359.99);
    emit({ ...hsvRef.current, h });
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      if (dragging.current === "sv") svFromPointer(e.clientX, e.clientY);
      if (dragging.current === "hue") hueFromPointer(e.clientX);
    }
    function up() {
      dragging.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hex = rgbToHex(rgb);

  function setChannel(key: keyof Rgb, raw: string) {
    const n = clamp(Number(raw) || 0, 0, 255);
    const nextRgb = { ...rgb, [key]: n };
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    emit({ h: nextHsv.s === 0 ? hsv.h : nextHsv.h, s: nextHsv.s, v: nextHsv.v });
  }

  async function eyedrop() {
    const Ctor = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Ctor) return;
    try {
      const result = await new Ctor().open();
      const nextRgb = parseHex(result.sRGBHex);
      const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
      emit({ h: nextHsv.s === 0 ? hsv.h : nextHsv.h, s: nextHsv.s, v: nextHsv.v });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#2b2b2b]">
      <div
        ref={planeRef}
        className="relative h-44 w-full cursor-crosshair touch-none"
        style={{
          background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hueCss(hsv.h)})`,
        }}
        onPointerDown={(e) => {
          dragging.current = "sv";
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          svFromPointer(e.clientX, e.clientY);
        }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-3 px-3 py-3">
        {canEyedrop ? (
          <button
            type="button"
            onClick={() => void eyedrop()}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            aria-label="Eyedropper"
          >
            <Pipette size={16} />
          </button>
        ) : null}
        <span className="h-8 w-8 rounded-full border border-white/15 shrink-0" style={{ backgroundColor: hex }} />
        <div
          ref={hueRef}
          className="relative h-3 flex-1 cursor-pointer touch-none rounded-full"
          style={{
            background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          }}
          onPointerDown={(e) => {
            dragging.current = "hue";
            hueFromPointer(e.clientX);
          }}
        >
          <span
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueCss(hsv.h) }}
          />
        </div>
      </div>
      <div className="flex items-end gap-2 px-3 pb-3">
        {mode === "rgb" ? (
          (["r", "g", "b"] as const).map((key) => (
            <label key={key} className="flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/50">{key}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[key]}
                onChange={(e) => setChannel(key, e.target.value)}
                className="w-full rounded-md border-0 bg-[#1f1f1f] px-2 py-1.5 text-center text-xs text-white outline-none"
              />
            </label>
          ))
        ) : (
          <label className="flex-1">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/50">hex</span>
            <input
              value={hexDraft}
              maxLength={7}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setHexDraft(next);
                if (/^#[0-9A-F]{6}$/.test(next)) {
                  const nextRgb = parseHex(next);
                  const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
                  emit({ h: nextHsv.s === 0 ? hsv.h : nextHsv.h, s: nextHsv.s, v: nextHsv.v });
                }
              }}
              className="w-full rounded-md border-0 bg-[#1f1f1f] px-2 py-1.5 text-center text-xs font-mono text-white outline-none"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => setMode((m) => (m === "rgb" ? "hex" : "rgb"))}
          className="mb-0.5 h-8 w-8 inline-flex items-center justify-center rounded-md text-white/70 hover:bg-white/10"
          aria-label="Switch RGB / HEX"
        >
          <span className="inline-flex flex-col leading-none">
            <ChevronUp size={10} />
            <ChevronDown size={10} className="-mt-0.5" />
          </span>
        </button>
      </div>
    </div>
  );
}
