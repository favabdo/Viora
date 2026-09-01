"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FolderKanban, Minus, Plus, X } from "lucide-react";
import { Task } from "@/lib/supabase";
import { dateKey, formatTaskDate } from "@/lib/taskShape";
import { displayName } from "@/lib/displayName";
import { colorForProject } from "@/lib/projectColor";
import { useWorkspaceSchedule } from "@/lib/useWorkspaceSchedule";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import DonutChart from "./ui/DonutChart";
import EmptyState from "./ui/EmptyState";
import { SkeletonList } from "./ui/Skeleton";

const LABEL_WIDTH = 280;
const ROW_HEIGHT = 48;
const MIN_BAR_PX = 140;
const OVERDUE_COLOR = "#EF4444";
const DIM = 0.22;

function scaleBar(plannedDays: number, overdueDaysCount: number, filledDays: number, remainingDays: number, dayWidth: number) {
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

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
function elapsedDays(created: string, plannedEnd: string, today: string, isDone: boolean): number {
  if (!isDone && today < created) return 0;
  const fillUntil = isDone || today >= plannedEnd ? plannedEnd : today;
  return Math.min(inclusiveDays(created, fillUntil), inclusiveDays(created, plannedEnd));
}

export default function GlobalTimelineView({ currentUserId }: { currentUserId: string }) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const { projects, tasks, loading } = useWorkspaceSchedule();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [focusProject, setFocusProject] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dayWidth, setDayWidth] = useState(16);
  const [hover, setHover] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = ymd(new Date());
  const todayDate = toDate(today);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const name = (task.profiles?.full_name || task.profiles?.username || "").trim();
      if (task.user_id && name) map.set(task.user_id, name);
    }
    return Array.from(map.entries());
  }, [tasks]);

  const visible = useMemo(() => {
    return tasks.filter((task) => {
      if (assigneeFilter !== "all" && task.user_id !== assigneeFilter) return false;
      if (!showCompleted && task.is_done) return false;
      return true;
    });
  }, [tasks, assigneeFilter, showCompleted]);

  const grouped = useMemo(() => {
    return projects
      .map((project) => ({
        project,
        items: visible.filter((task) => task.project_id === project.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [projects, visible]);

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
    const inProgress = Math.max(visible.length - done - overdue, 0);
    return [
      { label: t("timeline.completed"), color: "#22C55E", count: done },
      { label: t("timeline.inProgress"), color: "#3B82F6", count: inProgress },
      { label: t("list.overdue"), color: OVERDUE_COLOR, count: overdue },
    ];
  }, [visible, today, t]);

  const selectedTask = selectedId ? tasks.find((task) => task.id === selectedId) || null : null;

  function dimmed(task: Task) {
    return focusProject !== "all" && task.project_id !== focusProject;
  }

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

  const selectClass = "w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0";

  if (loading) return <SkeletonList rows={6} />;
  if (projects.length === 0) {
    return <EmptyState icon={FolderKanban} title={t("projects.empty")} hint={t("projects.emptyHint")} />;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h1 className="text-lg font-semibold text-ink">{t("nav.timeline")}</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollRef.current?.scrollTo({ left: Math.max(todayOffset * dayWidth - 240, 0), behavior: "smooth" })}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-inkSoft hover:text-ink"
            >
              {t("board.today")}
            </button>
            <div className="flex rounded-lg border border-line overflow-hidden">
              <button onClick={() => setDayWidth((w) => Math.max(10, w - 3))} className="h-8 w-8 inline-flex items-center justify-center text-inkSoft hover:bg-paperDark">
                <Minus size={13} />
              </button>
              <button onClick={() => setDayWidth((w) => Math.min(28, w + 3))} className="h-8 w-8 inline-flex items-center justify-center text-inkSoft hover:bg-paperDark border-s border-line">
                <Plus size={13} />
              </button>
            </div>
          </div>
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
                      <div key={i} className="shrink-0 text-[10px] text-inkFaint text-center py-1 border-e border-line/60" style={{ width: dayWidth }}>
                        {show ? day.getDate() : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative">
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ insetInlineStart: LABEL_WIDTH + todayOffset * dayWidth }}>
                  <div className="h-full w-px bg-[#6C5CE7]" />
                </div>
              )}

              {grouped.map(({ project, items }) => {
                const color = colorForProject(project.id);
                const groupDim = focusProject !== "all" && focusProject !== project.id;
                return (
                  <div key={project.id}>
                    <div className="flex items-center border-b border-line bg-paperDark/70" style={{ opacity: groupDim ? 0.45 : 1 }}>
                      <div className="shrink-0 sticky start-0 z-[5] bg-paperDark px-3 flex items-center gap-2 border-e border-line" style={{ width: LABEL_WIDTH, height: 36 }}>
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate text-xs font-semibold text-ink">{project.name}</span>
                        <span className="text-[10px] text-inkFaint">{items.length}</span>
                      </div>
                      <div style={{ width: gridWidth, height: 36 }} />
                    </div>
                    {items.map((task) => {
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
                      const { filledWidth, remainingWidth, overdueWidth, total: barWidth } = scaleBar(
                        plannedSpan,
                        late,
                        filledSpan,
                        remainingSpan,
                        dayWidth
                      );
                      const faded = dimmed(task);
                      const isSelected = selectedId === task.id;
                      const assignee = task.profiles
                        ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
                        : t("timeline.unassigned");

                      return (
                        <div
                          key={task.id}
                          role="button"
                          tabIndex={0}
                          className={`flex items-center border-b cursor-pointer ${isSelected ? "border-line bg-[#6C5CE7]/[0.06]" : "border-line/70 hover:bg-paperDark/60"}`}
                          style={{ height: ROW_HEIGHT, opacity: faded ? DIM : 1 }}
                          onMouseMove={(e) => setHover({ task, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setHover((h) => (h?.task.id === task.id ? null : h))}
                          onClick={() => setSelectedId(task.id)}
                        >
                          <div
                            className={`shrink-0 sticky start-0 z-[5] px-3 flex items-center gap-2 border-e border-line ${isSelected ? "bg-[#6C5CE7]/[0.06]" : "bg-surface"}`}
                            style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
                          >
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: late > 0 ? OVERDUE_COLOR : color }} />
                            <span className="truncate text-[13px] text-ink flex-1">{task.title}</span>
                            {task.profiles && <Avatar name={assignee} src={task.profiles.avatar_url} size="xs" className="ring-1 ring-line" />}
                          </div>
                          <div className="relative" style={{ width: gridWidth, height: ROW_HEIGHT }}>
                            <div
                              className="absolute top-2.5 h-7 flex items-stretch overflow-hidden shadow-sm"
                              style={{
                                insetInlineStart: offset * dayWidth + 2,
                                width: barWidth,
                                borderRadius: 9999,
                              }}
                            >
                              <div className="h-full shrink-0" style={{ width: filledWidth, backgroundColor: color }} />
                              {remainingWidth > 0 && (
                                <div className="relative h-full shrink-0 overflow-hidden" style={{ width: remainingWidth, backgroundColor: color, opacity: 0.38 }}>
                                  <div className="timeline-load-track absolute inset-0" />
                                </div>
                              )}
                              {late > 0 && <div className="h-full shrink-0" style={{ width: overdueWidth, backgroundColor: OVERDUE_COLOR }} />}
                              {barWidth >= 72 && (
                                <span className="pointer-events-none absolute inset-0 flex items-center gap-1.5 ps-2.5 pe-2 text-[11px] font-medium text-white">
                                  {task.profiles && (
                                    <Avatar name={assignee} src={task.profiles.avatar_url} size="xs" className="h-4 w-4 text-[8px] ring-1 ring-white/40 border-white/20" />
                                  )}
                                  <span className="truncate">{task.title}</span>
                                  {barWidth >= 160 && <span className="ms-auto truncate text-[10px] text-white/90 max-w-[38%]">{assignee}</span>}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full xl:w-[280px] shrink-0 space-y-4">
        {selectedTask ? (
          <div className="rounded-xl border border-line bg-surface p-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">{t("taskDetail.details")}</h3>
              <button type="button" onClick={() => setSelectedId(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink" aria-label={t("common.close")}>
                <X size={14} />
              </button>
            </div>
            <p className="text-sm font-medium text-ink">{selectedTask.title}</p>
            <p className="text-[11px] font-medium" style={{ color: colorForProject(selectedTask.project_id) }}>
              {projectById.get(selectedTask.project_id)?.name}
            </p>
            <p className="text-[12px] text-ink">
              {t("taskDetail.created")}: {formatTaskDate(taskCreated(selectedTask), locale)}
            </p>
            <p className="text-[12px] text-ink">
              {t("taskDetail.due")}: {taskDue(selectedTask) ? formatTaskDate(taskDue(selectedTask), locale) : t("board.noDueDate")}
            </p>
            <p className={`text-[12px] ${overdueDays(selectedTask, today) > 0 ? "text-red-500" : "text-ink"}`}>
              {t("timeline.timeLeft")}: {remainingLabel(selectedTask)}
            </p>
            {selectedTask.profiles && (
              <div className="flex items-center gap-2">
                <Avatar
                  name={displayName(selectedTask.user_id, selectedTask.profiles, currentUserId, t("common.you"))}
                  src={selectedTask.profiles.avatar_url}
                  size="sm"
                />
                <span className="text-xs">{displayName(selectedTask.user_id, selectedTask.profiles, currentUserId, t("common.you"))}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
              <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-1">{t("list.filter")}</h3>
              <select value={focusProject} onChange={(e) => setFocusProject(e.target.value)} className={selectClass}>
                <option value="all">{t("calendar.allProjects")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {focusProject !== "all" && <p className="text-[11px] text-inkFaint">{t("schedule.focusHint")}</p>}
              <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className={selectClass}>
                <option value="all">{t("calendar.allAssignees")}</option>
                {assignees.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-between gap-2 pt-1 text-xs text-inkSoft">
                <span>{t("calendar.showCompleted")}</span>
                <button
                  role="switch"
                  aria-checked={showCompleted}
                  onClick={() => setShowCompleted((v) => !v)}
                  className={`relative h-5 w-9 rounded-full ${showCompleted ? "bg-[#6C5CE7]" : "bg-lineStrong"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${showCompleted ? "start-4" : "start-0.5"}`} />
                </button>
              </label>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3">
              <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("list.col.project")}</h3>
              <ul className="space-y-1.5">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => setFocusProject((id) => (id === project.id ? "all" : project.id))}
                      className={`w-full flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 ${
                        focusProject === project.id ? "bg-paperDark" : "hover:bg-paperDark/60"
                      }`}
                      style={{ opacity: focusProject !== "all" && focusProject !== project.id ? 0.4 : 1 }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorForProject(project.id) }} />
                      <span className="flex-1 text-start truncate text-inkSoft">{project.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3">
              <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("timeline.overview")}</h3>
              <div className="flex flex-col items-center">
                <DonutChart
                  segments={overview.map((item) => ({ value: item.count, color: item.color }))}
                  size={120}
                  strokeWidth={14}
                  centerLabel={String(visible.length)}
                  centerSubLabel={t("board.tasksCount")}
                />
              </div>
            </div>
          </>
        )}
      </aside>

      {hover && (
        <HoverCard
          task={hover.task}
          projectName={projectById.get(hover.task.project_id)?.name || ""}
          x={hover.x}
          y={hover.y}
          locale={locale}
          remaining={remainingLabel(hover.task)}
          currentUserId={currentUserId}
          t={t}
        />
      )}
    </div>
  );
}

function HoverCard({
  task,
  projectName,
  x,
  y,
  locale,
  remaining,
  currentUserId,
  t,
}: {
  task: Task;
  projectName: string;
  x: number;
  y: number;
  locale: string;
  remaining: string;
  currentUserId: string;
  t: (key: string) => string;
}) {
  const late = overdueDays(task, ymd(new Date()));
  let left = x + 14;
  let top = y + 16;
  if (typeof window !== "undefined") {
    if (left + 288 > window.innerWidth) left = x - 294;
    if (top + 180 > window.innerHeight) top = y - 188;
  }
  const assignee = task.profiles
    ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
    : t("timeline.unassigned");

  return createPortal(
    <div className="pointer-events-none fixed z-[80] w-[280px] rounded-xl border border-line bg-surface p-3 shadow-lg" style={{ left, top }} role="tooltip">
      <p className="text-[11px] font-medium" style={{ color: colorForProject(task.project_id) }}>
        {projectName}
      </p>
      <p className="text-sm font-medium text-ink mt-0.5">{task.title}</p>
      <p className="text-[12px] text-inkSoft mt-2">
        {t("taskDetail.due")}: {taskDue(task) ? formatTaskDate(taskDue(task), locale) : t("board.noDueDate")}
      </p>
      <p className={`text-[12px] ${late > 0 ? "text-red-500" : "text-ink"}`}>
        {t("timeline.timeLeft")}: {remaining}
      </p>
      <p className="text-[12px] text-ink truncate">
        {t("list.col.assignee")}: {assignee}
      </p>
    </div>,
    document.body
  );
}
