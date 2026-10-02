"use client";

import type { ReactNode } from "react";

export default function Panel({
  title,
  action,
  icon,
  accent = "#2563EB",
  children,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-3 sm:p-4 overflow-hidden viora-glass">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span
              className="h-7 w-7 shrink-0 rounded-lg inline-flex items-center justify-center"
              style={{ backgroundColor: `${accent}1f`, color: accent }}
            >
              {icon}
            </span>
          )}
          <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
