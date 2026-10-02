"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CheckSquare, Timer, Users } from "lucide-react";
import { BoardColumn, Project, ProjectMember, Task } from "@/lib/supabase";
import { displayName } from "@/lib/displayName";
import { formatTaskDate } from "@/lib/taskShape";
import { localYmd, statusKind } from "@/lib/homeDashboard";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import DonutChart from "./ui/DonutChart";
import Panel from "./ui/Panel";

export default function ProjectOverview({
  tasks,
  columns,
  members,
  currentUserId,
}: {
  tasks: Task[];
  columns: BoardColumn[];
  members: ProjectMember[];
  currentUserId: string;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const today = localYmd(new Date());

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const total = tasks.length;
  const done = tasks.filter((task) => statusKind(task, columnsById) === "done").length;
  const inProgress = tasks.filter((task) => statusKind(task, columnsById) === "progress").length;
  const overdue = tasks.filter((task) => !task.is_done && task.due_date && task.due_date < today).length;
  const completionPct = total ? Math.round((done / total) * 100) : 0;

  const byColumn = useMemo(() => {
    return columns
      .map((column) => ({
        column,
        count: tasks.filter((task) => task.column_id === column.id).length,
      }))
      .filter((row) => row.count > 0);
  }, [columns, tasks]);

  const upcoming = useMemo(
    () =>
      tasks
        .filter((task) => task.due_date && !task.is_done)
        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
        .slice(0, 5),
    [tasks]
  );

  const workload = useMemo(() => {
    const rows = members.map((member) => {
      const open = tasks.filter((task) => task.user_id === member.user_id && !task.is_done).length;
      return {
        id: member.user_id,
        name: displayName(member.user_id, member.profiles, currentUserId, t("common.you")),
        avatar: member.profiles?.avatar_url || null,
        open,
      };
    });
    const unassigned = tasks.filter((task) => !task.user_id && !task.is_done).length;
    if (unassigned > 0) rows.push({ id: "unassigned", name: t("home.unassigned"), avatar: null, open: unassigned });
    const sorted = rows.sort((a, b) => b.open - a.open).slice(0, 6);
    const max = Math.max(...sorted.map((row) => row.open), 1);
    return sorted.map((row) => ({ ...row, pct: Math.round((row.open / max) * 100) }));
  }, [members, tasks, currentUserId, t]);

  const stats = [
    { label: t("home.totalTasks"), value: total, color: "#2563EB", Icon: CheckSquare, sub: "" },
    { label: t("home.completedTasks"), value: done, color: "#22C55E", Icon: CheckCircle2, sub: `${completionPct}%` },
    { label: t("home.inProgress"), value: inProgress, color: "#F59E0B", Icon: Timer, sub: "" },
    { label: t("home.overdue"), value: overdue, color: "#EF4444", Icon: AlertTriangle, sub: "" },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {stats.map(({ label, value, color, Icon, sub }) => (
          <div key={label} className="min-w-0 rounded-2xl border border-line bg-surface p-3 sm:p-4 viora-lift">
            <div className="flex items-center justify-between">
              <span className="h-8 w-8 rounded-lg inline-flex items-center justify-center" style={{ backgroundColor: `${color}1f`, color }}>
                <Icon size={16} />
              </span>
              {sub && <span className="text-[11px] font-medium tabular-nums" style={{ color }}>{sub}</span>}
            </div>
            <p className="mt-2.5 text-2xl sm:text-3xl font-semibold text-ink tabular-nums leading-none">{value}</p>
            <p className="mt-1 text-[11px] sm:text-xs text-inkFaint leading-tight line-clamp-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel title={t("board.tasksOverview")} icon={<CheckSquare size={15} />} accent="#2563EB">
          {total === 0 ? (
            <p className="text-sm text-inkFaint">{t("board.noTasksYet")}</p>
          ) : (
            <div className="flex items-center gap-4 min-w-0">
              <DonutChart
                size={120}
                strokeWidth={15}
                segments={byColumn.map((row) => ({ value: row.count, color: row.column.color }))}
                centerLabel={String(total)}
                centerSubLabel={t("board.tasksCount")}
              />
              <ul className="flex-1 min-w-0 space-y-1.5">
                {byColumn.map(({ column, count }) => (
                  <li key={column.id} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                    <span className="text-inkSoft flex-1 truncate">{column.name}</span>
                    <span className="text-ink font-medium tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title={t("board.upcomingDeadlines")} icon={<CalendarClock size={15} />} accent="#F59E0B">
          {upcoming.length === 0 ? (
            <p className="text-sm text-inkFaint">{t("board.noDeadlines")}</p>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((task) => (
                <li key={task.id} className="flex items-center gap-2.5 text-sm">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: task.color || "#64748B" }} />
                  <span className="flex-1 truncate text-ink">{task.title}</span>
                  <span className="text-[11px] text-inkFaint shrink-0 tabular-nums">{formatTaskDate(task.due_date, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("home.workload")} icon={<Users size={15} />} accent="#6366F1">
          {workload.length === 0 ? (
            <p className="text-sm text-inkFaint">{t("board.noTasksYet")}</p>
          ) : (
            <div className="space-y-3">
              {workload.map((row) => (
                <div key={row.id}>
                  <div className="flex items-center gap-2 mb-1">
                    {row.id === "unassigned" ? (
                      <span className="h-6 w-6 rounded-full bg-paperDark shrink-0" />
                    ) : (
                      <span className="h-6 w-6 rounded-full shrink-0 text-[10px] font-semibold text-white inline-flex items-center justify-center" style={{ backgroundColor: "#2563EB" }}>
                        {row.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="flex-1 text-xs text-ink truncate">{row.name}</span>
                    <span className="text-[11px] tabular-nums text-inkSoft">{row.open}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-paperDark overflow-hidden">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
