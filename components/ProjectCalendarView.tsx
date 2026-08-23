"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, ChevronDown } from "lucide-react";
import { supabase, Project, Task, BoardColumn } from "@/lib/supabase";
import { dateKey, formatTaskDate, normalizeTask } from "@/lib/taskShape";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/useSettings";
import DonutChart from "./ui/DonutChart";

const PROJECT_COLORS = ["#6C5CE7", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#EAB308"];

function colorForProject(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function priorityOf(task: Task): "high" | "medium" | "low" | null {
  if (!task.color) return null;
  if (task.color === "#ef4444" || task.color === "#a855f7") return "high";
  if (task.color === "#f97316" || task.color === "#eab308") return "medium";
  return "low";
}

export default function ProjectCalendarView({
  project,
  projects,
  tasks: projectTasks,
  columns,
  onTasksMutated,
}: {
  project: Project;
  projects: Project[];
  tasks: Task[];
  columns: BoardColumn[];
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
}) {
  const { t, lang, dir } = useTranslation();
  const { settings } = useSettings();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const weekStartsOnMonday = settings.weekStart === "monday";
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [allTasks, setAllTasks] = useState<Task[]>(projectTasks);
  const [projectFilter, setProjectFilter] = useState(project.id);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    setProjectFilter(project.id);
  }, [project.id]);

  useEffect(() => {
    if (projects.length === 0) return;
    supabase
      .from("tasks")
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .in(
        "project_id",
        projects.map((p) => p.id)
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

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of projects) map.set(item.id, item.name);
    return map;
  }, [projects]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of allTasks) {
      if (!task.user_id) continue;
      const name = (task.profiles?.full_name || task.profiles?.username || "").trim();
      if (name) map.set(task.user_id, name);
    }
    return Array.from(map.entries());
  }, [allTasks]);

  const visibleTasks = useMemo(() => {
    return allTasks.filter((task) => {
      if (projectFilter !== "all" && task.project_id !== projectFilter) return false;
      if (assigneeFilter !== "all" && task.user_id !== assigneeFilter) return false;
      if (priorityFilter !== "all" && priorityOf(task) !== priorityFilter) return false;
      if (!showCompleted && task.is_done) return false;
      return true;
    });
  }, [allTasks, projectFilter, assigneeFilter, priorityFilter, showCompleted]);

  const datedTasks = visibleTasks.filter((task) => dateKey(task.due_date));

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of datedTasks) {
      const key = dateKey(task.due_date);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [datedTasks]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const rawOffset = first.getDay();
    const startOffset = weekStartsOnMonday ? (rawOffset + 6) % 7 : rawOffset;
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      return day;
    });
  }, [cursor, weekStartsOnMonday]);

  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, weekStartsOnMonday ? 8 : 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    });
  }, [locale, weekStartsOnMonday]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
  const todayKey = ymd(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = useMemo(() => {
    return datedTasks
      .filter((task) => !task.is_done && task.due_date && new Date(`${task.due_date}T00:00:00`) >= today)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 5);
  }, [datedTasks, today]);

  const statusLegend = useMemo(() => {
    const current = visibleTasks.filter((task) => task.project_id === project.id);
    const items = columns.map((column) => ({
      label: column.name,
      color: column.color,
      count: current.filter((task) => task.column_id === column.id).length,
    }));
    const leftover = current.filter((task) => !task.column_id || !columns.some((c) => c.id === task.column_id)).length;
    if (leftover > 0) items.push({ label: t("list.noStatus"), color: "#6b7280", count: leftover });
    return items;
  }, [visibleTasks, columns, project.id, t]);

  async function toggleDone(task: Task) {
    const next = !task.is_done;
    setAllTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, is_done: next } : item)));
    if (task.project_id === project.id) {
      onTasksMutated((prev) => prev.map((item) => (item.id === task.id ? { ...item, is_done: next } : item)));
    }
    await supabase.from("tasks").update({ is_done: next }).eq("id", task.id);
  }

  function dueTone(iso: string | null | undefined): string {
    if (!iso) return t("calendar.upcoming");
    const due = new Date(`${iso}T00:00:00`);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return t("projects.dueToday");
    if (diff === 1) return t("calendar.tomorrow");
    return formatTaskDate(iso, locale);
  }

  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-ink capitalize">{monthLabel}</h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-inkSoft hover:text-ink"
            >
              {t("board.today")}
            </button>
            <button
              aria-label={t("board.prevMonth")}
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line text-inkSoft hover:text-ink"
            >
              <PrevIcon size={14} />
            </button>
            <button
              aria-label={t("board.nextMonth")}
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line text-inkSoft hover:text-ink"
            >
              <NextIcon size={14} />
            </button>
            <button className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft">
              {t("calendar.month")}
              <ChevronDown size={12} />
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="xl:hidden inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft"
            >
              <Filter size={13} />
              {t("list.filter")}
            </button>
            <button className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink">
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-2 py-2 text-center text-[11px] font-medium text-inkFaint">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const key = ymd(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = key === todayKey;
              const dayTasks = tasksByDate.get(key) || [];
              const shown = dayTasks.slice(0, 3);
              const extra = dayTasks.length - shown.length;
              return (
                <div
                  key={i}
                  className={`min-h-[112px] border-e border-b border-line p-1.5 ${
                    isToday ? "ring-1 ring-inset ring-[#3B82F6]" : ""
                  } ${inMonth ? "bg-surface" : "bg-paperDark/40"}`}
                >
                  <div className="flex justify-end mb-1">
                    <span
                      className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? "bg-[#3B82F6] text-white" : inMonth ? "text-inkSoft" : "text-inkFaint"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {shown.map((task) => {
                      const color = colorForProject(task.project_id);
                      return (
                        <button
                          key={task.id}
                          onClick={() => toggleDone(task)}
                          title={task.title}
                          className={`text-start text-[10px] leading-tight px-1.5 py-1 rounded-md truncate text-white ${
                            task.is_done ? "opacity-50 line-through" : ""
                          }`}
                          style={{ backgroundColor: color }}
                        >
                          {task.title}
                        </button>
                      );
                    })}
                    {extra > 0 && (
                      <button
                        onClick={() => setExpandedDay(expandedDay === key ? null : key)}
                        className="text-[10px] text-inkFaint px-1 text-start hover:text-ink"
                      >
                        +{extra} {t("calendar.more")}
                      </button>
                    )}
                    {expandedDay === key && extra > 0 && (
                      <div className="flex flex-col gap-1">
                        {dayTasks.slice(3).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => toggleDone(task)}
                            className="text-start text-[10px] px-1.5 py-1 rounded-md truncate text-white"
                            style={{ backgroundColor: colorForProject(task.project_id) }}
                          >
                            {task.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className={`w-full xl:w-72 shrink-0 space-y-4 ${showFilters ? "" : "hidden xl:block"}`}>
        <div className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-ink capitalize">
              {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor)}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setCursor((c) => addMonths(c, -1))} className="text-inkFaint hover:text-ink">
                <PrevIcon size={13} />
              </button>
              <button onClick={() => setCursor((c) => addMonths(c, 1))} className="text-inkFaint hover:text-ink">
                <NextIcon size={13} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayLabels.map((label) => (
              <span key={label} className="text-[10px] text-center text-inkFaint">
                {label.slice(0, 2)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const key = ymd(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = key === todayKey;
              const hasTasks = (tasksByDate.get(key) || []).length > 0;
              return (
                <button
                  key={i}
                  onClick={() => setCursor(startOfMonth(day))}
                  className={`h-7 rounded-md text-[11px] ${
                    isToday
                      ? "bg-[#3B82F6] text-white"
                      : hasTasks
                        ? "text-ink"
                        : inMonth
                          ? "text-inkSoft"
                          : "text-inkFaint/50"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">{t("list.filter")}</h3>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0"
          >
            <option value="all">{t("calendar.allProjects")}</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0"
          >
            <option value="all">{t("calendar.allAssignees")}</option>
            {assignees.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0"
          >
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
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  showCompleted ? "start-4" : "start-0.5"
                }`}
              />
            </button>
          </label>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("calendar.upcoming")}</h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-inkFaint">{t("board.noDeadlines")}</p>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: colorForProject(task.project_id) }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-ink truncate">{task.title}</p>
                    <p className="text-[11px] text-inkFaint">
                      {projectNameById.get(task.project_id) || project.name} · {dueTone(task.due_date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("list.totalTasks")}</h3>
          <div className="flex flex-col items-center">
            <DonutChart
              segments={statusLegend.map((item) => ({ value: item.count, color: item.color }))}
              size={120}
              strokeWidth={14}
              centerLabel={String(statusLegend.reduce((sum, item) => sum + item.count, 0))}
              centerSubLabel={t("board.tasksCount")}
            />
          </div>
          <ul className="mt-3 space-y-1.5">
            {statusLegend.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-inkSoft truncate">{item.label}</span>
                <span className="text-ink font-medium">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
