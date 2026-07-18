"use client";

import { ReactNode } from "react";

export default function Modal({
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  onClose?: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-ink/50 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 fade-in"
      onClick={onClose}
    >
      <div
        className={`bg-paper border border-line rounded-lg shadow-modal w-full p-5 max-h-[85vh] overflow-y-auto thin-scroll ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
