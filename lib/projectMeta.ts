const META_KEY = "viora-project-meta";

export const PROJECT_COLORS = [
  "#6C5CE7",
  "#3B82F6",
  "#14B8A6",
  "#F59E0B",
  "#EC4899",
  "#A855F7",
  "#EAB308",
  "#6B7280",
];

export type ProjectVisibility = "private" | "public";
export type ProjectDefaultView = "board" | "list" | "calendar" | "timeline";
export type TaskCompletionAction = "move_done" | "archive" | "none";

export type ProjectMeta = {
  description: string;
  icon: string;
  color: string;
  key?: string;
  visibility?: ProjectVisibility;
  guestAccess?: boolean;
  defaultView?: ProjectDefaultView;
  defaultStatus?: string;
  completionAction?: TaskCompletionAction;
  allowClosedColumns?: boolean;
  allowInvite?: boolean;
  allowCreateTasks?: boolean;
  allowAttachments?: boolean;
  allowComments?: boolean;
  archived?: boolean;
  tags?: string[];
  category?: string;
  sourceIdeaId?: string;
  imageUrl?: string | null;
  imageScale?: number;
};

export function defaultProjectColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

export function defaultProjectKey(name: string): string {
  const letters = name.replace(/[^A-Za-z\u0600-\u06FF]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3).toUpperCase();
  const compact = name.replace(/\s+/g, "").slice(0, 3);
  return (compact || "PRJ").toUpperCase();
}

export function readProjectMeta(): Record<string, ProjectMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProjectMeta>) : {};
  } catch {
    return {};
  }
}

export function writeProjectMeta(id: string, patch: Partial<ProjectMeta>) {
  const all = readProjectMeta();
  const prev = all[id];
  const merged = { ...prev, ...patch };
  all[id] = {
    ...merged,
    description: merged.description ?? "",
    icon: merged.icon ?? "folder",
    color: merged.color ?? PROJECT_COLORS[0],
  };
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

export function getProjectMeta(id: string): ProjectMeta | undefined {
  return readProjectMeta()[id];
}
