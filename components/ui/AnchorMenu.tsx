"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MenuAnchor = { left: number; right: number; top: number; bottom: number };

export default function AnchorMenu({
  anchor,
  align = "end",
  minWidth = 140,
  onClose,
  children,
}: {
  anchor: MenuAnchor;
  align?: "start" | "end";
  minWidth?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 12;
    const gap = 4;
    const rawLeft = align === "end" ? anchor.right - r.width : anchor.left;
    const left = Math.min(Math.max(rawLeft, pad), Math.max(pad, window.innerWidth - r.width - pad));
    let top = anchor.bottom + gap;
    if (top + r.height > window.innerHeight - pad) top = Math.max(pad, anchor.top - r.height - gap);
    setPos({ left, top });
  }, [anchor, align]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[80] rounded-xl border border-line bg-surface shadow-modal p-1"
      style={{
        minWidth: minWidth,
        left: pos?.left ?? anchor.left,
        top: pos?.top ?? anchor.bottom + 4,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
