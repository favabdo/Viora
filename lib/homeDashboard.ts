import type { BoardColumn, Task } from "@/lib/supabase";

export type StatusKind = "todo" | "progress" | "review" | "done";
export type PriorityKind = "high" | "medium" | "low";

export function localYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

export function rangeKeys(days: number, end = startOfDay(new Date())): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(localYmd(addDays(end, -i)));
  return keys;
}

export function keysBetween(fromYmd: string, toYmd: string): string[] {
  let from = startOfDay(new Date(`${fromYmd}T00:00:00`));
  let to = startOfDay(new Date(`${toYmd}T00:00:00`));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [localYmd(new Date())];
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const keys: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to && keys.length < 366) {
    keys.push(localYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.length ? keys : [fromYmd];
}

export function windowFromKeys(keys: string[]): { from: Date; to: Date; days: number } {
  const from = startOfDay(new Date(`${keys[0]}T00:00:00`));
  const last = startOfDay(new Date(`${keys[keys.length - 1]}T00:00:00`));
  return { from, to: addDays(last, 1), days: keys.length };
}

export function taskTouchesRange(task: Task, from: Date, to: Date): boolean {
  return inWindow(task.created_at, from, to) || inWindow(task.completed_at, from, to) || inWindow(task.due_date, from, to);
}

export function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const iso = value.length <= 10 ? `${value}T00:00:00` : value;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function inWindow(value: string | null | undefined, from: Date, to: Date): boolean {
  const t = parseTime(value);
  if (t == null) return false;
  return t >= from.getTime() && t < to.getTime();
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export function countsForDays(values: (string | null | undefined)[], days: string[]): number[] {
  const map: Record<string, number> = {};
  for (const key of days) map[key] = 0;
  for (const value of values) {
    if (!value) continue;
    const key = value.slice(0, 10);
    if (key in map) map[key] += 1;
  }
  return days.map((key) => map[key]);
}

export function statusKind(task: Task, columnsById: Map<string, BoardColumn>): StatusKind {
  if (task.is_done) return "done";
  const column = task.column_id ? columnsById.get(task.column_id) : undefined;
  if (column?.is_done_column) return "done";
  const name = (column?.name || "").toLowerCase();
  if (/review|مراجع/.test(name)) return "review";
  if (/progress|doing|جاري|تنفيذ|شغل/.test(name)) return "progress";
  return "todo";
}

export function priorityOf(task: Task): PriorityKind {
  const color = (task.color || "").toLowerCase();
  if (["#ef4444", "#dc2626", "#e11d48", "#f43f5e", "#b91c1c"].includes(color)) return "high";
  if (["#f97316", "#ea580c", "#eab308", "#f59e0b", "#facc15"].includes(color)) return "medium";
  return "low";
}

export function dueLabel(due: string | null | undefined, today: string, t: (key: string) => string, locale: string): string {
  if (!due) return t("board.noDueDate");
  if (due === today) return t("home.today");
  const tomorrow = localYmd(addDays(startOfDay(new Date()), 1));
  if (due === tomorrow) return t("home.tomorrow");
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${due}T00:00:00`));
  } catch {
    return due;
  }
}
