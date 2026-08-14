"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, ShieldCheck, DoorOpen, XCircle, ListChecks, RefreshCw, Clock, User, ChevronDown, History } from "lucide-react";
import Button from "./ui/Button";
import { Input } from "./ui/Input";
import { SkeletonList } from "./ui/Skeleton";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type HistoryEntry = {
  id: number;
  taskId: number;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  changedByName: string;
  changedAt: string | null;
};

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
  history: HistoryEntry[];
};

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
      new Date(iso)
    );
  } catch {
    return "—";
  }
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

const FIELD_KEY_MAP: Record<string, string> = {
  assigned_to: "rooms.field.assigned_to",
  customer: "rooms.field.customer",
  task_text: "rooms.field.task_text",
};

export default function RoomsSection() {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const [checkingSession, setCheckingSession] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  function deliveryBadge(status: string | null): { label: string; className: string } | null {
    if (!status) return null;
    const v = status.trim().toLowerCase();
    if (["on_time", "ontime", "on time", "in_time", "على الميعاد"].includes(v)) {
      return { label: t("rooms.onTime"), className: "bg-sageSoft/60 text-[#3F6136]" };
    }
    if (["late", "delayed", "متأخر", "متأخرة"].includes(v)) {
      return { label: t("rooms.late"), className: "bg-claySoft text-clay" };
    }
    return { label: status, className: "bg-paperDark text-inkSoft" };
  }

  function remainingLabel(days: number): string {
    if (days === 0) return t("rooms.dueToday");
    if (days === 1) return t("rooms.remaining1");
    if (days === 2) return t("rooms.remaining2");
    return t("rooms.remainingN").replace("{n}", String(days));
  }

  function overdueLabel(days: number): string {
    if (days === 1) return t("rooms.overdue1");
    if (days === 2) return t("rooms.overdue2");
    return t("rooms.overdueN").replace("{n}", String(days));
  }

  function fieldLabelFor(entry: HistoryEntry): string {
    const key = FIELD_KEY_MAP[entry.fieldName];
    return key ? t(key) : entry.fieldLabel;
  }

  function toggleHistory(taskId: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

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
        setTasksError(data.error || t("rooms.err.loadFailed"));
        setTasks([]);
        return;
      }
      setTasks(data.tasks as ScheduledTask[]);
    } catch {
      setTasksError(t("rooms.err.loadFailedGeneric"));
    } finally {
      setLoadingTasks(false);
    }
  }

  async function toggleDone(task: ScheduledTask) {
    if (togglingId) return;
    const nextDone = !task.done;
    setTogglingId(task.id);
    setTasks((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, done: nextDone } : t2)));
    try {
      const res = await fetch("/api/rooms/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, done: nextDone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTasksError(data.error || t("rooms.err.updateFailed"));
        setTasks((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, done: task.done } : t2)));
      } else {
        loadTasks();
      }
    } catch {
      setTasksError(t("rooms.err.updateFailedGeneric"));
      setTasks((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, done: task.done } : t2)));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleUnlock() {
    if (!password) {
      setError(t("rooms.err.enterPasswordFirst"));
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
        setError(data.error || t("rooms.err.wrongPassword"));
        return;
      }
      setUnlocked(true);
    } catch {
      setError(t("rooms.err.generic"));
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
        <h2 className="font-display text-lg font-medium text-ink mb-1.5">{t("rooms.lockedTitle")}</h2>
        <p className="text-sm text-inkSoft leading-relaxed max-w-xs mb-5">{t("rooms.lockedHint")}</p>

        <div className="w-full max-w-xs text-start">
          <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("rooms.password")}</label>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            dir="ltr"
            className="text-end"
            placeholder="••••••••"
          />
          {error && <p className="text-clay text-xs mt-2">{error}</p>}

          <Button variant="primary" fullWidth loading={submitting} onClick={handleUnlock} className="mt-4">
            <DoorOpen size={15} strokeWidth={1.75} />
            {t("rooms.enter")}
          </Button>
        </div>
      </div>
    );
  }

  const doneCount = tasks.filter((t2) => t2.done).length;
  const overdueCount = tasks.filter((t2) => t2.isOverdue).length;

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
          {t("rooms.refresh")}
        </button>
      </div>

      {tasks.length > 0 && (
        <p className="text-xs text-inkSoft mb-4">
          {t("rooms.doneOf").replace("{done}", String(doneCount)).replace("{total}", String(tasks.length))}
          {overdueCount > 0 && (
            <span className="text-clay"> — {t("rooms.overdueSuffix").replace("{count}", String(overdueCount))}</span>
          )}
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
          {t("rooms.noTasks")}
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
                    title={task.done ? t("rooms.markOpen") : t("rooms.markDone")}
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
                        {t("rooms.from")}: <span className="text-inkSoft">{task.agentName}</span>
                      </span>
                      <span>
                        {t("rooms.to")}: <span className="text-inkSoft">{task.assignedToName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={1.75} />
                        {t("rooms.created")} {formatDate(task.createdAt, locale)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={1.75} />
                        {t("rooms.due")} {formatDate(task.dueDate, locale)}
                      </span>
                      {task.done && task.endedAt && (
                        <span>
                          {t("rooms.completed")} {formatDate(task.endedAt, locale)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => toggleHistory(task.id)}
                      className="flex items-center gap-1 text-2xs text-inkFaint hover:text-teal transition-colors mt-2"
                    >
                      <History size={11} strokeWidth={1.75} />
                      {t("rooms.history")} {task.history.length > 0 && `(${task.history.length})`}
                      <ChevronDown
                        size={11}
                        strokeWidth={1.75}
                        className={`transition-transform ${expandedIds.has(task.id) ? "rotate-180" : ""}`}
                      />
                    </button>

                    {expandedIds.has(task.id) && (
                      <div className="mt-2 rounded-md bg-paperDark/50 p-2.5">
                        {task.history.length === 0 ? (
                          <p className="text-2xs text-inkFaint">{t("rooms.noHistoryChanges")}</p>
                        ) : (
                          <ul className="space-y-2">
                            {task.history.map((entry) => (
                              <li key={entry.id} className="text-2xs">
                                <p className="text-inkSoft">
                                  <span className="text-ink font-medium">{entry.changedByName}</span> {t("rooms.edited")}{" "}
                                  {fieldLabelFor(entry)}
                                </p>
                                <p className="mt-0.5">
                                  {entry.oldValue && (
                                    <span className="text-inkFaint line-through me-1.5">{entry.oldValue}</span>
                                  )}
                                  {entry.newValue && <span className="text-ink">{entry.newValue}</span>}
                                </p>
                                <p className="text-inkFaint mt-0.5">{formatDateTime(entry.changedAt, locale)}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
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
