import { Task } from "@/lib/supabase";
import { dateKey } from "@/lib/taskShape";

export const OVERDUE_COLOR = "#EF4444";
export const DONE_COLOR = "#22C55E";

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

export function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

export function taskCreated(task: Task): string {
  return dateKey(task.created_at) || dateKey(task.start_date) || ymd(new Date());
}

export function taskDue(task: Task): string | null {
  return dateKey(task.due_date);
}

export function overdueDays(task: Task, today: string): number {
  const due = taskDue(task);
  if (task.is_done || !due || due >= today) return 0;
  return Math.max(diffDays(toDate(due), toDate(today)), 0);
}

export function inclusiveDays(startIso: string, endIso: string): number {
  return Math.max(diffDays(toDate(startIso), toDate(endIso)) + 1, 1);
}

export function elapsedDays(created: string, plannedEnd: string, today: string, isDone: boolean): number {
  if (!isDone && today < created) return 0;
  const fillUntil = isDone || today >= plannedEnd ? plannedEnd : today;
  return Math.min(inclusiveDays(created, fillUntil), inclusiveDays(created, plannedEnd));
}

export function remainingLabel(task: Task, today: string, t: (key: string) => string): string {
  if (task.is_done) return t("timeline.completed");
  const late = overdueDays(task, today);
  if (late > 0) return late === 1 ? t("timeline.overdue1") : t("timeline.overdueN").replace("{n}", String(late));
  const due = taskDue(task);
  if (!due) return t("board.noDueDate");
  const left = diffDays(toDate(today), toDate(due));
  if (left <= 0) return t("projects.dueToday");
  if (left === 1) return t("projects.dueIn1");
  return t("projects.dueInN").replace("{n}", String(left));
}

export function taskProgress(task: Task, today: string) {
  const created = taskCreated(task);
  const due = taskDue(task);
  const plannedEnd = due || (task.is_done ? dateKey(task.completed_at) || created : today);
  const plannedStart = minIso(created, plannedEnd);
  const plannedStop = maxIso(created, plannedEnd);
  const planned = inclusiveDays(plannedStart, plannedStop);
  const filled = elapsedDays(plannedStart, plannedStop, today, task.is_done);
  const pct = Math.round((filled / planned) * 100);
  return { created, due, planned, filled, pct };
}
