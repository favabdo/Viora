"use client";

import type { ReactNode } from "react";

export function SettingsHeader({ title, subtitle, onBack, backLabel }: { title: string; subtitle?: string; onBack: () => void; backLabel: string }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line/60 bg-paper/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="-ms-1.5 inline-flex h-9 w-9 items-center justify-center rounded-xl text-inkSoft transition-colors hover:bg-paperDark hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold leading-tight text-ink">{title}</h1>
          {subtitle && <p className="truncate text-xs text-inkFaint">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

export function SettingsGroupTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-1.5 ms-1 text-[11px] font-semibold uppercase tracking-wider text-inkFaint">{children}</h2>;
}

export function SettingsGroup({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-surface ${danger ? "border-[#E85D4C]/30" : "border-line"}`}
    >
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

export function SettingsRow({
  icon: Icon,
  iconColor = "#2563EB",
  title,
  hint,
  badge,
  control,
  danger,
  stacked,
  onClick,
}: {
  icon?: React.ElementType;
  iconColor?: string;
  title: ReactNode;
  hint?: ReactNode;
  badge?: string;
  control?: ReactNode;
  danger?: boolean;
  stacked?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`flex w-full gap-3 px-4 py-3.5 text-start transition-colors ${onClick ? "cursor-pointer hover:bg-paperDark/50" : ""} ${
        stacked ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${iconColor}1a`, color: iconColor }}
          >
            <Icon size={16} strokeWidth={1.9} />
          </span>
        )}
        <div className="min-w-0">
          <p className={`flex items-center gap-2 text-sm font-medium ${danger ? "text-[#D14836] dark:text-[#F0A196]" : "text-ink"}`}>
            {title}
            {badge && <span className="rounded-md bg-paperDark px-1.5 py-0.5 text-[10px] font-medium text-inkFaint">{badge}</span>}
          </p>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-inkFaint">{hint}</p>}
        </div>
      </div>
      {control && <div className={`shrink-0 ${stacked ? "w-full" : "sm:pe-1"}`}>{control}</div>}
    </Wrapper>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-paperDark p-0.5" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === opt.value ? "bg-surface text-ink shadow-sm" : "text-inkFaint hover:text-inkSoft"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? "justify-end bg-[#2563EB]" : "justify-start bg-lineStrong"}`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export function Select({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-full min-w-[8.5rem] cursor-pointer rounded-xl border border-line bg-paperDark px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-[#2563EB]"
    >
      {children}
    </select>
  );
}

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <label className="mb-1.5 block text-[13px] font-medium text-inkSoft">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-inkFaint">{hint}</p>}
    </div>
  );
}
