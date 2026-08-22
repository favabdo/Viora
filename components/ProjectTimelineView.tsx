"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { supabase, Project, Task } from "@/lib/supabase";
import { dateKey, formatTaskDate, normalizeTask } from "@/lib/taskShape";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import DonutChart from "./ui/DonutChart";
import { Input } from "./ui/Input";

const DAY_WIDTH = 18;
const ROW_HEIGHT = 46;
const LABEL_WIDTH = 220;
const PROJECT_COLORS = ["#6C5CE7", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#EAB308"];

function colorForProject(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
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

function startKey(task: Task): string {
  return dateKey(task.created_at) || dateKey(task.start_date) || ymd(new Date());
}

function plannedEndKey(task: Task): string | null {
  return dateKey(task.due_date);
}

function actualEndKey(task: Task, today: string): string {
  if (task.is_done) {
    return dateKey(task.completed_at) || plannedEndKey(task) || startKey(task);
  }
  const planned = plannedEndKey(task);
  if (!planned) return today;
  return today > planned ? today : planned;
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
  const [projectFilter, setProjectFilter] = useState(project.id);
  const [showCompleted, setShowCompleted] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

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

  const visible = useMemo(() => {
    return allTasks.filter((task) => {
      if (projectFilter !== "all" && task.project_id !== projectFilter) return false;
      if (!showCompleted && task.is_done) return false;
      return true;
    });
  }, [allTasks, projectFilter, showCompleted]);

  const groups = useMemo(() => {
    const ids = projectFilter === "all" ? projects.map((item) => item.id) : [projectFilter];
    return ids
      .map((id) => ({
        project: projects.find((item) => item.id === id) || project,
        tasks: visible.filter((task) => task.project_id === id),
      }))
      .filter((group) => group.tasks.length > 0 || group.project.id === project.id);
  }, [projects, project, projectFilter, visible]);

  const { rangeStart, totalDays, months } = useMemo(() => {
    let min = todayDate;
    let max = addDays(todayDate, 21);
    for (const task of visible) {
      const start = toDate(startKey(task));
      const end = toDate(actualEndKey(task, today));
      if (start < min) min = start;
      if (end > max) max = end;
    }
    min = addDays(min, -3);
    max = addDays(max, 7);
    const total = Math.max(diffDays(min, max) + 1, 28);
    const monthGroups: { label: string; days: number }[] = [];
    let cursor = new Date(min);
    for (let i = 0; i < total; ) {
      const label = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(cursor);
      const leftInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() - cursor.getDate() + 1;
      const span = Math.min(leftInMonth, total - i);
      monthGroups.push({ label, days: span });
      cursor = addDays(cursor, span);
      i += span;
    }
    return { rangeStart: min, totalDays: total, months: monthGroups };
  }, [visible, locale, today, todayDate]);

  const todayOffset = diffDays(rangeStart, todayDate);
  const gridWidth = totalDays * DAY_WIDTH;

  const countsByProject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const task of allTasks) {
      map[task.project_id] = (map[task.project_id] ?? 0) + 1;
    }
    return map;
  }, [allTasks]);

  const overview = useMemo(() => {
    const current = visible.filter((task) => task.project_id === project.id);
    const done = current.filter((task) => task.is_done).length;
    const overdue = current.filter((task) => !task.is_done && plannedEndKey(task) && (plannedEndKey(task) as string) < today).length;
    const open = current.length - done - overdue;
    return [
      { label: t("timeline.completed"), color: "#22C55E", count: done },
      { label: t("timeline.inProgress"), color: "#3B82F6", count: Math.max(open, 0) },
      { label: t("list.overdue"), color: "#EF4444", count: overdue },
    ];
  }, [visible, project.id, today, t]);

  const critical = useMemo(() => {
    return visible
      .filter((task) => !task.is_done && plannedEndKey(task))
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 5);
  }, [visible]);

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

  function shortRange(start: string, end: string): string {
    return `${formatTaskDate(start, locale)} – ${formatTaskDate(end, locale)}`;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-line bg-surface thin-scroll">
          <div style={{ minWidth: LABEL_WIDTH + gridWidth }}>
            <div className="flex border-b border-line bg-paperDark sticky top-0 z-20">
              <div className="shrink-0 border-e border-line" style={{ width: LABEL_WIDTH }} />
              <div>
                <div className="flex">
                  {months.map((month) => (
                    <div
                      key={month.label + month.days}
                      className="shrink-0 px-2 py-1.5 text-[11px] font-medium text-inkSoft border-e border-line"
                      style={{ width: month.days * DAY_WIDTH }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>
                <div className="flex border-t border-line">
                  {Array.from({ length: totalDays }, (_, i) => {
                    const day = addDays(rangeStart, i);
                    const show = day.getDate() === 1 || day.getDate() % 7 === 1;
                    return (
                      <div
                        key={i}
                        className="shrink-0 text-[10px] text-inkFaint text-center py-1"
                        style={{ width: DAY_WIDTH }}
                      >
                        {show ? day.getDate() : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative">
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#6C5CE7] z-10 pointer-events-none"
                  style={{ insetInlineStart: LABEL_WIDTH + todayOffset * DAY_WIDTH }}
                />
              )}

              {groups.map((group) => {
                const closed = collapsed[group.project.id];
                const color = colorForProject(group.project.id);
                return (
                  <div key={group.project.id} className="border-b border-line">
                    <button
                      onClick={() => setCollapsed((prev) => ({ ...prev, [group.project.id]: !prev[group.project.id] }))}
                      className="flex items-center gap-2 px-3 py-2 w-full text-start hover:bg-paperDark/40"
                    >
                      <ChevronDown size={14} className={`text-inkFaint ${closed ? "-rotate-90" : ""}`} />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-semibold text-ink">{group.project.name}</span>
                      <span className="text-xs text-inkFaint">{group.tasks.length}</span>
                    </button>
                    {!closed &&
                      group.tasks.map((task) => {
                        const start = startKey(task);
                        const planned = plannedEndKey(task);
                        const end = actualEndKey(task, today);
                        const startDate = toDate(start);
                        const endDate = toDate(end);
                        const plannedDate = planned ? toDate(planned) : endDate;
                        const offset = Math.max(diffDays(rangeStart, startDate), 0);
                        const fullSpan = Math.max(diffDays(startDate, endDate) + 1, 1);
                        const plannedSpan = Math.max(diffDays(startDate, plannedDate) + 1, 1);
                        const overdue =
                          !task.is_done && planned != null && today > planned;
                        const redSpan = overdue ? Math.max(fullSpan - plannedSpan, 0) : 0;
                        return (
                          <div key={task.id} className="flex items-center" style={{ height: ROW_HEIGHT }}>
                            <div
                              className="shrink-0 sticky start-0 z-[5] bg-surface px-3 border-e border-line truncate text-xs text-ink"
                              style={{ width: LABEL_WIDTH }}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                            <div className="relative" style={{ width: gridWidth, height: ROW_HEIGHT }}>
                              <div
                                className="absolute top-2.5 h-7 rounded-md overflow-hidden flex items-center"
                                style={{
                                  insetInlineStart: offset * DAY_WIDTH + 2,
                                  width: Math.max(fullSpan * DAY_WIDTH - 4, 28),
                                }}
                              >
                                <div
                                  className="h-full flex items-center px-2 text-[10px] font-medium text-white truncate"
                                  style={{
                                    width: overdue ? plannedSpan * DAY_WIDTH - 2 : "100%",
                                    backgroundColor: color,
                                    minWidth: overdue ? 24 : undefined,
                                  }}
                                >
                                  {shortRange(start, planned || end)}
                                </div>
                                {redSpan > 0 && (
                                  <div
                                    className="h-full bg-[#EF4444]"
                                    style={{ width: redSpan * DAY_WIDTH }}
                                    title={t("timeline.overdueHint")}
                                  />
                                )}
                              </div>
                              {task.profiles && (
                                <div
                                  className="absolute top-2.5 -translate-y-0"
                                  style={{ insetInlineStart: offset * DAY_WIDTH + fullSpan * DAY_WIDTH - 10 }}
                                >
                                  <Avatar
                                    name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
                                    src={task.profiles.avatar_url}
                                    size="xs"
                                    className="ring-2 ring-surface"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {!closed &&
                      (addingFor === group.project.id ? (
                        <div className="flex items-center gap-2 px-3 py-2" style={{ width: LABEL_WIDTH + 280 }}>
                          <Input
                            autoFocus
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder={t("tasks.newTaskPlaceholder")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addTask(group.project.id);
                              if (e.key === "Escape") setAddingFor(null);
                            }}
                            className="text-sm py-1.5"
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
                          className="flex items-center gap-1.5 px-3 py-2 text-xs text-inkFaint hover:text-[#6C5CE7]"
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

      <aside className="w-full xl:w-72 shrink-0 space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">{t("list.filter")}</h3>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full rounded-lg border border-line bg-paperDark px-2.5 py-2 text-xs text-ink"
          >
            <option value="all">{t("calendar.allProjects")}</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
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
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("list.projectsSummary")}</h3>
          <ul className="space-y-2">
            {projects.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className={item.id === project.id ? "text-ink font-medium" : "text-inkSoft"}>{item.name}</span>
                <span className="text-inkFaint">{countsByProject[item.id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("calendar.upcoming")}</h3>
          <div className="flex flex-col items-center">
            <DonutChart
              segments={overview.map((item) => ({ value: item.count, color: item.color }))}
              size={120}
              strokeWidth={14}
              centerLabel={String(overview.reduce((sum, item) => sum + item.count, 0))}
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
            <ol className="space-y-3">
              {critical.map((task, index) => (
                <li key={task.id} className="flex items-start gap-2">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-paperDark text-[10px] text-inkSoft flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-ink truncate">{task.title}</p>
                    <p className="text-[11px] text-inkFaint">{formatTaskDate(task.due_date, locale)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
