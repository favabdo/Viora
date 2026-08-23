"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Plus,
  Check,
  Folder,
  Minus,
  Filter,
  MoreHorizontal,
  ArrowDown,
} from "lucide-react";
import { supabase, Project, Task } from "@/lib/supabase";
import { dateKey, formatTaskDate, normalizeTask } from "@/lib/taskShape";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import DonutChart from "./ui/DonutChart";
import { Input, Textarea } from "./ui/Input";

const LABEL_WIDTH = 260;
const ROW_HEIGHT = 48;
const BAR_COLORS = ["#6C5CE7", "#22C55E", "#3B82F6", "#C4A574", "#F59E0B", "#14B8A6", "#EC4899"];

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

function taskStart(task: Task): string {
  return dateKey(task.start_date) || dateKey(task.created_at) || ymd(new Date());
}

function taskEnd(task: Task): string {
  const due = dateKey(task.due_date);
  if (due) return due;
  return ymd(addDays(toDate(taskStart(task)), 14));
}

export default function ProjectTimelineView({
  project,
  projects,
  tasks: projectTasks,
  currentUserId,
  onTasksMutated,
}: {
  project: Project;
  projects: Project[];
  tasks: Task[];
  currentUserId: string;
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [allTasks, setAllTasks] = useState<Task[]>(projectTasks);
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [dayWidth, setDayWidth] = useState(16);

  useEffect(() => {
    if (projects.length === 0) return;
    supabase
      .from("tasks")
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .in(
        "project_id",
        projects.map((item) => item.id)
      )
      .then(({ data, error }) => {
        if (error || !data) return;
        setAllTasks(data.map(normalizeTask));
      });
  }, [projects]);

  useEffect(() => {
    setAllTasks((prev) => {
      const others = prev.filter((task) => task.project_id !== project.id);
      return [...others, ...projectTasks];
    });
  }, [projectTasks, project.id]);

  const today = ymd(new Date());
  const todayDate = toDate(today);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of allTasks) {
      const name = (task.profiles?.full_name || task.profiles?.username || "").trim();
      if (task.user_id && name) map.set(task.user_id, name);
    }
    return Array.from(map.entries());
  }, [allTasks]);

  const visible = useMemo(() => {
    return allTasks.filter((task) => {
      if (projectFilter !== "all" && task.project_id !== projectFilter) return false;
      if (assigneeFilter !== "all" && task.user_id !== assigneeFilter) return false;
      if (!showCompleted && task.is_done) return false;
      if (priorityFilter === "high" && task.color !== "#ef4444") return false;
      if (priorityFilter === "medium" && task.color !== "#f97316") return false;
      if (priorityFilter === "low" && task.color && task.color !== "#3b82f6" && task.color !== "#22c55e") return false;
      return true;
    });
  }, [allTasks, projectFilter, assigneeFilter, priorityFilter, showCompleted]);

  const groups = useMemo(() => {
    return projects
      .map((item) => ({
        project: item,
        tasks: visible.filter((task) => task.project_id === item.id),
      }))
      .filter((group) => group.tasks.length > 0 || group.project.id === project.id);
  }, [projects, visible, project.id]);

  const { rangeStart, totalDays, months } = useMemo(() => {
    let min = addDays(todayDate, -45);
    let max = addDays(todayDate, 60);
    for (const task of visible) {
      const start = toDate(taskStart(task));
      const end = toDate(taskEnd(task));
      if (start < min) min = start;
      if (end > max) max = end;
    }
    const total = Math.max(diffDays(min, max) + 1, 90);
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
  }, [visible, locale, todayDate]);

  const todayOffset = diffDays(rangeStart, todayDate);
  const gridWidth = totalDays * dayWidth;

  const countsByProject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of allTasks) map[task.project_id] = (map[task.project_id] ?? 0) + 1;
    return map;
  }, [allTasks]);

  const overview = useMemo(() => {
    const done = visible.filter((task) => task.is_done).length;
    const overdue = visible.filter((task) => !task.is_done && dateKey(task.due_date) && (dateKey(task.due_date) as string) < today).length;
    const remaining = visible.length - done;
    const inProgress = Math.ceil(remaining * 0.45);
    const todo = Math.max(remaining - inProgress - overdue, 0);
    return [
      { label: t("timeline.completed"), color: "#22C55E", count: done },
      { label: t("timeline.inProgress"), color: "#3B82F6", count: inProgress },
      { label: t("timeline.todo"), color: "#6C5CE7", count: todo },
      { label: t("list.overdue"), color: "#F59E0B", count: overdue },
    ];
  }, [visible, today, t]);

  const critical = visible
    .filter((task) => dateKey(task.due_date))
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 4);

  async function addTask(projectId: string) {
    const title = newTitle.trim();
    if (!title) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, project_id: projectId, position: 1000 })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (error || !data) return;
    const next = normalizeTask(data);
    setAllTasks((prev) => [...prev, next]);
    if (projectId === project.id) onTasksMutated((prev) => [...prev, next]);
    setNewTitle("");
    setAddingFor(null);
  }

  function goToday() {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ left: Math.max(todayOffset * dayWidth - 240, 0), behavior: "smooth" });
  }

  const selectClass = "w-full rounded-[1.75rem] border border-line bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:border-[#8C3AED] focus:ring-2 focus:ring-[#8C3AED]/20";

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

              {groups.map((group) => {
                const closed = collapsed[group.project.id];
                const color = barColor(group.project.id);
                return (
                  <div key={group.project.id}>
                    <button
                      onClick={() => setCollapsed((prev) => ({ ...prev, [group.project.id]: !prev[group.project.id] }))}
                      className="flex items-center gap-2 px-3 py-2.5 w-full text-start bg-surfaceSunken border-b border-line"
                    >
                      <ChevronDown size={14} className={`text-inkFaint ${closed ? "-rotate-90" : ""}`} />
                      <Folder size={14} style={{ color }} />
                      <span className="text-sm font-semibold text-ink">{group.project.name}</span>
                      <span className="text-xs text-inkFaint">{group.tasks.length}</span>
                    </button>

                    {!closed &&
                      group.tasks.map((task) => {
                        const start = taskStart(task);
                        const end = taskEnd(task);
                        const offset = Math.max(diffDays(rangeStart, toDate(start)), 0);
                        const span = Math.max(diffDays(toDate(start), toDate(end)) + 1, 3);
                        const colorBar = task.color || barColor(task.id);
                        return (
                          <div key={task.id} className="flex items-center border-b border-line/70" style={{ height: ROW_HEIGHT }}>
                            <div
                              className="shrink-0 sticky start-0 z-[5] bg-surface px-3 flex items-center gap-2 border-e border-line"
                              style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: task.is_done ? "#22C55E" : colorBar }}
                              />
                              <span className="truncate text-[13px] text-ink" title={task.title}>
                                {task.title}
                              </span>
                            </div>
                            <div className="relative" style={{ width: gridWidth, height: ROW_HEIGHT }}>
                              <div
                                className="absolute top-2.5 h-7 rounded-full flex items-center ps-3 pe-1 text-[11px] font-medium text-white shadow-sm"
                                style={{
                                  insetInlineStart: offset * dayWidth + 4,
                                  width: Math.max(span * dayWidth - 8, 72),
                                  backgroundColor: colorBar,
                                }}
                              >
                                <span className="truncate flex-1">
                                  {formatTaskDate(start, locale)} – {formatTaskDate(end, locale)}
                                </span>
                                {task.profiles && (
                                  <Avatar
                                    name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
                                    src={task.profiles.avatar_url}
                                    size="xs"
                                    className="ms-2 ring-2 ring-black/20"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {!closed &&
                      (addingFor === group.project.id ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-line">
                          <Textarea
                            autoFocus
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder={t("tasks.newTaskPlaceholder")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                addTask(group.project.id);
                              }
                              if (e.key === "Escape") setAddingFor(null);
                            }}
                            className="text-sm py-1.5 max-w-sm"
                          />
                          <button
                            onClick={() => addTask(group.project.id)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[#6C5CE7] text-white"
                            aria-label={t("tasks.add")}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingFor(group.project.id);
                            setNewTitle("");
                          }}
                          className="flex items-center gap-1.5 px-8 py-2.5 text-xs text-inkFaint hover:text-[#6C5CE7] border-b border-line w-full text-start"
                        >
                          <Plus size={13} />
                          {t("list.addTask")}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full xl:w-[280px] shrink-0 space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-1">{t("list.filter")}</h3>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectClass}>
            <option value="all">{t("calendar.allProjects")}</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
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
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className={selectClass} />
            <input type="date" className={selectClass} />
          </div>
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
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("list.projectsSummary")}</h3>
          <ul className="space-y-2.5">
            {projects.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-inkSoft">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: barColor(item.id) }} />
                  {item.name}
                </span>
                <span className="text-inkFaint">{countsByProject[item.id] ?? 0}</span>
              </li>
            ))}
          </ul>
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
              {critical.map((task, index) => (
                <div key={task.id}>
                  <div className="rounded-lg border border-line bg-paperDark px-2.5 py-2">
                    <p className="text-xs text-ink truncate">{task.title}</p>
                    <p className="text-[11px] text-inkFaint mt-0.5">
                      {formatTaskDate(taskStart(task), locale)} – {formatTaskDate(taskEnd(task), locale)}
                    </p>
                  </div>
                  {index < critical.length - 1 && (
                    <div className="flex justify-center py-1 text-inkFaint">
                      <ArrowDown size={12} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
