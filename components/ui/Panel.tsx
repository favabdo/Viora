"use client";

import type { ReactNode } from "react";

export default function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-3 sm:p-4 overflow-hidden viora-glass">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
