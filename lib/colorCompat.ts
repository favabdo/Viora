const LEGACY_BRAND: Record<string, string> = {
  "#6c5ce7": "#2563EB",
  "#7c5cff": "#2563EB",
  "#8c3aed": "#2563EB",
  "#ea580c": "#2563EB",
  "#8b5cf6": "#3B82F6",
  "#7c3aed": "#1D4ED8",
  "#6366f1": "#1D4ED8",
  "#c2410c": "#1D4ED8",
  "#4f46e5": "#1E40AF",
  "#6d28d9": "#1E40AF",
  "#5b4bd6": "#1E40AF",
  "#9a3412": "#1E40AF",
  "#a78bfa": "#BFDBFE",
  "#c4b5fd": "#BFDBFE",
  "#8b7cff": "#93C5FD",
  "#fb923c": "#93C5FD",
  "#a855f7": "#0891B2",
  "#d946ef": "#059669",
  "#e11d48": "#059669",
};

export function migrateBrandColor<T extends string | null | undefined>(color: T): T {
  if (!color) return color;
  return (LEGACY_BRAND[color.toLowerCase()] ?? color) as T;
}
