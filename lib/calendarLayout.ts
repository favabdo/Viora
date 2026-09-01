import type { Task } from "@/lib/supabase";
import { dateKey } from "@/lib/taskShape";

export type WeekLane = {
  task: Task;
  colStart: number;
  colEnd: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

const BAR_COLORS = ["#6C5CE7", "#3B82F6", "#22C55E", "#F59E0B", "#14B8A6", "#EC4899", "#C4A574", "#8B5CF6"];

export function taskBarColor(task: Task): string {
  if (task.is_done) return "#22C55E";
  if (task.color) return task.color;
  let hash = 0;
  for (let i = 0; i < task.id.length; i++) hash = (hash * 31 + task.id.charCodeAt(i)) | 0;
  return BAR_COLORS[Math.abs(hash) % BAR_COLORS.length];
}

/** من يوم الإنشاء ليوم التسليم (أو يوم الإنشاء فقط لو مفيش تسليم) */
export function taskDateSpan(task: Task): { start: string; end: string } | null {
  const created = dateKey(task.created_at) || dateKey(task.start_date);
  const due = dateKey(task.due_date);
  if (!created && !due) return null;
  const start = created || due!;
  const end = due && due > start ? due : start;
  return { start, end };
}

export function spanCoversDay(task: Task, dayKey: string): boolean {
  const span = taskDateSpan(task);
  if (!span) return false;
  return dayKey >= span.start && dayKey <= span.end;
}

export function layoutWeekLanes(weekKeys: string[], tasks: Task[]): { items: WeekLane[]; laneCount: number } {
  if (weekKeys.length === 0) return { items: [], laneCount: 0 };
  const weekStart = weekKeys[0];
  const weekEnd = weekKeys[weekKeys.length - 1];
  const raw: Omit<WeekLane, "lane">[] = [];

  for (const task of tasks) {
    const span = taskDateSpan(task);
    if (!span) continue;
    if (span.end < weekStart || span.start > weekEnd) continue;
    const startIdx = weekKeys.findIndex((key) => key >= span.start);
    let endIdx = -1;
    for (let i = weekKeys.length - 1; i >= 0; i--) {
      if (weekKeys[i] <= span.end) {
        endIdx = i;
        break;
      }
    }
    if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) continue;
    raw.push({
      task,
      colStart: startIdx,
      colEnd: endIdx,
      continuesBefore: span.start < weekStart,
      continuesAfter: span.end > weekEnd,
    });
  }

  raw.sort((a, b) => a.colStart - b.colStart || b.colEnd - b.colStart - (a.colEnd - a.colStart) || a.task.id.localeCompare(b.task.id));

  const laneEnds: number[] = [];
  const items: WeekLane[] = [];
  for (const item of raw) {
    let lane = laneEnds.findIndex((end) => end < item.colStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.colEnd);
    } else {
      laneEnds[lane] = item.colEnd;
    }
    items.push({ ...item, lane });
  }

  return { items, laneCount: laneEnds.length };
}
