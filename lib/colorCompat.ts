const LEGACY_BRAND: Record<string, string> = {
  "#6c5ce7": "#3D6EA5",
  "#7c5cff": "#3D6EA5",
  "#8c3aed": "#3D6EA5",
  "#ea580c": "#3D6EA5",
  "#8b5cf6": "#5B8FC7",
  "#7c3aed": "#2B5680",
  "#6366f1": "#2B5680",
  "#c2410c": "#2B5680",
  "#4f46e5": "#1E3F5E",
  "#6d28d9": "#1E3F5E",
  "#5b4bd6": "#1E3F5E",
  "#9a3412": "#1E3F5E",
  "#a78bfa": "#B7D5EE",
  "#c4b5fd": "#B7D5EE",
  "#8b7cff": "#9CC3E5",
  "#fb923c": "#9CC3E5",
  "#a855f7": "#0891B2",
  "#d946ef": "#0D9488",
  "#e11d48": "#0D9488",
};

export function migrateBrandColor<T extends string | null | undefined>(color: T): T {
  if (!color) return color;
  return (LEGACY_BRAND[color.toLowerCase()] ?? color) as T;
}
