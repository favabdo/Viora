"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Plus,
} from "lucide-react";
import { supabase, ActivityEntry, Project, Task } from "@/lib/supabase";
import { normalizeTask } from "@/lib/taskShape";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useAppSession } from "./AppSession";
import { renderActivity } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import { projectPath } from "@/lib/appRoutes";
import VioraSplash from "./ui/VioraSplash";
import Panel from "./ui/Panel";
import PlanUsageBar from "./PlanUsageBar";
import Button from "./ui/Button";
import ClickableName from "./ClickableName";
import { addDays, dueLabel, localYmd, priorityOf, startOfDay } from "@/lib/homeDashboard";

export default function HomeDashboard() {
  const router = useRouter();
  const { t, lang, dir } = useTranslation();
  const { session, userName } = useAppSession();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const today = localYmd(new Date());
  const firstName = (userName || "").trim().split(/\s+/)[0] || t("common.you");

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
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
        setActivity([]);
        setLoading(false);
        return;
      }
      const ids = list.map((p) => p.id);
      const [taskRes, actRes] = await Promise.all([
        supabase.from("tasks").select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)").in("project_id", ids),
        supabase
          .from("activity_log")
          .select("id, project_id, task_id, actor_id, actor_name, message, action, action_params, created_at")
          .in("project_id", ids)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (cancelled) return;
      setTasks((taskRes.data || []).map(normalizeTask));
      setActivity((actRes.data || []) as ActivityEntry[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const myOpen = useMemo(
    () => tasks.filter((task) => task.user_id === session.user.id && !task.is_done),
    [tasks, session.user.id]
  );

  const dueToday = useMemo(() => myOpen.filter((task) => task.due_date === today), [myOpen, today]);
  const overdueTasks = useMemo(
    () => myOpen.filter((task) => task.due_date && task.due_date < today).sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")),
    [myOpen, today]
  );
  const weekEndYmd = localYmd(addDays(startOfDay(new Date()), 7));
  const upcomingTasks = useMemo(
    () =>
      myOpen
        .filter((task) => task.due_date && task.due_date > today && task.due_date <= weekEndYmd)
        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")),
    [myOpen, today, weekEndYmd]
  );
  const myTasks = useMemo(() => [...myOpen].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")).slice(0, 6), [myOpen]);

  const weekDays = useMemo(() => {
    const start = addDays(cursor, -((cursor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const dayEvents = tasks.filter((task) => task.due_date === pickedDay);
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;

  function daysLate(due: string): number {
    const a = new Date(`${due}T00:00:00`).getTime();
    const b = new Date(`${today}T00:00:00`).getTime();
    return Math.max(1, Math.round((b - a) / 86400000));
  }

  function scrollToPanel(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function taskRow(task: Task, rightLabel: string, rightClass = "text-inkFaint") {
    const pr = priorityOf(task);
    const dot = pr === "high" ? "#EF4444" : pr === "medium" ? "#3B82F6" : "#22C55E";
    return (
      <li key={task.id}>
        <button type="button" onClick={() => router.push(`${projectPath(task.project_id)}?task=${task.id}`)} className="w-full flex items-start gap-2.5 text-start group">
          <span className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink truncate group-hover:text-[#2563EB] transition-colors">{task.title}</span>
            <span className="block text-[11px] text-inkFaint truncate">{projectById.get(task.project_id)?.name}</span>
          </span>
          <span className={`text-[11px] shrink-0 tabular-nums ${rightClass}`}>{rightLabel}</span>
        </button>
      </li>
    );
  }

  const glance = [
    { id: "panel-due-today", label: t("home.dueToday"), count: dueToday.length, color: "#2563EB", Icon: CalendarClock, empty: t("home.noDueToday") },
    { id: "panel-overdue", label: t("home.overdue"), count: overdueTasks.length, color: "#EF4444", Icon: AlertTriangle, empty: t("home.noOverdue") },
    { id: "panel-upcoming", label: t("home.upcoming"), count: upcomingTasks.length, color: "#22C55E", Icon: CalendarDays, empty: t("home.noUpcoming") },
  ];

  return (
    <>
      <AnimatePresence>
        {loading && <VioraSplash key="splash" />}
      </AnimatePresence>
      {!loading && (
        <div className="min-w-0 overflow-x-hidden grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
          <div className="min-w-0 space-y-4 sm:space-y-5">
            <PlanUsageBar />
            <div className="space-y-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">{t("home.title")}</h1>
                <p className="mt-1 text-sm font-medium text-ink break-words">{t("home.welcome").replace("{name}", firstName)}</p>
                <p className="text-sm text-inkFaint">{t("home.subtitle")}</p>
              </div>
              <div className="relative w-fit">
                <Button variant="primary" size="sm" onClick={() => setShowNew((v) => !v)}>
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

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {glance.map(({ id, label, count, color, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToPanel(id)}
                  className="min-w-0 rounded-2xl border border-line bg-surface p-2.5 sm:p-3.5 text-start viora-lift"
                >
                  <span className="h-8 w-8 rounded-lg inline-flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>
                    <Icon size={16} />
                  </span>
                  <p className="mt-2 text-2xl sm:text-3xl font-semibold tabular-nums leading-none" style={{ color: count ? color : "rgb(var(--color-inkFaint))" }}>
                    {count}
                  </p>
                  <p className="mt-1 text-[11px] sm:text-xs text-inkFaint leading-tight line-clamp-1">{label}</p>
                </button>
              ))}
            </div>

            <div id="panel-due-today" className="scroll-mt-4">
              <Panel
                title={t("home.dueToday")}
                icon={<CalendarClock size={15} />}
                accent="#2563EB"
                action={dueToday.length > 0 ? <span className="text-[11px] font-semibold text-white bg-[#2563EB] rounded-full px-2 py-0.5 tabular-nums">{dueToday.length}</span> : undefined}
              >
                {dueToday.length === 0 ? (
                  <p className="text-sm text-inkFaint">{t("home.noDueToday")}</p>
                ) : (
                  <ul className="space-y-2.5">{dueToday.map((task) => taskRow(task, t("home.today"), "text-[#2563EB] font-medium"))}</ul>
                )}
              </Panel>
            </div>

            <div id="panel-overdue" className="scroll-mt-4">
              <Panel
                title={t("home.overdue")}
                icon={<AlertTriangle size={15} />}
                accent="#EF4444"
                action={overdueTasks.length > 0 ? <span className="text-[11px] font-semibold text-white bg-[#EF4444] rounded-full px-2 py-0.5 tabular-nums">{overdueTasks.length}</span> : undefined}
              >
                {overdueTasks.length === 0 ? (
                  <p className="text-sm text-inkFaint">{t("home.noOverdue")}</p>
                ) : (
                  <ul className="space-y-2.5">
                    {overdueTasks.map((task) => taskRow(task, t("home.daysLate").replace("{n}", String(daysLate(task.due_date!))), "text-[#EF4444] font-medium"))}
                  </ul>
                )}
              </Panel>
            </div>

            <div id="panel-upcoming" className="scroll-mt-4">
              <Panel
                title={t("home.upcoming")}
                icon={<CalendarDays size={15} />}
                accent="#22C55E"
                action={upcomingTasks.length > 0 ? <span className="text-[11px] font-semibold text-white bg-[#22C55E] rounded-full px-2 py-0.5 tabular-nums">{upcomingTasks.length}</span> : undefined}
              >
                {upcomingTasks.length === 0 ? (
                  <p className="text-sm text-inkFaint">{t("home.noUpcoming")}</p>
                ) : (
                  <ul className="space-y-2.5">{upcomingTasks.map((task) => taskRow(task, dueLabel(task.due_date, today, t, locale), "text-inkSoft"))}</ul>
                )}
              </Panel>
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            <Panel title={t("home.myTasks")} icon={<ListTodo size={15} />} accent="#6366F1">
              {myTasks.length === 0 ? (
                <p className="text-sm text-inkFaint">{t("home.noMyTasks")}</p>
              ) : (
                <ul className="space-y-2.5">{myTasks.map((task) => taskRow(task, dueLabel(task.due_date, today, t, locale), "text-inkSoft"))}</ul>
              )}
            </Panel>

            <Panel
              title={t("home.calendar")}
              icon={<CalendarDays size={15} />}
              accent="#14B8A6"
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
                      className={`min-w-0 rounded-lg py-1.5 px-0.5 text-center ${active ? "bg-[#2563EB] text-white" : "bg-paperDark text-inkSoft"}`}
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

            <Panel title={t("home.recent")} icon={<Activity size={15} />} accent="#3B82F6">
              {activity.length === 0 ? (
                <p className="text-sm text-inkFaint">{t("home.noActivity")}</p>
              ) : (
                <ul className="space-y-3">
                  {activity.slice(0, 8).map((entry) => {
                    const rendered = renderActivity(entry, t, session.user.id);
                    return (
                      <li key={entry.id} className="flex gap-2.5">
                        <span className="mt-0.5 h-7 w-7 rounded-full bg-paperDark text-[#2563EB] inline-flex items-center justify-center shrink-0">
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
        </div>
      )}
    </>
  );
}

function weekday(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${iso}T00:00:00`));
}
