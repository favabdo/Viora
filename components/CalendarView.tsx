"use client";

import { useMemo, useState } from "react";
import { supabase, Task } from "@/lib/supabase";
import IconButton from "./ui/IconButton";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/useSettings";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function CalendarView({
  tasks,
  onTasksMutated,
}: {
  tasks: Task[];
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
}) {
  const { t, lang, dir } = useTranslation();
  const { settings } = useSettings();
  const weekStartsOnMonday = settings.weekStart === "monday";
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const key = task.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const undatedTasks = tasks.filter((t2) => !t2.due_date);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const rawOffset = firstOfMonth.getDay(); // 0 = الأحد
    const startOffset = weekStartsOnMonday ? (rawOffset + 6) % 7 : rawOffset;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor, weekStartsOnMonday]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
  const weekdayLabels = useMemo(() => {
    const base = new Date(2024, 0, weekStartsOnMonday ? 8 : 7); // إثنين أو أحد
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
    });
  }, [locale, weekStartsOnMonday]);

  const todayKey = ymd(new Date());

  async function toggleDone(task: Task) {
    onTasksMutated((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, is_done: !t2.is_done } : t2)));
    await supabase.from("tasks").update({ is_done: !task.is_done }).eq("id", task.id);
  }

  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-medium text-ink">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            aria-label={t("board.prevMonth")}
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          >
            <PrevIcon size={14} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            size="sm"
            aria-label={t("board.today")}
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            <span className="text-2xs px-1">{t("board.today")}</span>
          </IconButton>
          <IconButton
            size="sm"
            aria-label={t("board.nextMonth")}
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          >
            <NextIcon size={14} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-line rounded-lg overflow-hidden border border-line">
        {weekdayLabels.map((label) => (
          <div key={label} className="bg-paperDark px-2 py-1.5 text-2xs font-medium text-inkFaint text-center">
            {label}
          </div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={i} className="bg-surface min-h-[90px]" />;
          const key = ymd(day);
          const dayTasks = tasksByDate.get(key) || [];
          const isToday = key === todayKey;
          return (
            <div key={i} className="bg-surface min-h-[90px] p-1.5 flex flex-col gap-1">
              <span
                className={`text-2xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? "bg-teal text-white" : "text-inkFaint"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleDone(task)}
                    className={`text-start text-[10px] leading-tight px-1 py-0.5 rounded truncate transition-opacity ${
                      task.is_done ? "opacity-50 line-through" : ""
                    }`}
                    style={{ backgroundColor: (task.color || "#6b7280") + "22", color: task.color || "rgb(var(--color-inkSoft))" }}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-inkFaint px-1">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undatedTasks.length > 0 && (
        <div className="mt-5">
          <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-2">
            {t("board.noDueDate")}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {undatedTasks.map((task) => (
              <span
                key={task.id}
                className="text-xs px-2 py-1 rounded-full bg-paperDark text-inkSoft"
              >
                {task.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
