"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase, Task, BoardColumn } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { dateKey, formatTaskDate, isDueAfterCreated, minDueDate } from "@/lib/taskShape";

const DAY_WIDTH = 34;
const ROW_HEIGHT = 44;
const OVERDUE_COLOR = "#EF4444";

function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}
function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function inclusiveDays(startIso: string, endIso: string): number {
  return Math.max(diffDays(toDate(startIso), toDate(endIso)) + 1, 1);
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
  const [hover, setHover] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const todayIso = ymd(new Date());

  const datedTasks = tasks.filter((t2) => {
    if (!dateKey(t2.start_date) && !dateKey(t2.due_date) && !dateKey(t2.created_at)) return false;
    if (showCompleted) return true;
    if (t2.is_done) return false;
    const column = columns.find((col) => col.id === t2.column_id);
    return !column?.is_done_column;
  });

  const { rangeStart, totalDays, months } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let min = today;
    let max = addDays(today, 30);
    for (const task of datedTasks) {
      const created = dateKey(task.created_at);
      const start = dateKey(task.start_date) || created;
      const due = dateKey(task.due_date);
      const s = start ? toDate(start) : due ? toDate(due) : null;
      const e = due ? toDate(due) : start ? toDate(start) : null;
      if (s && s < min) min = s;
      if (e && e > max) max = e;
      if (due && due < todayIso && !task.is_done && today > max) max = today;
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
  }, [datedTasks, locale, todayIso]);

  const todayOffset = diffDays(rangeStart, new Date(new Date().toDateString()));

  const rows = columns.map((col) => ({
    column: col,
    items: datedTasks.filter((t2) => t2.column_id === col.id),
  }));
  const uncategorized = datedTasks.filter((t2) => !t2.column_id || !columns.some((c) => c.id === t2.column_id));

  async function saveDates(task: Task, startDate: string | null, dueDate: string | null) {
    if (dueDate && !isDueAfterCreated(task.created_at, dueDate)) return;
    onTasksMutated((prev) =>
      prev.map((t2) => (t2.id === task.id ? { ...t2, start_date: startDate, due_date: dueDate } : t2))
    );
    await supabase.from("tasks").update({ start_date: startDate, due_date: dueDate }).eq("id", task.id);
    setEditingTask(null);
  }

  if (datedTasks.length === 0) {
    return (
      <div>
        <CompletedToggle showCompleted={showCompleted} onToggle={() => setShowCompleted((v) => !v)} t={t} />
        <p className="text-sm text-inkFaint text-center py-10">{t("board.noTasksWithDates")}</p>
      </div>
    );
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
            const createdIso = dateKey(task.created_at) || dateKey(task.start_date) || todayIso;
            const dueIso = dateKey(task.due_date);
            const plannedEnd = dueIso || (task.is_done ? dateKey(task.completed_at) || createdIso : todayIso);
            const startIso = createdIso < plannedEnd ? createdIso : plannedEnd;
            const stopIso = createdIso > plannedEnd ? createdIso : plannedEnd;
            const start = toDate(startIso);
            const late = !task.is_done && dueIso && dueIso < todayIso ? Math.max(diffDays(toDate(dueIso), toDate(todayIso)), 0) : 0;
            const offset = Math.max(diffDays(rangeStart, start), 0);
            const plannedSpan = inclusiveDays(startIso, stopIso);
            const filledSpan =
              task.is_done || todayIso >= stopIso
                ? plannedSpan
                : todayIso < startIso
                  ? 0
                  : inclusiveDays(startIso, todayIso);
            const remainingSpan = Math.max(plannedSpan - filledSpan, 0);
            const color = task.is_done ? "#22C55E" : task.color || column.color;
            const barWidth = plannedSpan * DAY_WIDTH + late * DAY_WIDTH - 4;

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => setEditingTask(task)}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({
                    task,
                    x: Math.min(Math.max(r.left + r.width / 2, 180), window.innerWidth - 180),
                    y: r.top,
                  });
                }}
                onMouseLeave={() => setHover((h) => (h?.task.id === task.id ? null : h))}
                className="absolute flex overflow-hidden rounded-md text-start shadow-sm hover:brightness-110"
                style={{
                  insetInlineStart: offset * DAY_WIDTH + 2,
                  width: Math.max(barWidth, 8),
                  height: 32,
                  top: i * ROW_HEIGHT + 6,
                  opacity: task.is_done ? 0.85 : 1,
                }}
              >
                <span className="relative h-full shrink-0" style={{ width: filledSpan * DAY_WIDTH, backgroundColor: color }}>
                  {filledSpan * DAY_WIDTH >= 56 && (
                    <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white truncate">
                      {task.title}
                    </span>
                  )}
                </span>
                {remainingSpan > 0 && (
                  <span
                    className="relative h-full shrink-0 overflow-hidden"
                    style={{ width: remainingSpan * DAY_WIDTH, backgroundColor: color, opacity: 0.38 }}
                  >
                    <span className="timeline-load-track absolute inset-0" />
                  </span>
                )}
                {late > 0 && (
                  <span
                    className="timeline-load-track h-full shrink-0"
                    style={{ width: late * DAY_WIDTH, backgroundColor: OVERDUE_COLOR }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <CompletedToggle showCompleted={showCompleted} onToggle={() => setShowCompleted((v) => !v)} t={t} />
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

      {hover && (
        <TimelineTaskTip
          task={hover.task}
          x={hover.x}
          y={hover.y}
          locale={locale}
          todayIso={todayIso}
          t={t}
        />
      )}

      {editingTask && (
        <Modal onClose={() => setEditingTask(null)} maxWidth="max-w-xs">
          <h3 className="font-display text-base font-medium mb-4 truncate">{editingTask.title}</h3>
          <TimelineDateEditor task={editingTask} onSave={saveDates} onCancel={() => setEditingTask(null)} t={t} />
        </Modal>
      )}
    </div>
  );
}

function CompletedToggle({
  showCompleted,
  onToggle,
  t,
}: {
  showCompleted: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex justify-end mb-3">
      <label className="inline-flex items-center gap-2 text-xs text-inkSoft">
        <span>{t("calendar.showCompleted")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={showCompleted}
          onClick={onToggle}
          className={`relative h-5 w-9 rounded-full ${showCompleted ? "bg-[#6C5CE7]" : "bg-lineStrong"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${showCompleted ? "start-4" : "start-0.5"}`} />
        </button>
      </label>
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
  const [dueError, setDueError] = useState(false);
  const dueMin = minDueDate(task.created_at);

  function trySave() {
    const nextDue = due || null;
    if (nextDue && !isDueAfterCreated(task.created_at, nextDue)) {
      setDueError(true);
      return;
    }
    onSave(task, start || null, nextDue);
  }

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
          min={dueMin}
          type="date"
          value={due}
          onChange={(e) => {
            setDue(e.target.value);
            setDueError(Boolean(e.target.value && !isDueAfterCreated(task.created_at, e.target.value)));
          }}
          className="w-full bg-paperDark border-0 rounded-[1.75rem] px-3 py-2 text-sm text-ink outline-none focus:outline-none focus:ring-0"
        />
      </div>
      {dueError && <p className="text-xs text-red-500">{t("board.dueAfterCreated")}</p>}
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" fullWidth onClick={trySave}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function TimelineTaskTip({
  task,
  x,
  y,
  locale,
  todayIso,
  t,
}: {
  task: Task;
  x: number;
  y: number;
  locale: string;
  todayIso: string;
  t: (key: string) => string;
}) {
  const created = dateKey(task.created_at) || dateKey(task.start_date) || todayIso;
  const due = dateKey(task.due_date);
  const late = !task.is_done && due && due < todayIso ? Math.max(diffDays(toDate(due), toDate(todayIso)), 0) : 0;
  const left = due ? diffDays(toDate(todayIso), toDate(due)) : null;
  const remaining = task.is_done
    ? t("timeline.completed")
    : late > 0
      ? late === 1
        ? t("timeline.overdue1")
        : t("timeline.overdueN").replace("{n}", String(late))
      : !due
        ? t("board.noDueDate")
        : left !== null && left <= 0
          ? t("projects.dueToday")
          : left === 1
            ? t("projects.dueIn1")
            : t("projects.dueInN").replace("{n}", String(left));
  const plannedEnd = due && due > created ? due : due || todayIso;
  const stop = plannedEnd < created ? created : plannedEnd;
  const planned = inclusiveDays(created, stop);
  const filled =
    task.is_done || todayIso >= stop ? planned : todayIso < created ? 0 : inclusiveDays(created, todayIso);
  const below = y < 220;

  return createPortal(
    <div
      className={`pointer-events-none fixed z-[80] w-[260px] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 shadow-lg fade-in ${below ? "" : "-translate-y-full"}`}
      style={{ left: x, top: below ? y + 38 : Math.max(y - 12, 16) }}
      role="tooltip"
    >
      <p className="text-sm font-medium text-ink">{task.title}</p>
      <dl className="mt-2 space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("taskDetail.created")}</dt>
          <dd className="text-ink">{formatTaskDate(created, locale)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("taskDetail.due")}</dt>
          <dd className="text-ink">{due ? formatTaskDate(due, locale) : t("board.noDueDate")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("timeline.timeLeft")}</dt>
          <dd className={late > 0 ? "text-red-500 font-medium" : "text-ink"}>{remaining}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-inkFaint">
        {t("timeline.daysProgress").replace("{done}", String(Math.min(filled, planned))).replace("{total}", String(planned))}
      </p>
    </div>,
    document.body
  );
}
