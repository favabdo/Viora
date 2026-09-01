"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Check, Minus, Filter, MoreHorizontal, ArrowDown, X } from "lucide-react";
import { supabase, Project, Task } from "@/lib/supabase";
import { dateKey, formatTaskDate, normalizeTask } from "@/lib/taskShape";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import DonutChart from "./ui/DonutChart";
import { Textarea } from "./ui/Input";

const LABEL_WIDTH = 260;
const ROW_HEIGHT = 48;
const MIN_BAR_PX = 140;
const BAR_COLORS = ["#6C5CE7", "#22C55E", "#3B82F6", "#C4A574", "#F59E0B", "#14B8A6", "#EC4899"];
const OVERDUE_COLOR = "#EF4444";
const DONE_COLOR = "#22C55E";

function scaleBar(
  plannedDays: number,
  overdueDaysCount: number,
  filledDays: number,
  remainingDays: number,
  dayWidth: number
) {
  const plannedPx = Math.max(plannedDays, 1) * dayWidth;
  const overduePx = Math.max(overdueDaysCount, 0) * dayWidth;
  const raw = plannedPx + overduePx;
  const total = Math.max(MIN_BAR_PX, raw - 8);
  const k = total / Math.max(raw, 1);
  return {
    filledWidth: Math.max(filledDays, 0) * dayWidth * k,
    remainingWidth: Math.max(remainingDays, 0) * dayWidth * k,
    overdueWidth: overduePx * k,
    total,
  };
}

function barColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return BAR_COLORS[Math.abs(hash) % BAR_COLORS.length];
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(date: Date, n: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

/** يوم إنشاء المهمة — بداية البابل على التايم لاين */
function taskCreated(task: Task): string {
  return dateKey(task.created_at) || dateKey(task.start_date) || ymd(new Date());
}

function taskDue(task: Task): string | null {
  return dateKey(task.due_date);
}

function overdueDays(task: Task, today: string): number {
  const due = taskDue(task);
  if (task.is_done || !due || due >= today) return 0;
  return Math.max(diffDays(toDate(due), toDate(today)), 0);
}

function inclusiveDays(startIso: string, endIso: string): number {
  return Math.max(diffDays(toDate(startIso), toDate(endIso)) + 1, 1);
}

/** أيام اتلوّنت من الإنشاء لحد النهاردة (أو التسليم لو خلص المدى) */
function elapsedDays(created: string, plannedEnd: string, today: string, isDone: boolean): number {
  if (!isDone && today < created) return 0;
  const fillUntil = isDone || today >= plannedEnd ? plannedEnd : today;
  return Math.min(inclusiveDays(created, fillUntil), inclusiveDays(created, plannedEnd));
}

export default function ProjectTimelineView({
  project,
  tasks: projectTasks,
  currentUserId,
  onTasksMutated,
}: {
  project: Project;
  tasks: Task[];
  currentUserId: string;
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [dayWidth, setDayWidth] = useState(16);
  const [hover, setHover] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = ymd(new Date());
  const todayDate = toDate(today);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of projectTasks) {
      const name = (task.profiles?.full_name || task.profiles?.username || "").trim();
      if (task.user_id && name) map.set(task.user_id, name);
    }
    return Array.from(map.entries());
  }, [projectTasks]);

  const visible = useMemo(() => {
    return projectTasks.filter((task) => {
      if (assigneeFilter !== "all" && task.user_id !== assigneeFilter) return false;
      if (!showCompleted && task.is_done) return false;
      if (priorityFilter === "high" && task.color !== "#ef4444") return false;
      if (priorityFilter === "medium" && task.color !== "#f97316") return false;
      if (priorityFilter === "low" && task.color && task.color !== "#3b82f6" && task.color !== "#22c55e") return false;
      return true;
    });
  }, [projectTasks, assigneeFilter, priorityFilter, showCompleted]);

  const { rangeStart, totalDays, months } = useMemo(() => {
    let min = addDays(todayDate, -14);
    let max = addDays(todayDate, 21);
    for (const task of visible) {
      const created = toDate(taskCreated(task));
      const due = taskDue(task);
      const late = overdueDays(task, today);
      if (created < min) min = created;
      if (due) {
        const dueDate = toDate(due);
        if (dueDate > max) max = dueDate;
      }
      if (late > 0 && todayDate > max) max = todayDate;
      if (!due && !task.is_done && todayDate > max) max = todayDate;
    }
    const total = Math.max(diffDays(min, max) + 1, 30);
    const monthGroups: { label: string; days: number }[] = [];
    let cursor = new Date(min);
    for (let i = 0; i < total; ) {
      const label = new Intl.DateTimeFormat(locale, { month: "long" }).format(cursor);
      const leftInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() - cursor.getDate() + 1;
      const span = Math.min(leftInMonth, total - i);
      monthGroups.push({ label, days: span });
      cursor = addDays(cursor, span);
      i += span;
    }
    return { rangeStart: min, totalDays: total, months: monthGroups };
  }, [visible, locale, todayDate, today]);

  const todayOffset = diffDays(rangeStart, todayDate);
  const gridWidth = totalDays * dayWidth;

  const overview = useMemo(() => {
    const done = visible.filter((task) => task.is_done).length;
    const overdue = visible.filter((task) => overdueDays(task, today) > 0).length;
    const remaining = visible.length - done;
    const inProgress = Math.max(remaining - overdue, 0);
    return [
      { label: t("timeline.completed"), color: "#22C55E", count: done },
      { label: t("timeline.inProgress"), color: "#3B82F6", count: inProgress },
      { label: t("list.overdue"), color: OVERDUE_COLOR, count: overdue },
    ];
  }, [visible, today, t]);

  const critical = visible
    .filter((task) => taskDue(task) && !task.is_done)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 4);

  function overdueLabel(days: number): string {
    if (days === 1) return t("timeline.overdue1");
    return t("timeline.overdueN").replace("{n}", String(days));
  }

  function remainingLabel(task: Task): string {
    if (task.is_done) return t("timeline.completed");
    const late = overdueDays(task, today);
    if (late > 0) return overdueLabel(late);
    const due = taskDue(task);
    if (!due) return t("board.noDueDate");
    const left = diffDays(todayDate, toDate(due));
    if (left <= 0) return t("projects.dueToday");
    if (left === 1) return t("projects.dueIn1");
    return t("projects.dueInN").replace("{n}", String(left));
  }

  const selectedTask = selectedId ? projectTasks.find((task) => task.id === selectedId) || null : null;

  function moveHover(task: Task, event: React.MouseEvent<HTMLElement>) {
    setHover({ task, x: event.clientX, y: event.clientY });
  }

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const hide = () => setHover(null);
    node.addEventListener("scroll", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      node.removeEventListener("scroll", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, project_id: project.id, position: 1000 })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (error || !data) return;
    const next = normalizeTask(data);
    onTasksMutated((prev) => [...prev, next]);
    setNewTitle("");
    setAdding(false);
  }

  function goToday() {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ left: Math.max(todayOffset * dayWidth - 240, 0), behavior: "smooth" });
  }

  const selectClass = "w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0";

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-center justify-end gap-1.5 mb-3">
          <button
            onClick={goToday}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-inkSoft hover:text-ink"
          >
            {t("board.today")}
          </button>
          <div className="flex rounded-lg border border-line overflow-hidden">
            <button
              onClick={() => setDayWidth((w) => Math.max(10, w - 3))}
              className="h-8 w-8 inline-flex items-center justify-center text-inkSoft hover:bg-paperDark"
              aria-label="-"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => setDayWidth((w) => Math.min(28, w + 3))}
              className="h-8 w-8 inline-flex items-center justify-center text-inkSoft hover:bg-paperDark border-s border-line"
              aria-label="+"
            >
              <Plus size={13} />
            </button>
          </div>
          <button className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft">
            {t("timeline.months")}
            <ChevronDown size={12} />
          </button>
          <button
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft"
          >
            <Filter size={13} />
            {t("list.filter")}
          </button>
          <button className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink">
            <MoreHorizontal size={15} />
          </button>
        </div>

        <div ref={scrollRef} className="overflow-auto rounded-xl border border-line bg-surface thin-scroll max-h-[70vh]">
          <div style={{ minWidth: LABEL_WIDTH + gridWidth }}>
            <div className="flex border-b border-line bg-surface sticky top-0 z-20">
              <div className="shrink-0 border-e border-line px-3 py-3 text-xs text-inkFaint" style={{ width: LABEL_WIDTH }}>
                {t("list.col.task")}
              </div>
              <div>
                <div className="flex">
                  {months.map((month) => (
                    <div
                      key={month.label + String(month.days)}
                      className="shrink-0 px-2 py-1.5 text-[11px] font-medium text-inkSoft border-e border-line capitalize"
                      style={{ width: month.days * dayWidth }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>
                <div className="flex border-t border-line">
                  {Array.from({ length: totalDays }, (_, i) => {
                    const day = addDays(rangeStart, i);
                    const show = [1, 8, 15, 22, 29].includes(day.getDate());
                    return (
                      <div
                        key={i}
                        className="shrink-0 text-[10px] text-inkFaint text-center py-1 border-e border-line/60"
                        style={{ width: dayWidth }}
                      >
                        {show ? day.getDate() : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative">
              {Array.from({ length: totalDays }, (_, i) =>
                [1, 8, 15, 22, 29].includes(addDays(rangeStart, i).getDate()) ? (
                  <div
                    key={`grid-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-line/70 pointer-events-none"
                    style={{ insetInlineStart: LABEL_WIDTH + i * dayWidth }}
                  />
                ) : null
              )}

              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ insetInlineStart: LABEL_WIDTH + todayOffset * dayWidth }}
                >
                  <div className="absolute -top-0 -translate-x-1/2 rounded-md bg-[#6C5CE7] px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap">
                    {formatTaskDate(today, locale)}
                  </div>
                  <div className="h-full w-px bg-[#6C5CE7]" />
                </div>
              )}

              {visible.map((task) => {
                const created = taskCreated(task);
                const due = taskDue(task);
                const late = overdueDays(task, today);
                const plannedEnd = due || (task.is_done ? dateKey(task.completed_at) || created : today);
                const plannedStart = minIso(created, plannedEnd);
                const plannedStop = maxIso(created, plannedEnd);
                const offset = Math.max(diffDays(rangeStart, toDate(plannedStart)), 0);
                const plannedSpan = inclusiveDays(plannedStart, plannedStop);
                const filledSpan = elapsedDays(plannedStart, plannedStop, today, task.is_done);
                const remainingSpan = Math.max(plannedSpan - filledSpan, 0);
                const colorBar = task.is_done ? DONE_COLOR : task.color || barColor(task.id);
                const { filledWidth, remainingWidth, overdueWidth, total: barWidth } = scaleBar(
                  plannedSpan,
                  late,
                  filledSpan,
                  remainingSpan,
                  dayWidth
                );
                const isSelected = selectedId === task.id;

                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center border-b cursor-pointer ${
                      isSelected ? "border-line bg-[#6C5CE7]/[0.06]" : "border-line/70 hover:bg-paperDark/60"
                    }`}
                    style={{ height: ROW_HEIGHT }}
                    onMouseEnter={(e) => moveHover(task, e)}
                    onMouseMove={(e) => moveHover(task, e)}
                    onMouseLeave={() => setHover((h) => (h?.task.id === task.id ? null : h))}
                    onClick={() => setSelectedId(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(task.id);
                      }
                    }}
                  >
                    <div
                      className={`shrink-0 sticky start-0 z-[5] px-3 flex items-center gap-2 border-e border-line ${
                        isSelected ? "bg-[#6C5CE7]/[0.06]" : "bg-surface"
                      }`}
                      style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: late > 0 ? OVERDUE_COLOR : colorBar }}
                      />
                      <span className="truncate text-[13px] text-ink">{task.title}</span>
                    </div>
                    <div className="relative" style={{ width: gridWidth, height: ROW_HEIGHT }}>
                      <div
                        className="absolute top-2.5 h-7 flex items-stretch overflow-hidden shadow-sm"
                        style={{
                          insetInlineStart: offset * dayWidth + 2,
                          width: barWidth,
                          borderRadius: 9999,
                          opacity: task.is_done ? 0.85 : 1,
                        }}
                      >
                        <div className="relative h-full shrink-0" style={{ width: filledWidth, backgroundColor: colorBar }} />
                        {remainingWidth > 0 && (
                          <div
                            className="relative h-full shrink-0 overflow-hidden"
                            style={{ width: remainingWidth, backgroundColor: colorBar, opacity: 0.38 }}
                          >
                            <div className="timeline-load-track absolute inset-0" />
                          </div>
                        )}
                        {late > 0 && (
                          <div
                            className="timeline-load-track flex h-full shrink-0 items-center justify-center px-1 text-[10px] font-semibold text-white truncate"
                            style={{ width: overdueWidth, backgroundColor: OVERDUE_COLOR }}
                          >
                            {overdueWidth >= 72 ? overdueLabel(late) : `+${late}`}
                          </div>
                        )}
                        {barWidth >= 72 && (
                          <span className="pointer-events-none absolute inset-0 flex items-center ps-3 pe-2 text-[11px] font-medium text-white truncate">
                            {task.title}
                          </span>
                        )}
                      </div>
                      {late > 0 && overdueWidth < 72 && (
                        <span
                          className="absolute top-3 text-[10px] font-semibold whitespace-nowrap"
                          style={{ insetInlineStart: offset * dayWidth + barWidth + 8, color: OVERDUE_COLOR }}
                        >
                          {overdueLabel(late)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {adding ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-line">
                  <Textarea
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t("tasks.newTaskPlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addTask();
                      }
                      if (e.key === "Escape") setAdding(false);
                    }}
                    className="text-sm py-1.5 max-w-sm"
                  />
                  <button
                    onClick={addTask}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[#6C5CE7] text-white"
                    aria-label={t("tasks.add")}
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAdding(true);
                    setNewTitle("");
                  }}
                  className="flex items-center gap-1.5 px-8 py-2.5 text-xs text-inkFaint hover:text-[#6C5CE7] border-b border-line w-full text-start"
                >
                  <Plus size={13} />
                  {t("list.addTask")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full xl:w-[280px] shrink-0 space-y-4">
        {selectedTask ? (
          <TimelineTaskSidebar
            task={selectedTask}
            projectName={project.name}
            locale={locale}
            today={today}
            currentUserId={currentUserId}
            remaining={remainingLabel(selectedTask)}
            t={t}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <>
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-1">{t("list.filter")}</h3>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={selectClass}>
            <option value="all">{t("calendar.allAssignees")}</option>
            {assignees.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select defaultValue="all" className={selectClass}>
            <option value="all">{t("timeline.allLabels")}</option>
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectClass}>
            <option value="all">{t("calendar.allPriorities")}</option>
            <option value="high">{t("list.priority.high")}</option>
            <option value="medium">{t("list.priority.medium")}</option>
            <option value="low">{t("list.priority.low")}</option>
          </select>
          <label className="flex items-center justify-between gap-2 pt-1 text-xs text-inkSoft">
            <span>{t("calendar.showCompleted")}</span>
            <button
              role="switch"
              aria-checked={showCompleted}
              onClick={() => setShowCompleted((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${showCompleted ? "bg-[#6C5CE7]" : "bg-lineStrong"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${showCompleted ? "start-4" : "start-0.5"}`} />
            </button>
          </label>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("timeline.overview")}</h3>
          <div className="flex flex-col items-center">
            <DonutChart
              segments={overview.map((item) => ({ value: item.count, color: item.color }))}
              size={128}
              strokeWidth={15}
              centerLabel={String(visible.length)}
              centerSubLabel={t("board.tasksCount")}
            />
          </div>
          <ul className="mt-3 space-y-1.5">
            {overview.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-inkSoft">{item.label}</span>
                <span className="text-ink font-medium">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("timeline.criticalPath")}</h3>
          {critical.length === 0 ? (
            <p className="text-xs text-inkFaint">{t("board.noDeadlines")}</p>
          ) : (
            <div className="flex flex-col items-stretch">
              {critical.map((task, index) => {
                const late = overdueDays(task, today);
                return (
                  <div key={task.id}>
                    <div className="rounded-lg border border-line bg-paperDark px-2.5 py-2">
                      <p className="text-xs text-ink truncate">{task.title}</p>
                      <p className={`text-[11px] mt-0.5 ${late > 0 ? "text-red-500" : "text-inkFaint"}`}>
                        {late > 0
                          ? overdueLabel(late)
                          : `${formatTaskDate(taskCreated(task), locale)} – ${formatTaskDate(taskDue(task), locale)}`}
                      </p>
                    </div>
                    {index < critical.length - 1 && (
                      <div className="flex justify-center py-1 text-inkFaint">
                        <ArrowDown size={12} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </aside>

      {hover && (
        <TaskHoverCard
          task={hover.task}
          x={hover.x}
          y={hover.y}
          locale={locale}
          today={today}
          currentUserId={currentUserId}
          remaining={remainingLabel(hover.task)}
          t={t}
        />
      )}
    </div>
  );
}

function TaskHoverCard({
  task,
  x,
  y,
  locale,
  today,
  currentUserId,
  remaining,
  t,
}: {
  task: Task;
  x: number;
  y: number;
  locale: string;
  today: string;
  currentUserId: string;
  remaining: string;
  t: (key: string) => string;
}) {
  const created = taskCreated(task);
  const due = taskDue(task);
  const late = overdueDays(task, today);
  const plannedEnd = due || (task.is_done ? dateKey(task.completed_at) || created : today);
  const plannedStart = minIso(created, plannedEnd);
  const plannedStop = maxIso(created, plannedEnd);
  const planned = inclusiveDays(plannedStart, plannedStop);
  const filled = elapsedDays(plannedStart, plannedStop, today, task.is_done);
  const pct = Math.round((filled / planned) * 100);
  const assignee = task.profiles
    ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
    : t("timeline.unassigned");
  const status = task.is_done
    ? t("timeline.completed")
    : late > 0
      ? t("list.overdue")
      : t("timeline.inProgress");
  const cardW = 280;
  const cardH = 250;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let left = x + 14;
  let top = y + 16;
  if (left + cardW + 8 > vw) left = x - cardW - 14;
  if (top + cardH + 8 > vh) top = y - cardH - 8;
  left = Math.max(8, left);
  top = Math.max(8, top);

  return createPortal(
    <div
      className="pointer-events-none fixed z-[80] w-[280px] rounded-xl border border-line bg-surface p-3 shadow-lg"
      style={{ left, top }}
      role="tooltip"
    >
      <p className="text-sm font-medium text-ink leading-snug">{task.title}</p>
      <p className={`mt-1 text-[11px] font-medium ${late > 0 ? "text-red-500" : "text-inkSoft"}`}>{status}</p>
      <dl className="mt-2.5 space-y-1.5 text-[12px]">
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
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("list.col.assignee")}</dt>
          <dd className="text-ink truncate max-w-[150px]">{assignee}</dd>
        </div>
      </dl>
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[11px] text-inkFaint">
          <span>{t("projects.progress")}</span>
          <span>
            {t("timeline.daysProgress").replace("{done}", String(filled)).replace("{total}", String(planned))} · {pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-paperDark">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: late > 0 ? OVERDUE_COLOR : task.is_done ? DONE_COLOR : "#6C5CE7",
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function DetailRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="text-inkFaint shrink-0">{label}</span>
      <span className={`text-end ${danger ? "text-red-500 font-medium" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function TimelineTaskSidebar({
  task,
  projectName,
  locale,
  today,
  currentUserId,
  remaining,
  t,
  onClose,
}: {
  task: Task;
  projectName: string;
  locale: string;
  today: string;
  currentUserId: string;
  remaining: string;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const created = taskCreated(task);
  const due = taskDue(task);
  const start = dateKey(task.start_date);
  const completed = dateKey(task.completed_at);
  const late = overdueDays(task, today);
  const plannedEnd = due || (task.is_done ? completed || created : today);
  const plannedStart = minIso(created, plannedEnd);
  const plannedStop = maxIso(created, plannedEnd);
  const planned = inclusiveDays(plannedStart, plannedStop);
  const filled = elapsedDays(plannedStart, plannedStop, today, task.is_done);
  const pct = Math.round((filled / planned) * 100);
  const assignee = task.profiles
    ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
    : t("timeline.unassigned");
  const status = task.is_done
    ? t("timeline.completed")
    : late > 0
      ? t("list.overdue")
      : t("timeline.inProgress");
  const priorityLabel =
    task.color === "#ef4444"
      ? t("list.priority.high")
      : task.color === "#f97316"
        ? t("list.priority.medium")
        : task.color
          ? t("list.priority.low")
          : t("taskDetail.priority.none");

  return (
    <div className="rounded-xl border border-line bg-surface p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">{t("taskDetail.details")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-sm font-medium text-ink leading-snug">{task.title}</p>
      <p className={`text-[11px] font-medium ${late > 0 ? "text-red-500" : "text-inkSoft"}`}>{status}</p>
      <div className="space-y-1.5">
        <DetailRow label={t("taskDetail.project")} value={projectName} />
        <DetailRow label={t("taskDetail.created")} value={formatTaskDate(created, locale)} />
        {start && <DetailRow label={t("board.startDate")} value={formatTaskDate(start, locale)} />}
        <DetailRow label={t("taskDetail.due")} value={due ? formatTaskDate(due, locale) : t("board.noDueDate")} />
        {completed && <DetailRow label={t("timeline.completed")} value={formatTaskDate(completed, locale)} />}
        <DetailRow label={t("timeline.timeLeft")} value={remaining} danger={late > 0} />
        <DetailRow label={t("list.col.assignee")} value={assignee} />
        <DetailRow label={t("taskDetail.priority")} value={priorityLabel} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-inkFaint">
          <span>{t("projects.progress")}</span>
          <span>
            {t("timeline.daysProgress").replace("{done}", String(filled)).replace("{total}", String(planned))} · {pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-paperDark">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: late > 0 ? OVERDUE_COLOR : task.is_done ? DONE_COLOR : "#6C5CE7",
            }}
          />
        </div>
      </div>
      {task.profiles && (
        <div className="flex items-center gap-2 pt-1">
          <Avatar
            name={assignee}
            src={task.profiles.avatar_url}
            size="sm"
          />
          <span className="text-xs text-ink truncate">{assignee}</span>
        </div>
      )}
    </div>
  );
}
