import type { ProjectMember, Task } from "@/lib/supabase";

type ProfileBits = { username: string; full_name: string; avatar_url?: string | null };

export function normalizeProfile(value: unknown): ProfileBits | null {
  if (!value) return null;
  if (Array.isArray(value)) return normalizeProfile(value[0]);
  if (typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    username: typeof row.username === "string" ? row.username : "",
    full_name: typeof row.full_name === "string" ? row.full_name : "",
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
  };
}

export function dateKey(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const key = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

export function formatTaskDate(value: unknown, locale: string): string {
  const key = dateKey(value);
  if (!key) return "";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${key}T00:00:00`));
  } catch {
    return key;
  }
}

export function normalizeProjectMember(row: ProjectMember | Record<string, unknown>): ProjectMember {
  const data = row as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    project_id: String(data.project_id ?? ""),
    user_id: String(data.user_id ?? ""),
    status: data.status === "pending" ? "pending" : "accepted",
    invited_by: typeof data.invited_by === "string" ? data.invited_by : null,
    created_at: String(data.created_at ?? ""),
    profiles: normalizeProfile(data.profiles),
  };
}

export function normalizeTask(row: Task): Task {
  const profiles = normalizeProfile(row.profiles);
  return {
    ...row,
    due_date: dateKey(row.due_date),
    start_date: dateKey(row.start_date),
    position: typeof row.position === "number" && Number.isFinite(row.position) ? row.position : 0,
    profiles,
  };
}
