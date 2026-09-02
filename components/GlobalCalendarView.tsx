"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FolderKanban } from "lucide-react";
import { Task } from "@/lib/supabase";
import { dateKey, formatTaskDate } from "@/lib/taskShape";
import { layoutWeekLanes, spanCoversDay } from "@/lib/calendarLayout";
import { colorForProject } from "@/lib/projectColor";
import { displayName } from "@/lib/displayName";
import { useWorkspaceSchedule } from "@/lib/useWorkspaceSchedule";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/useSettings";
import Avatar from "./ui/Avatar";
import EmptyState from "./ui/EmptyState";
import { SkeletonList } from "./ui/Skeleton";
import { TaskDetailsPanel, TaskHoverCard } from "./TaskInspect";

const DIM = 0.22;

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export default function GlobalCalendarView({ currentUserId }: { currentUserId: string }) {
  const { t, lang, dir } = useTranslation();
  const { settings } = useSettings();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const weekStartsOnMonday = settings.weekStart === "monday";
  const { projects, tasks, loading } = useWorkspaceSchedule();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [focusProject, setFocusProject] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [hover, setHover] = useState<{ task: Task; x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of projects) map.set(item.id, item.name);
    return map;
  }, [projects]);

  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const name = (task.profiles?.full_name || task.profiles?.username || "").trim();
      if (task.user_id && name) map.set(task.user_id, name);
    }
    return Array.from(map.entries());
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (assigneeFilter !== "all" && task.user_id !== assigneeFilter) return false;
      if (!showCompleted && task.is_done) return false;
      return true;
    });
  }, [tasks, assigneeFilter, showCompleted]);

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

  const weekRows = useMemo(() => {
    const rows: { days: Date[]; items: ReturnType<typeof layoutWeekLanes>["items"]; laneCount: number }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      const laid = layoutWeekLanes(weekDays.map(ymd), visibleTasks);
      rows.push({ days: weekDays, items: laid.items, laneCount: laid.laneCount });
    }
    return rows;
  }, [days, visibleTasks]);

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
    return visibleTasks
      .filter((task) => !task.is_done && dateKey(task.due_date) && new Date(`${task.due_date}T00:00:00`) >= today)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 6);
  }, [visibleTasks, today]);

  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const selectClass = "w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0";
  const selectedTask = selectedId ? visibleTasks.find((task) => task.id === selectedId) || null : null;

  function dimmed(task: Task) {
    return focusProject !== "all" && task.project_id !== focusProject;
  }

  if (loading) return <SkeletonList rows={6} />;
  if (projects.length === 0) {
    return <EmptyState icon={FolderKanban} title={t("projects.empty")} hint={t("projects.emptyHint")} />;
  }

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-lg font-semibold text-ink capitalize">{monthLabel}</h1>
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
          <div>
            {weekRows.map((week, wi) => (
              <div
                key={wi}
                className="relative border-b border-line last:border-b-0"
                style={{ minHeight: 28 + Math.max(week.laneCount, 1) * 22 }}
              >
                <div className="grid grid-cols-7">
                  {week.days.map((day, di) => {
                    const key = ymd(day);
                    const inMonth = day.getMonth() === cursor.getMonth();
                    const isToday = key === todayKey;
                    return (
                      <div
                        key={di}
                        className={`border-e border-line last:border-e-0 ${isToday ? "ring-1 ring-inset ring-[#3B82F6]" : ""} ${
                          inMonth ? "bg-surface" : "bg-paperDark/40"
                        }`}
                        style={{ minHeight: 28 + Math.max(week.laneCount, 1) * 22 }}
                      >
                        <div className="flex justify-end p-1">
                          <span
                            className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
                              isToday ? "bg-[#3B82F6] text-white" : inMonth ? "text-inkSoft" : "text-inkFaint"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7"
                  style={{ gridAutoRows: 20, rowGap: 2, paddingBottom: 4 }}
                >
                  {week.items.map((item) => {
                    const faded = dimmed(item.task);
                    const name = item.task.profiles
                      ? displayName(item.task.user_id, item.task.profiles, currentUserId, t("common.you"))
                      : t("timeline.unassigned");
                    const color = colorForProject(item.task.project_id);
                    const startRound = item.continuesBefore ? "0" : "999px";
                    const endRound = item.continuesAfter ? "0" : "999px";
                    const wide = item.colEnd - item.colStart >= 1;
                    const projectName = projectNameById.get(item.task.project_id) || "";
                    return (
                      <button
                        type="button"
                        key={item.task.id}
                        className="pointer-events-auto flex min-w-0 items-center gap-1 overflow-hidden px-1.5 text-[10px] font-medium text-white text-start cursor-pointer"
                        style={{
                          gridColumn: `${item.colStart + 1} / ${item.colEnd + 2}`,
                          gridRow: item.lane + 1,
                          backgroundColor: color,
                          height: 20,
                          zIndex: faded ? 0 : 2,
                          marginInlineStart: item.continuesBefore ? 0 : 3,
                          marginInlineEnd: item.continuesAfter ? 0 : 3,
                          borderStartStartRadius: startRound,
                          borderEndStartRadius: startRound,
                          borderStartEndRadius: endRound,
                          borderEndEndRadius: endRound,
                          opacity: faded ? DIM : item.task.is_done ? 0.55 : 1,
                        }}
                        onMouseMove={(e) => setHover({ task: item.task, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setHover((h) => (h?.task.id === item.task.id ? null : h))}
                        onClick={() => setSelectedId(item.task.id)}
                      >
                        {item.task.profiles && (
                          <Avatar name={name} src={item.task.profiles.avatar_url} size="xs" className="h-4 w-4 text-[8px] ring-1 ring-white/40 border-white/20" />
                        )}
                        <span className="truncate">{item.task.title}</span>
                        {wide && (
                          <span className="ms-auto truncate text-[9px] font-normal text-white/90 max-w-[45%]">
                            {name}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="w-full xl:w-72 shrink-0 space-y-4">
        {selectedTask ? (
          <TaskDetailsPanel
            task={selectedTask}
            projectName={projectNameById.get(selectedTask.project_id) || ""}
            locale={locale}
            currentUserId={currentUserId}
            t={t}
            onClose={() => setSelectedId(null)}
          />
        ) : (
        <>
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
              const hasTasks = visibleTasks.some((task) => spanCoversDay(task, key));
              return (
                <button
                  key={i}
                  onClick={() => setCursor(startOfMonth(day))}
                  className={`h-7 rounded-md text-[11px] ${
                    isToday ? "bg-[#3B82F6] text-white" : hasTasks ? "text-ink" : inMonth ? "text-inkSoft" : "text-inkFaint/50"
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
          <select value={focusProject} onChange={(e) => setFocusProject(e.target.value)} className={selectClass}>
            <option value="all">{t("calendar.allProjects")}</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
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
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("calendar.upcoming")}</h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-inkFaint">{t("board.noDeadlines")}</p>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-start gap-2" style={{ opacity: dimmed(task) ? DIM : 1 }}>
                  <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorForProject(task.project_id) }} />
                  <div className="min-w-0">
                    <p className="text-xs text-ink truncate">{task.title}</p>
                    <p className="text-[11px] text-inkFaint">
                      {projectNameById.get(task.project_id)} · {formatTaskDate(task.due_date, locale)}
                      {task.profiles ? ` · ${displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
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
          currentUserId={currentUserId}
          t={t}
          projectName={projectNameById.get(hover.task.project_id) || ""}
        />
      )}
    </div>
  );
}
