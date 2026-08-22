"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  onClose,
  children,
  title,
  maxWidth = "max-w-sm",
}: {
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-xl border border-[#2D2F39] bg-[#1A1C23] shadow-[0_24px_64px_rgba(0,0,0,0.55)] p-6 max-h-[85vh] overflow-y-auto thin-scroll`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-start justify-between gap-3 mb-5">
            <h3 className="text-lg font-semibold text-ink leading-tight">{title}</h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-white/5"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
