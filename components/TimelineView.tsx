"use client";

import { useMemo } from "react";
import { supabase, Task } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function TimelineView({
  tasks,
  onTasksMutated,
}: {
  tasks: Task[];
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const key = task.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  const undated = tasks.filter((t2) => !t2.due_date);
  const todayKey = new Date().toISOString().slice(0, 10);

  async function toggleDone(task: Task) {
    onTasksMutated((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, is_done: !t2.is_done } : t2)));
    await supabase.from("tasks").update({ is_done: !task.is_done }).eq("id", task.id);
  }

  if (groups.length === 0 && undated.length === 0) {
    return <p className="text-sm text-inkFaint text-center py-10">{t("board.noDueDate")}</p>;
  }

  return (
    <div>
      <div className="relative ps-6">
        <div className="absolute inset-y-0 start-[9px] w-px bg-line" />
        {groups.map(([dateKey, dayTasks]) => {
          const date = new Date(dateKey);
          const isPast = dateKey < todayKey;
          const isToday = dateKey === todayKey;
          return (
            <div key={dateKey} className="relative mb-5">
              <span
                className={`absolute -start-6 top-0.5 h-4 w-4 rounded-full border-2 ${
                  isToday ? "bg-teal border-teal" : isPast ? "bg-paperDark border-line" : "bg-surface border-teal"
                }`}
              />
              <p className={`text-sm font-medium mb-2 ${isToday ? "text-teal" : "text-ink"}`}>
                {new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(date)}
              </p>
              <div className="flex flex-col gap-1.5">
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleDone(task)}
                    className={`flex items-center gap-2 text-start rounded-md border border-line bg-surface px-3 py-2 text-sm transition-opacity hover:border-teal/40 ${
                      task.is_done ? "opacity-50 line-through" : ""
                    }`}
                  >
                    {task.color && (
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
                    )}
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="mt-6 pt-5 border-t border-line">
          <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-2">
            {t("board.noDueDate")}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((task) => (
              <span key={task.id} className="text-xs px-2 py-1 rounded-full bg-paperDark text-inkSoft">
                {task.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
