const LEGACY_PURPLE: Record<string, string> = {
  "#6c5ce7": "#EA580C",
  "#7c5cff": "#EA580C",
  "#8b5cf6": "#F97316",
  "#7c3aed": "#C2410C",
  "#a855f7": "#EC4899",
  "#6366f1": "#C2410C",
  "#4f46e5": "#9A3412",
  "#a78bfa": "#FDBA74",
  "#c4b5fd": "#FDBA74",
};

export function migrateBrandColor<T extends string | null | undefined>(color: T): T {
  if (!color) return color;
  return (LEGACY_PURPLE[color.toLowerCase()] ?? color) as T;
}
