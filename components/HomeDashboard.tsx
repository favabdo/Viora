"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Plus,
  Sliders,
  Timer,
} from "lucide-react";
import { supabase, ActivityEntry, BoardColumn, Project, Task, TaskComment } from "@/lib/supabase";
import { normalizeTask } from "@/lib/taskShape";
import { colorForProject } from "@/lib/projectColor";
import { getProjectMeta } from "@/lib/projectMeta";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useAppSession } from "./AppSession";
import { displayName, renderActivity } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import { projectPath } from "@/lib/appRoutes";
import DonutChart from "./ui/DonutChart";
import Button from "./ui/Button";
import ClickableAvatar from "./ClickableAvatar";
import ClickableName from "./ClickableName";
import ProjectMark from "./ProjectMark";
import {
  addDays,
  countsForDays,
  dueLabel,
  inWindow,
  keysBetween,
  localYmd,
  pctChange,
  priorityOf,
  rangeKeys,
  startOfDay,
  statusKind,
  taskTouchesRange,
  windowFromKeys,
} from "@/lib/homeDashboard";

const OVERVIEW = [
  { id: "todo", color: "#6C5CE7", labelKey: "home.todo" },
  { id: "progress", color: "#3B82F6", labelKey: "home.inProgress" },
  { id: "review", color: "#F59E0B", labelKey: "home.review" },
  { id: "done", color: "#22C55E", labelKey: "home.done" },
] as const;

const PRIORITY = [
  { id: "high", color: "#EF4444", labelKey: "home.high" },
  { id: "medium", color: "#F97316", labelKey: "home.medium" },
  { id: "low", color: "#22C55E", labelKey: "home.low" },
] as const;

export default function HomeDashboard() {
  const router = useRouter();
  const { t, lang, dir } = useTranslation();
  const { session, userName } = useAppSession();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const today = localYmd(new Date());
  const firstName = (userName || "").trim().split(/\s+/)[0] || t("common.you");

  const [preset, setPreset] = useState<7 | 14 | 30 | "custom">(7);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [comments, setComments] = useState<Pick<TaskComment, "id" | "created_at" | "project_id">[]>([]);
  const [showWidgets, setShowWidgets] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [pickedDay, setPickedDay] = useState(today);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: projectRows } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (projectRows || []) as Project[];
      setProjects(list);
      if (list.length === 0) {
        setTasks([]);
        setColumns([]);
        setActivity([]);
        setComments([]);
        setLoading(false);
        return;
      }
      const ids = list.map((p) => p.id);
      const [taskRes, colRes, actRes, commentRes] = await Promise.all([
        supabase.from("tasks").select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)").in("project_id", ids),
        supabase.from("board_columns").select("*").in("project_id", ids),
        supabase
          .from("activity_log")
          .select("id, project_id, task_id, actor_id, actor_name, message, action, action_params, created_at")
          .in("project_id", ids)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("task_comments").select("id, created_at, project_id").in("project_id", ids),
      ]);
      if (cancelled) return;
      setTasks((taskRes.data || []).map(normalizeTask));
      setColumns((colRes.data || []) as BoardColumn[]);
      setActivity((actRes.data || []) as ActivityEntry[]);
      setComments((commentRes.data || []) as Pick<TaskComment, "id" | "created_at" | "project_id">[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const keys = useMemo(() => {
    if (preset === "custom") return keysBetween(customFrom, customTo);
    return rangeKeys(preset);
  }, [preset, customFrom, customTo]);
  const { from, to, days } = useMemo(() => windowFromKeys(keys), [keys]);
  const prevFrom = addDays(from, -days);
  const prevTo = from;
  const rangeEndYmd = keys[keys.length - 1];
  const overdueCutoff = rangeEndYmd < today ? rangeEndYmd : today;

  const scopedTasks = useMemo(
    () => tasks.filter((task) => taskTouchesRange(task, from, to)),
    [tasks, from, to]
  );
  const scopedProjects = useMemo(() => {
    const ids = new Set(scopedTasks.map((task) => task.project_id));
    return projects.filter((project) => inWindow(project.created_at, from, to) || ids.has(project.id));
  }, [projects, scopedTasks, from, to]);
  const scopedActivity = useMemo(
    () => activity.filter((row) => inWindow(row.created_at, from, to)),
    [activity, from, to]
  );
  const scopedComments = useMemo(
    () => comments.filter((row) => inWindow(row.created_at, from, to)),
    [comments, from, to]
  );

  const kinds = useMemo(
    () => scopedTasks.map((task) => ({ task, kind: statusKind(task, columnsById) })),
    [scopedTasks, columnsById]
  );
  const completed = kinds.filter((row) => row.kind === "done").length;
  const inProgress = kinds.filter((row) => row.kind === "progress").length;
  const overdue = scopedTasks.filter(
    (task) => !task.is_done && task.due_date && task.due_date <= overdueCutoff && inWindow(task.due_date, from, to)
  ).length;

  const createdNow = tasks.filter((task) => inWindow(task.created_at, from, to)).length;
  const createdPrev = tasks.filter((task) => inWindow(task.created_at, prevFrom, prevTo)).length;
  const doneNow = tasks.filter((task) => task.is_done && inWindow(task.completed_at || task.created_at, from, to)).length;
  const donePrev = tasks.filter((task) => task.is_done && inWindow(task.completed_at, prevFrom, prevTo)).length;
  const projectsNow = projects.filter((p) => inWindow(p.created_at, from, to)).length;
  const projectsPrev = projects.filter((p) => inWindow(p.created_at, prevFrom, prevTo)).length;
  const progressNow = scopedTasks.filter((task) => statusKind(task, columnsById) === "progress").length;
  const progressPrev = tasks.filter(
    (task) => statusKind(task, columnsById) === "progress" && taskTouchesRange(task, prevFrom, prevTo)
  ).length;
  const overdueNow = overdue;
  const overduePrev = tasks.filter(
    (task) => !task.is_done && task.due_date && inWindow(task.due_date, prevFrom, prevTo)
  ).length;

  const sparkProjects = countsForDays(
    projects.map((p) => p.created_at),
    keys
  );
  const sparkTasks = countsForDays(
    tasks.map((task) => task.created_at),
    keys
  );
  const sparkDone = countsForDays(
    tasks.filter((task) => task.is_done).map((task) => task.completed_at || task.created_at),
    keys
  );
  const sparkProgress = countsForDays(
    tasks.filter((task) => statusKind(task, columnsById) === "progress").map((task) => task.created_at),
    keys
  );
  const sparkOverdue = countsForDays(
    tasks.filter((task) => !task.is_done && task.due_date).map((task) => task.due_date),
    keys
  );

  const overview = OVERVIEW.map((item) => ({
    ...item,
    count: kinds.filter((row) => row.kind === item.id).length,
  }));
  const priorities = PRIORITY.map((item) => ({
    ...item,
    count: scopedTasks.filter((task) => priorityOf(task) === item.id).length,
  }));

  const progressRows = useMemo(() => {
    return scopedProjects.slice(0, 6).map((project) => {
      const list = scopedTasks.filter((task) => task.project_id === project.id);
      const done = list.filter((task) => task.is_done).length;
      const pct = list.length ? Math.round((done / list.length) * 100) : 0;
      const meta = getProjectMeta(project.id);
      return {
        project,
        pct,
        color: meta?.color || colorForProject(project.id),
        icon: meta?.icon || "folder",
        imageUrl: meta?.imageUrl || null,
        imageScale: meta?.imageScale ?? 100,
        imageScaleX: meta?.imageScaleX ?? meta?.imageScale ?? 100,
        imageScaleY: meta?.imageScaleY ?? meta?.imageScale ?? 100,
        imagePosX: meta?.imagePosX ?? 50,
        imagePosY: meta?.imagePosY ?? 50,
      };
    });
  }, [scopedProjects, scopedTasks]);

  const workload = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string | null; open: number }>();
    for (const task of scopedTasks) {
      if (task.is_done) continue;
      const id = task.user_id || "unassigned";
      const name = task.user_id
        ? displayName(task.user_id, task.profiles, session.user.id, t("common.you"))
        : t("home.unassigned");
      const prev = map.get(id) || { id, name, avatar: task.profiles?.avatar_url || null, open: 0 };
      prev.open += 1;
      if (task.profiles?.avatar_url) prev.avatar = task.profiles.avatar_url;
      map.set(id, prev);
    }
    const rows = Array.from(map.values())
      .sort((a, b) => b.open - a.open)
      .slice(0, 5);
    const max = Math.max(...rows.map((row) => row.open), 1);
    return rows.map((row) => ({ ...row, pct: Math.round((row.open / max) * 100) }));
  }, [scopedTasks, session.user.id, t]);

  const myTasks = useMemo(() => {
    return scopedTasks
      .filter((task) => task.user_id === session.user.id && !task.is_done)
      .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
      .slice(0, 6);
  }, [scopedTasks, session.user.id]);

  const weekDays = useMemo(() => {
    const start = addDays(cursor, -((cursor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const dayEvents = tasks.filter((task) => task.due_date === pickedDay);
  const files = scopedActivity.filter((row) => row.action === "file_uploaded");
  const periodLabel =
    preset === "custom"
      ? customFrom === customTo
        ? customFrom
        : `${customFrom} → ${customTo}`
      : preset === 7
        ? t("home.last7")
        : preset === 14
          ? t("home.last14")
          : t("home.last30");
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-[#6C5CE7] animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-w-0 overflow-x-hidden grid gap-4 sm:gap-5 ${showWidgets ? "xl:grid-cols-[minmax(0,1fr)_20.5rem]" : ""}`}>
      <div className="min-w-0 space-y-4 sm:space-y-5">
        <div className="space-y-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">{t("home.title")}</h1>
            <p className="mt-1 text-sm font-medium text-ink break-words">{t("home.welcome").replace("{name}", firstName)}</p>
            <p className="text-sm text-inkFaint">{t("home.subtitle")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select
              value={preset}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "custom") {
                  setCustomFrom(keys[0]);
                  setCustomTo(keys[keys.length - 1]);
                  setPreset("custom");
                  return;
                }
                setPreset(Number(value) as 7 | 14 | 30);
              }}
              className="col-span-2 sm:col-auto h-9 w-full sm:w-auto min-w-0 rounded-xl border border-line bg-surface px-3 text-xs text-ink outline-none"
            >
              <option value={7}>{t("home.last7")}</option>
              <option value={14}>{t("home.last14")}</option>
              <option value={30}>{t("home.last30")}</option>
              <option value="custom">{t("home.customRange")}</option>
            </select>
            {preset === "custom" && (
              <div className="col-span-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-inkSoft">
                  {t("home.fromDate")}
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo}
                    onChange={(e) => setCustomFrom(e.target.value || customFrom)}
                    className="h-9 rounded-xl border border-line bg-surface px-2 text-xs text-ink outline-none"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-inkSoft">
                  {t("home.toDate")}
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    onChange={(e) => setCustomTo(e.target.value || customTo)}
                    className="h-9 rounded-xl border border-line bg-surface px-2 text-xs text-ink outline-none"
                  />
                </label>
              </div>
            )}
            <Button size="sm" className="w-full sm:w-auto justify-center" onClick={() => setShowWidgets((v) => !v)}>
              <Sliders size={14} />
              {t("home.customize")}
            </Button>
            <div className="relative w-full sm:w-auto">
              <Button variant="primary" size="sm" className="w-full sm:w-auto justify-center" onClick={() => setShowNew((v) => !v)}>
                <Plus size={14} />
                {t("home.new")}
                <ChevronDown size={12} />
              </Button>
              {showNew && (
                <div className="absolute end-0 top-full z-20 mt-1 w-40 rounded-xl border border-line bg-surface shadow-lg overflow-hidden">
                  <button type="button" className="w-full text-start px-3 py-2 text-xs hover:bg-paperDark" onClick={() => router.push("/projects?new=1")}>
                    {t("home.newProject")}
                  </button>
                  <button type="button" className="w-full text-start px-3 py-2 text-xs hover:bg-paperDark" onClick={() => router.push("/ideas?new=1")}>
                    {t("home.newIdea")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-2.5 sm:gap-3">
          <StatCard title={t("home.totalProjects")} value={scopedProjects.length} change={pctChange(projectsNow, projectsPrev)} color="#6C5CE7" Icon={FolderKanban} spark={sparkProjects} vs={t("home.vsPrev")} />
          <StatCard title={t("home.totalTasks")} value={scopedTasks.length} change={pctChange(createdNow, createdPrev)} color="#3B82F6" Icon={CheckSquare} spark={sparkTasks} vs={t("home.vsPrev")} />
          <StatCard title={t("home.completedTasks")} value={completed} change={pctChange(doneNow, donePrev)} color="#22C55E" Icon={CheckCircle2} spark={sparkDone} vs={t("home.vsPrev")} />
          <StatCard title={t("home.inProgress")} value={inProgress} change={pctChange(progressNow, progressPrev)} color="#F59E0B" Icon={Timer} spark={sparkProgress} vs={t("home.vsPrev")} />
          <StatCard title={t("home.overdue")} value={overdue} change={pctChange(overdueNow, overduePrev)} color="#EF4444" Icon={AlertTriangle} spark={sparkOverdue} vs={t("home.vsPrev")} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title={t("home.tasksOverview")}>
            {scopedTasks.length === 0 ? (
              <p className="text-sm text-inkFaint">{t("board.noTasksYet")}</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 min-w-0">
                <DonutChart
                  size={148}
                  strokeWidth={18}
                  segments={overview.map((item) => ({ value: item.count, color: item.color }))}
                  centerLabel={String(scopedTasks.length)}
                  centerSubLabel={t("home.total")}
                />
                <ul className="w-full min-w-0 space-y-2.5">
                  {overview.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="flex-1 text-inkSoft">{t(item.labelKey)}</span>
                      <span className="font-medium text-ink tabular-nums">{item.count}</span>
                      <span className="text-xs text-inkFaint w-8 text-end">{scopedTasks.length ? Math.round((item.count / scopedTasks.length) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
          <Panel title={t("home.tasksCompleted")} action={<span className="text-[11px] text-inkFaint">{periodLabel}</span>}>
            <BarChart values={sparkDone} labels={keys.map((key) => weekday(key, locale))} color="#6C5CE7" />
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel title={t("home.projectsProgress")}>
            <div className="space-y-3.5">
              {progressRows.length === 0 ? (
                <p className="text-sm text-inkFaint">{t("projects.empty")}</p>
              ) : (
                progressRows.map((row) => (
                  <button key={row.project.id} type="button" onClick={() => router.push(projectPath(row.project.id))} className="w-full text-start">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="h-7 w-7 rounded-lg overflow-hidden inline-flex items-center justify-center" style={row.imageUrl ? undefined : { backgroundColor: `${row.color}22`, color: row.color }}>
                        <ProjectMark
                          icon={row.icon}
                          imageUrl={row.imageUrl}
                          color={row.color}
                          size={28}
                          imageScale={row.imageScale}
                          imageScaleX={row.imageScaleX}
                          imageScaleY={row.imageScaleY}
                          imagePosX={row.imagePosX}
                          imagePosY={row.imagePosY}
                        />
                      </span>
                      <span className="flex-1 text-sm text-ink truncate">{row.project.name}</span>
                      <span className="text-xs tabular-nums text-inkSoft">{row.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-paperDark overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>
          <Panel title={t("home.byPriority")}>
            {scopedTasks.length === 0 ? (
              <p className="text-sm text-inkFaint">{t("board.noTasksYet")}</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 min-w-0">
                <DonutChart
                  size={132}
                  strokeWidth={16}
                  segments={priorities.map((item) => ({ value: item.count, color: item.color }))}
                  centerLabel={String(scopedTasks.length)}
                  centerSubLabel={t("home.total")}
                />
                <ul className="w-full min-w-0 space-y-2">
                  {priorities.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="flex-1 text-inkSoft">{t(item.labelKey)}</span>
                      <span className="font-medium text-ink tabular-nums">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
          <Panel title={t("home.workload")}>
            <div className="space-y-3.5">
              {workload.length === 0 ? (
                <p className="text-sm text-inkFaint">{t("board.noTasksYet")}</p>
              ) : (
                workload.map((row) => (
                  <div key={row.id}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      {row.id === "unassigned" ? (
                        <span className="h-7 w-7 rounded-full bg-paperDark" />
                      ) : (
                        <ClickableAvatar userId={row.id} name={row.name} src={row.avatar} size="xs" />
                      )}
                      <span className="flex-1 text-sm text-ink truncate">{row.name}</span>
                      <span className="text-xs tabular-nums text-inkSoft">{row.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-paperDark overflow-hidden">
                      <div className="h-full rounded-full bg-[#6C5CE7]" style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <Panel title={t("home.activityOverview")}>
          <AreaChart
            labels={keys.map((key) => weekday(key, locale))}
            series={[
              { label: t("home.created"), color: "#6C5CE7", values: sparkTasks },
              { label: t("home.completedLine"), color: "#22C55E", values: sparkDone },
              { label: t("home.comments"), color: "#3B82F6", values: countsForDays(scopedComments.map((c) => c.created_at), keys) },
              { label: t("home.files"), color: "#F97316", values: countsForDays(files.map((row) => row.created_at), keys) },
            ]}
          />
        </Panel>
      </div>

      {showWidgets && (
        <aside className="min-w-0 space-y-4">
          <Panel title={t("home.myTasks")}>
            {myTasks.length === 0 ? (
              <p className="text-sm text-inkFaint">{t("home.noMyTasks")}</p>
            ) : (
              <ul className="space-y-2.5">
                {myTasks.map((task) => {
                  const pr = priorityOf(task);
                  const color = pr === "high" ? "#EF4444" : pr === "medium" ? "#F97316" : "#22C55E";
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => router.push(`${projectPath(task.project_id)}?task=${task.id}`)} className="w-full flex items-start gap-2.5 text-start">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink truncate">{task.title}</span>
                          <span className="block text-[11px] text-inkFaint truncate">{projectById.get(task.project_id)?.name}</span>
                        </span>
                        <span className="text-[11px] text-inkFaint shrink-0">{dueLabel(task.due_date, today, t, locale)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            title={t("home.calendar")}
            action={
              <div className="flex items-center gap-1">
                <button type="button" className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-paperDark" onClick={() => setCursor((d) => addDays(d, -7))}>
                  <Prev size={14} />
                </button>
                <button type="button" className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-paperDark" onClick={() => setCursor((d) => addDays(d, 7))}>
                  <Next size={14} />
                </button>
              </div>
            }
          >
            <p className="text-xs text-inkFaint mb-2">{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor)}</p>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-3 min-w-0">
              {weekDays.map((day) => {
                const key = localYmd(day);
                const active = key === pickedDay;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPickedDay(key)}
                    className={`min-w-0 rounded-lg py-1.5 px-0.5 text-center ${active ? "bg-[#6C5CE7] text-white" : "bg-paperDark text-inkSoft"}`}
                  >
                    <span className="block text-[9px] sm:text-[10px] opacity-80 truncate">{weekday(key, locale)}</span>
                    <span className="block text-xs sm:text-sm font-medium">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-inkFaint">{t("home.noEvents")}</p>
            ) : (
              <ul className="space-y-2">
                {dayEvents.slice(0, 5).map((task) => (
                  <li key={task.id} className="rounded-lg border border-line px-2.5 py-2">
                    <p className="text-sm text-ink truncate">{task.title}</p>
                    <p className="text-[11px] text-inkFaint truncate">
                      {t("home.due")} · {projectById.get(task.project_id)?.name}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("home.recent")}>
            {scopedActivity.length === 0 ? (
              <p className="text-sm text-inkFaint">{t("home.noActivity")}</p>
            ) : (
              <ul className="space-y-3">
                {scopedActivity.slice(0, 6).map((entry) => {
                  const rendered = renderActivity(entry, t, session.user.id);
                  return (
                    <li key={entry.id} className="flex gap-2.5">
                      <span className="mt-0.5 h-7 w-7 rounded-full bg-paperDark text-[#6C5CE7] inline-flex items-center justify-center shrink-0">
                        <ListTodo size={13} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-ink leading-snug">
                          {rendered.actorId ? (
                            <ClickableName userId={rendered.actorId} className="font-medium">
                              {rendered.label}
                            </ClickableName>
                          ) : (
                            <span className="font-medium">{rendered.label}</span>
                          )}
                          {rendered.rest}
                        </p>
                        <p className="text-[11px] text-inkFaint mt-0.5">{timeAgo(entry.created_at, t)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </aside>
      )}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-3 sm:p-4 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  title,
  value,
  change,
  color,
  Icon,
  spark,
  vs,
}: {
  title: string;
  value: number;
  change: number;
  color: string;
  Icon: typeof FolderKanban;
  spark: number[];
  vs: string;
}) {
  const up = change >= 0;
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-2.5 sm:p-3.5">
      <div className="flex items-start justify-between gap-1">
        <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-full inline-flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, color }}>
          <Icon size={14} />
        </span>
        <span className="hidden sm:block">
          <Sparkline values={spark} color={color} />
        </span>
      </div>
      <p className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-inkFaint leading-tight line-clamp-2">{title}</p>
      <p className="text-xl sm:text-2xl font-semibold text-ink tabular-nums leading-tight">{value}</p>
      <p className={`mt-1 text-[10px] sm:text-[11px] leading-tight ${up ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
        {up ? "↑" : "↓"} {Math.abs(change)}% <span className="hidden sm:inline">{vs}</span>
      </p>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 72;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.75" points={pts.join(" ")} />
    </svg>
  );
}

function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 sm:gap-2 h-36 sm:h-40 min-w-0 overflow-x-auto">
      {values.map((value, i) => (
        <div key={labels[i] || i} className="flex-1 min-w-[1.35rem] flex flex-col items-center gap-1 h-full justify-end">
          <div
            className="w-full rounded-t-md"
            style={{ height: `${Math.max((value / max) * 100, value > 0 ? 6 : 2)}%`, backgroundColor: color, opacity: value ? 1 : 0.25 }}
          />
          <span className="text-[9px] sm:text-[10px] text-inkFaint truncate max-w-full">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function AreaChart({
  labels,
  series,
}: {
  labels: string[];
  series: { label: string; color: string; values: number[] }[];
}) {
  const w = 640;
  const h = 180;
  const pad = 8;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  function points(values: number[]) {
    return values.map((v, i) => {
      const x = pad + (values.length <= 1 ? 0 : (i / (values.length - 1)) * (w - pad * 2));
      const y = h - pad - (v / max) * (h - pad * 2);
      return { x, y };
    });
  }
  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 sm:h-44 max-w-full" preserveAspectRatio="xMidYMid meet">
        {series.map((s) => {
          const pts = points(s.values);
          const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
          const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
          return (
            <g key={s.label}>
              <polygon points={area} fill={s.color} opacity="0.12" />
              <polyline points={line} fill="none" stroke={s.color} strokeWidth="2" />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-inkSoft">
            <span className="h-1.5 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-inkFaint gap-1 min-w-0">
        {labels.map((label, i) => (
          <span key={`${label}-${i}`} className={i > 0 && i < labels.length - 1 && labels.length > 8 ? "hidden sm:inline truncate" : "truncate"}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function weekday(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${iso}T00:00:00`));
}
