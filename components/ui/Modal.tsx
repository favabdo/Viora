"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  onClose,
  children,
  title,
  titleAlign = "start",
  maxWidth = "max-w-sm",
}: {
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  titleAlign?: "start" | "center";
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
        className={`w-full ${maxWidth} rounded-xl border border-line bg-surface shadow-modal p-6 max-h-[85vh] overflow-y-auto thin-scroll viora-glass`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={`relative mb-5 ${titleAlign === "center" ? "" : "flex items-start justify-between gap-3"}`}>
            <h3 className={`text-lg font-semibold text-ink leading-tight ${titleAlign === "center" ? "text-center px-8" : ""}`}>
              {title}
            </h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark ${
                  titleAlign === "center" ? "absolute end-0 top-0" : ""
                }`}
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
