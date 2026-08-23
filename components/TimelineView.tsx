"use client";

import { useMemo, useRef, useState } from "react";
import { supabase, Task, BoardColumn } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { dateKey } from "@/lib/taskShape";

const DAY_WIDTH = 34;
const ROW_HEIGHT = 44;

function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export default function TimelineView({
  tasks,
  columns,
  onTasksMutated,
}: {
  tasks: Task[];
  columns: BoardColumn[];
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const datedTasks = tasks.filter((t2) => dateKey(t2.start_date) || dateKey(t2.due_date));

  const { rangeStart, totalDays, months } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let min = today;
    let max = addDays(today, 30);
    for (const task of datedTasks) {
      const start = dateKey(task.start_date);
      const due = dateKey(task.due_date);
      const s = start ? toDate(start) : due ? toDate(due) : null;
      const e = due ? toDate(due) : start ? toDate(start) : null;
      if (s && s < min) min = s;
      if (e && e > max) max = e;
    }
    min = addDays(min, -4);
    max = addDays(max, 10);
    const total = Math.max(diffDays(min, max), 30);

    const monthGroups: { label: string; days: number }[] = [];
    let cursor = new Date(min);
    for (let i = 0; i < total; ) {
      const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
      const daysInThisMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() - cursor.getDate() + 1;
      const span = Math.min(daysInThisMonth, total - i);
      monthGroups.push({ label, days: span });
      cursor = addDays(cursor, span);
      i += span;
    }

    return { rangeStart: min, totalDays: total, months: monthGroups };
  }, [datedTasks, locale]);

  const todayOffset = diffDays(rangeStart, new Date(new Date().toDateString()));

  const rows = columns.map((col) => ({
    column: col,
    items: datedTasks.filter((t2) => t2.column_id === col.id),
  }));
  const uncategorized = datedTasks.filter((t2) => !t2.column_id || !columns.some((c) => c.id === t2.column_id));

  async function saveDates(task: Task, startDate: string | null, dueDate: string | null) {
    onTasksMutated((prev) =>
      prev.map((t2) => (t2.id === task.id ? { ...t2, start_date: startDate, due_date: dueDate } : t2))
    );
    await supabase.from("tasks").update({ start_date: startDate, due_date: dueDate }).eq("id", task.id);
    setEditingTask(null);
  }

  if (datedTasks.length === 0) {
    return <p className="text-sm text-inkFaint text-center py-10">{t("board.noTasksWithDates")}</p>;
  }

  const gridWidth = totalDays * DAY_WIDTH;

  function renderRow(column: BoardColumn, items: Task[]) {
    return (
      <div key={column.id} className="flex border-b border-line">
        <div className="w-40 shrink-0 sticky start-0 bg-surface z-10 flex items-center gap-1.5 px-2.5 py-2 border-e border-line">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
          <span className="text-xs font-medium text-ink truncate">{column.name}</span>
          <span className="text-[10px] text-inkFaint">{items.length}</span>
        </div>
        <div className="relative" style={{ width: gridWidth, minHeight: ROW_HEIGHT * Math.max(items.length, 1) }}>
          {items.map((task, i) => {
            const startIso = dateKey(task.start_date) || dateKey(task.due_date);
            const start = startIso ? toDate(startIso) : rangeStart;
            const dueIso = dateKey(task.due_date);
            const end = dueIso ? toDate(dueIso) : start;
            const offset = Math.max(diffDays(rangeStart, start), 0);
            const span = Math.max(diffDays(start, end) + 1, 1);
            return (
              <button
                key={task.id}
                onClick={() => setEditingTask(task)}
                className="absolute rounded-md px-2 py-1.5 text-start text-[11px] font-medium text-white truncate hover:opacity-90 transition-opacity shadow-sm"
                style={{
                  insetInlineStart: offset * DAY_WIDTH + 2,
                  width: span * DAY_WIDTH - 4,
                  top: i * ROW_HEIGHT + 6,
                  backgroundColor: task.color || column.color,
                  opacity: task.is_done ? 0.55 : 1,
                }}
                title={task.title}
              >
                {task.title}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto border border-line rounded-lg thin-scroll">
        <div style={{ width: 160 + gridWidth }}>
          <div className="flex border-b border-line bg-paperDark">
            <div className="w-40 shrink-0 sticky start-0 bg-paperDark z-10 border-e border-line" />
            {months.map((m, i) => (
              <div
                key={i}
                className="shrink-0 px-2 py-1.5 text-2xs font-medium text-inkSoft border-e border-line"
                style={{ width: m.days * DAY_WIDTH }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div className="relative">
            {todayOffset >= 0 && todayOffset < totalDays && (
              <div
                className="absolute top-0 bottom-0 w-px bg-teal z-20 pointer-events-none"
                style={{ insetInlineStart: 160 + todayOffset * DAY_WIDTH }}
              />
            )}
            {rows.filter((r) => r.items.length > 0).map((r) => renderRow(r.column, r.items))}
            {uncategorized.length > 0 &&
              renderRow({ id: "uncategorized", name: t("tasks.noColumn"), color: "#6b7280" } as BoardColumn, uncategorized)}
          </div>
        </div>
      </div>

      {editingTask && (
        <Modal onClose={() => setEditingTask(null)} maxWidth="max-w-xs">
          <h3 className="font-display text-base font-medium mb-4 truncate">{editingTask.title}</h3>
          <TimelineDateEditor task={editingTask} onSave={saveDates} onCancel={() => setEditingTask(null)} t={t} />
        </Modal>
      )}
    </div>
  );
}

function TimelineDateEditor({
  task,
  onSave,
  onCancel,
  t,
}: {
  task: Task;
  onSave: (task: Task, start: string | null, due: string | null) => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const [start, setStart] = useState(dateKey(task.start_date) || "");
  const [due, setDue] = useState(dateKey(task.due_date) || "");

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-inkSoft mb-1">{t("board.startDate")}</label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full bg-paperDark border-0 rounded-[1.75rem] px-3 py-2 text-sm text-ink outline-none focus:outline-none focus:ring-0"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-inkSoft mb-1">{t("board.dueDate")}</label>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="w-full bg-paperDark border-0 rounded-[1.75rem] px-3 py-2 text-sm text-ink outline-none focus:outline-none focus:ring-0"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" fullWidth onClick={() => onSave(task, start || null, due || null)}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
