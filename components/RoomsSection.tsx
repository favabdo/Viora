"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, ShieldCheck, DoorOpen, XCircle, ListChecks, RefreshCw, Clock, User } from "lucide-react";
import Button from "./ui/Button";
import { Input } from "./ui/Input";
import { SkeletonList } from "./ui/Skeleton";

type ScheduledTask = {
  id: number;
  contactId: number;
  customerName: string;
  taskText: string;
  agentName: string;
  status: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string | null;
  endedAt: string | null;
  deliveryStatus: string | null;
  assignedToName: string;
  isOverdue: boolean;
  daysRemaining: number | null;
  daysOverdue: number | null;
};

const dateFormatter = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" });

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return dateFormatter.format(new Date(iso));
  } catch {
    return "—";
  }
}

function deliveryBadge(status: string | null): { label: string; className: string } | null {
  if (!status) return null;
  const v = status.trim().toLowerCase();
  if (["on_time", "ontime", "on time", "in_time", "على الميعاد"].includes(v)) {
    return { label: "سُلّمت في الميعاد", className: "bg-sageSoft/60 text-[#3F6136]" };
  }
  if (["late", "delayed", "متأخر", "متأخرة"].includes(v)) {
    return { label: "اتأخرت عن الميعاد", className: "bg-claySoft text-clay" };
  }
  return { label: status, className: "bg-paperDark text-inkSoft" };
}

function remainingLabel(days: number): string {
  if (days === 0) return "مستحقة النهاردة";
  if (days === 1) return "متبقي يوم واحد";
  if (days === 2) return "متبقي يومين";
  if (days >= 3 && days <= 10) return `متبقي ${days} أيام`;
  return `متبقي ${days} يوم`;
}

function overdueLabel(days: number): string {
  if (days === 1) return "متأخرة يوم";
  if (days === 2) return "متأخرة يومين";
  if (days >= 3 && days <= 10) return `متأخرة ${days} أيام`;
  return `متأخرة ${days} يوم`;
}

export default function RoomsSection() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/rooms/auth")
      .then((r) => r.json())
      .then((data) => setUnlocked(Boolean(data.unlocked)))
      .catch(() => setUnlocked(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (unlocked) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  async function loadTasks() {
    setLoadingTasks(true);
    setTasksError("");
    try {
      const res = await fetch("/api/rooms/tasks");
      const data = await res.json();
      if (!res.ok) {
        setTasksError(data.error || "فشل تحميل المهام");
        setTasks([]);
        return;
      }
      setTasks(data.tasks as ScheduledTask[]);
    } catch {
      setTasksError("حصل خطأ أثناء تحميل المهام");
    } finally {
      setLoadingTasks(false);
    }
  }

  async function toggleDone(task: ScheduledTask) {
    if (togglingId) return;
    const nextDone = !task.done;
    setTogglingId(task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t)));
    try {
      const res = await fetch("/api/rooms/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, done: nextDone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTasksError(data.error || "فشل تحديث حالة المهمة");
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
      } else {
        loadTasks();
      }
    } catch {
      setTasksError("حصل خطأ أثناء التحديث");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleUnlock() {
    if (!password) {
      setError("اكتب كلمة المرور الأول");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/rooms/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "كلمة المرور غير صحيحة");
        return;
      }
      setUnlocked(true);
    } catch {
      setError("حصل خطأ، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (a.isOverdue !== b.isOverdue) return Number(b.isOverdue) - Number(a.isOverdue);
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });
  }, [tasks]);

  if (checkingSession) {
    return (
      <div className="py-10">
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paperDark text-inkSoft">
          <Lock size={19} strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-lg font-medium text-ink mb-1.5">قسم Rooms مميز 🔒</h2>
        <p className="text-sm text-inkSoft leading-relaxed max-w-xs mb-5">
          السيكشن ده Premium ومحتاج كلمة مرور خاصة عشان تدخله. اطلبها من صاحب الموقع.
        </p>

        <div className="w-full max-w-xs text-right">
          <label className="block text-sm font-medium text-inkSoft mb-1.5">كلمة المرور</label>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            dir="ltr"
            className="text-left"
            placeholder="••••••••"
          />
          {error && <p className="text-clay text-xs mt-2">{error}</p>}

          <Button variant="primary" fullWidth loading={submitting} onClick={handleUnlock} className="mt-4">
            <DoorOpen size={15} strokeWidth={1.75} />
            دخول
          </Button>
        </div>
      </div>
    );
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const overdueCount = tasks.filter((t) => t.isOverdue).length;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={17} strokeWidth={1.75} className="text-teal" />
          <h2 className="font-display text-lg font-medium text-ink">NIle Chat Scheduled Tasks</h2>
        </div>
        <button
          onClick={loadTasks}
          disabled={loadingTasks}
          className="flex items-center gap-1 text-xs text-inkSoft hover:text-teal transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} strokeWidth={1.75} className={loadingTasks ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {tasks.length > 0 && (
        <p className="text-xs text-inkSoft mb-4">
          {doneCount} من {tasks.length} خلصوا
          {overdueCount > 0 && <span className="text-clay"> — {overdueCount} متأخرة</span>}
        </p>
      )}

      {tasksError && (
        <div className="flex items-start gap-2.5 rounded-md border border-clay/30 bg-claySoft p-3 mb-4 text-sm">
          <XCircle size={16} strokeWidth={1.75} className="text-clay mt-0.5 shrink-0" />
          <p className="text-ink text-xs">{tasksError}</p>
        </div>
      )}

      {loadingTasks && tasks.length === 0 ? (
        <SkeletonList rows={4} />
      ) : tasks.length === 0 && !tasksError ? (
        <div className="flex flex-col items-center text-center py-10 text-inkSoft text-sm">
          <ListChecks size={20} strokeWidth={1.75} className="mb-2 opacity-60" />
          مفيش مهام دلوقتي في الجدول
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sortedTasks.map((task) => {
            const badge = deliveryBadge(task.deliveryStatus);
            return (
              <li
                key={task.id}
                className={`rounded-md border p-3.5 text-sm transition-opacity ${
                  task.done
                    ? "border-line opacity-55"
                    : task.isOverdue
                    ? "border-clay/40 bg-claySoft/20"
                    : "border-line"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => toggleDone(task)}
                    disabled={togglingId === task.id}
                    title={task.done ? "رجّعها لسه مفتوحة" : "علّم إنها خلصت"}
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border cursor-pointer flex items-center justify-center ${
                      task.done ? "bg-teal border-teal" : "border-inkFaint"
                    }`}
                  >
                    {task.done && <span className="h-1.5 w-1.5 rounded-full bg-paper" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-2xs font-medium text-ink bg-paperDark rounded-full px-2 py-0.5">
                        <User size={11} strokeWidth={2} />
                        {task.customerName}
                      </span>
                      {!task.done && task.isOverdue && task.daysOverdue !== null && (
                        <span className="text-2xs font-medium text-clay bg-claySoft rounded-full px-2 py-0.5">
                          {overdueLabel(task.daysOverdue)}
                        </span>
                      )}
                      {!task.done && !task.isOverdue && task.daysRemaining !== null && (
                        <span className="text-2xs font-medium text-inkSoft bg-paperDark rounded-full px-2 py-0.5">
                          {remainingLabel(task.daysRemaining)}
                        </span>
                      )}
                      {badge && (
                        <span className={`text-2xs font-medium rounded-full px-2 py-0.5 ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>

                    <p className={`text-ink leading-relaxed ${task.done ? "line-through" : ""}`}>{task.taskText}</p>

                    <div className="flex items-center gap-3 mt-2 text-2xs text-inkFaint flex-wrap">
                      <span>
                        من: <span className="text-inkSoft">{task.agentName}</span>
                      </span>
                      <span>
                        إلى: <span className="text-inkSoft">{task.assignedToName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={1.75} />
                        اتنشأت {formatDate(task.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={1.75} />
                        تسليم {formatDate(task.dueDate)}
                      </span>
                      {task.done && task.endedAt && <span>خلصت {formatDate(task.endedAt)}</span>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
