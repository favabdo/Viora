"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Check, Minus, Filter, MoreHorizontal, ArrowDown } from "lucide-react";
import { supabase, Project, Task } from "@/lib/supabase";
import { dateKey, formatTaskDate, normalizeTask } from "@/lib/taskShape";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import DonutChart from "./ui/DonutChart";
import { Textarea } from "./ui/Input";

const LABEL_WIDTH = 260;
const ROW_HEIGHT = 48;
/** أصغر بابل — يوم واحد يفضل مقروء من غير ما نضخّم باقي الأيام بنفس النسبة */
const MIN_BAR_PX = 140;
const BAR_COLORS = ["#6C5CE7", "#22C55E", "#3B82F6", "#C4A574", "#F59E0B", "#14B8A6", "#EC4899"];
const OVERDUE_COLOR = "#EF4444";

function barSegmentWidths(plannedDays: number, overdueDaysCount: number, dayWidth: number) {
  const plannedRaw = Math.max(plannedDays, 1) * dayWidth;
  const overdueRaw = Math.max(overdueDaysCount, 0) * dayWidth;
  const rawTotal = plannedRaw + overdueRaw;
  const displayTotal = Math.max(MIN_BAR_PX, rawTotal - 8);
  if (overdueDaysCount <= 0) {
    return { plannedWidth: displayTotal, overdueWidth: 0 };
  }
  const plannedWidth = (plannedRaw / rawTotal) * displayTotal;
  return { plannedWidth, overdueWidth: displayTotal - plannedWidth };
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
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft">
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
                const plannedSpan = Math.max(diffDays(toDate(plannedStart), toDate(plannedStop)) + 1, 1);
                const colorBar = task.color || barColor(task.id);
                const { plannedWidth, overdueWidth } = barSegmentWidths(plannedSpan, late, dayWidth);
                const dateText = due
                  ? `${formatTaskDate(created, locale)} – ${formatTaskDate(due, locale)}`
                  : formatTaskDate(created, locale);

                return (
                  <div key={task.id} className="flex items-center border-b border-line/70" style={{ height: ROW_HEIGHT }}>
                    <div
                      className="shrink-0 sticky start-0 z-[5] bg-surface px-3 flex items-center gap-2 border-e border-line"
                      style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: late > 0 ? OVERDUE_COLOR : task.is_done ? "#22C55E" : colorBar }}
                      />
                      <span className="truncate text-[13px] text-ink" title={task.title}>
                        {task.title}
                      </span>
                    </div>
                    <div className="relative" style={{ width: gridWidth, height: ROW_HEIGHT }}>
                      <div
                        className="absolute top-2.5 h-7 flex items-stretch overflow-hidden shadow-sm"
                        style={{
                          insetInlineStart: offset * dayWidth + 4,
                          width: plannedWidth + overdueWidth,
                          borderRadius: 9999,
                          opacity: task.is_done ? 0.7 : 1,
                        }}
                        title={late > 0 ? `${task.title} — ${overdueLabel(late)}` : task.title}
                      >
                        <div
                          className="flex min-w-0 items-center ps-3 pe-2 text-[11px] font-medium text-white"
                          style={{ width: plannedWidth, backgroundColor: colorBar }}
                        >
                          <span className="truncate flex-1">{dateText}</span>
                          {task.profiles && late === 0 && (
                            <Avatar
                              name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
                              src={task.profiles.avatar_url}
                              size="xs"
                              className="ms-2 ring-2 ring-black/20 shrink-0"
                            />
                          )}
                        </div>
                        {late > 0 && (
                          <div
                            className="flex items-center justify-center px-1.5 text-[10px] font-semibold text-white truncate"
                            style={{ width: overdueWidth, backgroundColor: OVERDUE_COLOR }}
                          >
                            {overdueWidth >= 88 ? overdueLabel(late) : `+${late}`}
                          </div>
                        )}
                      </div>
                      {late > 0 && overdueWidth < 88 && (
                        <span
                          className="absolute top-3 text-[10px] font-semibold whitespace-nowrap"
                          style={{ insetInlineStart: offset * dayWidth + plannedWidth + overdueWidth + 8, color: OVERDUE_COLOR }}
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
      </aside>
    </div>
  );
}
