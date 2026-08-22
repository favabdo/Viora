"use client";

import { useEffect, useState } from "react";
import { supabase, Project, Task, BoardColumn } from "@/lib/supabase";
import ClickableName from "./ClickableName";
import DonutChart from "./ui/DonutChart";
import { CalendarClock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function BoardAnalytics({
  projects,
  activeProjectId,
  tasks,
  columns,
  compact,
  layout,
}: {
  projects: Project[];
  activeProjectId: string;
  tasks: Task[];
  columns: BoardColumn[];
  compact?: boolean;
  layout?: "default" | "workspace";
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [progressByProject, setProgressByProject] = useState<Record<string, { done: number; total: number }>>({});

  useEffect(() => {
    if (projects.length === 0) return;
    supabase
      .from("tasks")
      .select("project_id, is_done")
      .in(
        "project_id",
        projects.map((p) => p.id)
      )
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Record<string, { done: number; total: number }> = {};
        for (const row of data as { project_id: string; is_done: boolean }[]) {
          if (!map[row.project_id]) map[row.project_id] = { done: 0, total: 0 };
          map[row.project_id].total += 1;
          if (row.is_done) map[row.project_id].done += 1;
        }
        setProgressByProject(map);
      });
  }, [projects]);

  const tasksByColumnCount = columns.map((col) => ({
    column: col,
    count: tasks.filter((t2) => t2.column_id === col.id).length,
  }));

  const upcomingDeadlines = tasks
    .filter((t2) => t2.due_date && !t2.is_done)
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 5);

  const gridClass =
    layout === "workspace"
      ? "grid grid-cols-1 md:grid-cols-3 gap-4"
      : compact
        ? "flex flex-col gap-4"
        : "grid grid-cols-1 md:grid-cols-2 gap-4 mt-6";

  return (
    <div className={gridClass}>
      {/* توزيع المهام حسب الحالة */}
      <div className="bg-surface border border-line rounded-lg p-4">
        <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">
          {t("board.tasksOverview")}
        </h4>
        {tasks.length === 0 ? (
          <p className="text-sm text-inkFaint">{t("board.noTasksYet")}</p>
        ) : compact ? (
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              segments={tasksByColumnCount.map((c) => ({ value: c.count, color: c.column.color }))}
              size={100}
              strokeWidth={13}
              centerLabel={String(tasks.length)}
              centerSubLabel={t("board.tasksCount")}
            />
            <ul className="w-full space-y-1.5">
              {tasksByColumnCount.map(({ column, count }) => (
                <li key={column.id} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                  <span className="text-inkSoft flex-1 truncate">{column.name}</span>
                  <span className="text-ink font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <DonutChart
              segments={tasksByColumnCount.map((c) => ({ value: c.count, color: c.column.color }))}
              centerLabel={String(tasks.length)}
              centerSubLabel={t("board.tasksCount")}
            />
            <ul className="flex-1 space-y-1.5">
              {tasksByColumnCount.map(({ column, count }) => (
                <li key={column.id} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                  <span className="text-inkSoft flex-1 truncate">{column.name}</span>
                  <span className="text-ink font-medium">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* تقدّم المشاريع */}
      <div className="bg-surface border border-line rounded-lg p-4">
        <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">
          {t("board.projectProgress")}
        </h4>
        <ul className="space-y-3">
          {projects.map((p) => {
            const stats = progressByProject[p.id];
            const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            return (
              <li key={p.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`truncate ${p.id === activeProjectId ? "text-ink font-medium" : "text-inkSoft"}`}>
                    {p.name}
                  </span>
                  <span className="text-inkFaint shrink-0">{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-paperDark overflow-hidden">
                  <div className="h-full bg-teal rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* أقرب المواعيد */}
      <div className={`bg-surface border border-line rounded-lg p-4 ${compact || layout === "workspace" ? "" : "md:col-span-2"}`}>
        <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">
          {t("board.upcomingDeadlines")}
        </h4>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-sm text-inkFaint">{t("board.noDeadlines")}</p>
        ) : (
          <ul className="space-y-2">
            {upcomingDeadlines.map((task) => (
              <li key={task.id} className="flex items-center gap-2.5 text-sm">
                <CalendarClock size={14} strokeWidth={1.75} className="text-inkFaint shrink-0" />
                <span className="flex-1 truncate text-ink">{task.title}</span>
                <span className="text-xs text-inkFaint shrink-0">{formatDate(task.due_date as string, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
