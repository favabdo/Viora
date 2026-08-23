"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  ShieldCheck,
  DoorOpen,
  XCircle,
  ListChecks,
  RefreshCw,
  Clock,
  User,
  ChevronDown,
  History,
  Plus,
  MessageCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import Button from "./ui/Button";
import { Input, Textarea, fieldClass } from "./ui/Input";
import { SkeletonList } from "./ui/Skeleton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { supabase } from "@/lib/supabase";

type HistoryEntry = {
  id: number;
  taskId: number;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  changedByName: string | null;
  changedAt: string | null;
};

type ScheduledTask = {
  id: number;
  contactId: number;
  customerName: string | null;
  taskText: string;
  agentName: string | null;
  status: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string | null;
  endedAt: string | null;
  deliveryStatus: string | null;
  assignedToName: string | null;
  isOverdue: boolean;
  daysRemaining: number | null;
  daysOverdue: number | null;
  history: HistoryEntry[];
  approvalStatus: string;
  isPending: boolean;
  pendingChanges: { updates?: Record<string, unknown>; historyEntries?: any[] } | null;
  pendingChangedByName: string | null;
  pendingChangedAt: string | null;
};

type Comment = {
  id: number;
  taskId: number;
  commentText: string;
  createdByName: string | null;
  createdAt: string | null;
};

type Agent = { id: number; name: string };
type Contact = { id: number; name: string };

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
  status: "rooms.field.status",
  due_date: "rooms.field.due_date",
};

type RoomsFilter = "open" | "all" | "pending";

export default function RoomsSection({
  currentUserId,
  initialFilter,
}: {
  currentUserId: string;
  initialFilter?: RoomsFilter;
}) {
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

  const [nilechatLink, setNilechatLink] = useState<{ agentId: number; agentName: string } | null>(null);
  const [filter, setFilter] = useState<RoomsFilter>(initialFilter || "open");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  // كومنتات
  const [commentsOpenIds, setCommentsOpenIds] = useState<Set<number>>(new Set());
  const [commentsByTask, setCommentsByTask] = useState<Record<number, Comment[]>>({});
  const [loadingCommentsFor, setLoadingCommentsFor] = useState<number | null>(null);
  const [newCommentByTask, setNewCommentByTask] = useState<Record<number, string>>({});
  const [postingCommentFor, setPostingCommentFor] = useState<number | null>(null);
  const [commentErrorByTask, setCommentErrorByTask] = useState<Record<number, string>>({});

  // نموذج مهمة جديدة
  const [showNewTask, setShowNewTask] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState<number | "">("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskError, setNewTaskError] = useState("");

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

  function errText(data: { errorCode?: string; error?: string; detail?: string }, fallbackKey: string): string {
    const base = data?.errorCode ? t(`rooms.errCode.${data.errorCode}`) : data?.error || t(fallbackKey);
    return data?.detail ? `${base} (${data.detail})` : base;
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

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("nilechat_links")
      .select("agent_id, agent_name")
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNilechatLink({ agentId: data.agent_id, agentName: data.agent_name });
      });
  }, [currentUserId]);

  // بحث العملاء (debounced) وقت فتح نموذج المهمة الجديدة
  useEffect(() => {
    if (!showNewTask) return;
    const handle = setTimeout(() => {
      fetch(`/api/rooms/contacts?q=${encodeURIComponent(contactQuery)}`)
        .then((r) => r.json())
        .then((data) => setContactResults(data.contacts || []))
        .catch(() => setContactResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [contactQuery, showNewTask]);

  useEffect(() => {
    if (!showNewTask || agents.length > 0) return;
    fetch("/api/rooms/agents")
      .then((r) => r.json())
      .then((data) => setAgents(data.agents || []))
      .catch(() => setAgents([]));
  }, [showNewTask, agents.length]);

  async function loadTasks() {
    setLoadingTasks(true);
    setTasksError("");
    try {
      const res = await fetch("/api/rooms/tasks");
      const data = await res.json();
      if (!res.ok) {
        setTasksError(errText(data, "rooms.err.loadFailed"));
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
    if (togglingId || task.isPending) return;
    if (!nilechatLink) {
      setTasksError(t("rooms.errCode.nilechat_link_required"));
      return;
    }
    const nextDone = !task.done;
    setTogglingId(task.id);
    try {
      const res = await fetch("/api/rooms/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          done: nextDone,
          agentId: nilechatLink.agentId,
          agentName: nilechatLink.agentName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTasksError(errText(data, "rooms.err.updateFailed"));
      } else {
        loadTasks();
      }
    } catch {
      setTasksError(t("rooms.err.updateFailedGeneric"));
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
        setError(errText(data, "rooms.err.wrongPassword"));
        return;
      }
      setUnlocked(true);
    } catch {
      setError(t("rooms.err.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleComments(taskId: number) {
    setCommentsOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    if (!commentsByTask[taskId]) {
      setLoadingCommentsFor(taskId);
      try {
        const res = await fetch(`/api/rooms/comments?taskId=${taskId}`);
        const data = await res.json();
        if (res.ok) {
          setCommentsByTask((prev) => ({ ...prev, [taskId]: data.comments || [] }));
        } else {
          setTasksError(errText(data, "rooms.err.loadCommentsFailed"));
        }
      } catch {
        setTasksError(t("rooms.err.loadCommentsFailed"));
      } finally {
        setLoadingCommentsFor(null);
      }
    }
  }

  async function submitComment(taskId: number) {
    const text = (newCommentByTask[taskId] || "").trim();
    if (!text || !nilechatLink) return;
    setPostingCommentFor(taskId);
    setCommentErrorByTask((prev) => ({ ...prev, [taskId]: "" }));
    try {
      const res = await fetch("/api/rooms/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          commentText: text,
          createdById: nilechatLink.agentId,
          createdByName: nilechatLink.agentName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentErrorByTask((prev) => ({ ...prev, [taskId]: errText(data, "rooms.err.addCommentFailed") }));
        return;
      }
      setCommentsByTask((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), data.comment] }));
      setNewCommentByTask((prev) => ({ ...prev, [taskId]: "" }));
    } catch {
      setCommentErrorByTask((prev) => ({ ...prev, [taskId]: t("rooms.err.addCommentFailed") }));
    } finally {
      setPostingCommentFor(null);
    }
  }

  async function submitNewTask() {
    setNewTaskError("");
    if (!selectedContact || !newTaskText.trim() || !newDueDate || !nilechatLink) {
      setNewTaskError(t("rooms.err.missingFields"));
      return;
    }
    setCreatingTask(true);
    try {
      const assignee = agents.find((a) => a.id === newAssigneeId);
      const res = await fetch("/api/rooms/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          customerName: selectedContact.name,
          taskText: newTaskText.trim(),
          dueDate: newDueDate,
          assignedToId: assignee?.id ?? null,
          assignedToName: assignee?.name ?? null,
          agentId: nilechatLink.agentId,
          agentName: nilechatLink.agentName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewTaskError(errText(data, "rooms.err.createFailed"));
        return;
      }
      setShowNewTask(false);
      setSelectedContact(null);
      setContactQuery("");
      setNewTaskText("");
      setNewDueDate("");
      setNewAssigneeId("");
      loadTasks();
    } catch {
      setNewTaskError(t("rooms.err.createFailed"));
    } finally {
      setCreatingTask(false);
    }
  }

  async function approveTask(taskId: number) {
    if (approvingId) return;
    setApprovingId(taskId);
    try {
      const res = await fetch("/api/rooms/tasks/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTasksError(errText(data, "rooms.err.approveFailed"));
        return;
      }
      loadTasks();
    } catch {
      setTasksError(t("rooms.err.approveFailed"));
    } finally {
      setApprovingId(null);
    }
  }

  async function dismissTask(taskId: number) {
    if (dismissingId) return;
    setDismissingId(taskId);
    try {
      const res = await fetch("/api/rooms/tasks/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTasksError(errText(data, "rooms.err.dismissFailed"));
        return;
      }
      loadTasks();
    } catch {
      setTasksError(t("rooms.err.dismissFailed"));
    } finally {
      setDismissingId(null);
    }
  }

  const sortedTasks = useMemo(() => {
    // "المفتوحة" (افتراضي): كل المهام اللي لسه مخلصتش، بما فيها اللي عليها طلب معلّق
    // "الكل": كل المهام من غير استثناء
    // "المعلّقة": المهام المفتوحة اللي عليها طلب بانتظار الاعتماد بس
    const base =
      filter === "pending"
        ? tasks.filter((t2) => t2.isPending && !t2.done)
        : filter === "open"
        ? tasks.filter((t2) => !t2.done)
        : tasks;
    return [...base].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      if (a.isOverdue !== b.isOverdue) return Number(b.isOverdue) - Number(a.isOverdue);
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });
  }, [tasks, filter]);

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
  const pendingTasksCount = tasks.filter((t2) => t2.isPending && !t2.done).length;
  const openTasksCount = tasks.filter((t2) => !t2.done).length;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={17} strokeWidth={1.75} className="text-teal" />
          <h2 className="font-display text-lg font-medium text-ink">NIle Chat Scheduled Tasks</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewTask((v) => !v)}
            className="flex items-center gap-1 text-xs text-teal hover:text-tealDark transition-colors font-medium"
          >
            <Plus size={13} strokeWidth={2} />
            {t("rooms.newTask")}
          </button>
          <button
            onClick={loadTasks}
            disabled={loadingTasks}
            className="flex items-center gap-1 text-xs text-inkSoft hover:text-teal transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} strokeWidth={1.75} className={loadingTasks ? "animate-spin" : ""} />
            {t("rooms.refresh")}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-line p-0.5 mb-4 w-fit">
        {(
          [
            ["open", t("rooms.filter.open"), openTasksCount],
            ["all", t("rooms.filter.all"), tasks.length],
            ["pending", t("rooms.filter.pending"), pendingTasksCount],
          ] as [RoomsFilter, string, number][]
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              filter === key ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:text-ink"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  key === "pending" ? "bg-clay text-white" : "bg-paperDark text-inkSoft"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {showNewTask && (
        <div className="rounded-md border border-line p-4 mt-4 mb-4">
          {!nilechatLink ? (
            <div className="text-center py-4">
              <p className="text-sm font-medium text-ink mb-1">{t("rooms.mustLinkTitle")}</p>
              <p className="text-xs text-inkSoft mb-3 leading-relaxed">{t("rooms.mustLinkHint")}</p>
              <Link href="/profile" className="text-xs text-teal hover:text-tealDark font-medium">
                {t("rooms.goToProfile")}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-inkSoft mb-1">{t("rooms.customer")}</label>
                {selectedContact ? (
                  <div className="flex items-center justify-between rounded-md bg-paperDark px-3 py-2 text-sm">
                    <span>{selectedContact.name}</span>
                    <button
                      onClick={() => {
                        setSelectedContact(null);
                        setContactQuery("");
                      }}
                      className="text-inkFaint hover:text-clay"
                    >
                      <XCircle size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      value={contactQuery}
                      onChange={(e) => setContactQuery(e.target.value)}
                      placeholder={t("rooms.searchCustomer")}
                      className="text-sm"
                    />
                    {contactQuery && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-line bg-surface shadow-sm max-h-48 overflow-y-auto">
                        {contactResults.length === 0 ? (
                          <p className="text-xs text-inkFaint px-3 py-2">{t("rooms.noCustomersFound")}</p>
                        ) : (
                          contactResults.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedContact(c);
                                setContactQuery("");
                                setContactResults([]);
                              }}
                              className="w-full text-start px-3 py-2 text-sm hover:bg-paperDark transition-colors"
                            >
                              {c.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Textarea
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder={t("rooms.taskTextPlaceholder")}
                rows={2}
              />

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-inkSoft mb-1">{t("rooms.dueDate")}</label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-inkSoft mb-1">{t("rooms.assignTo")}</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value ? Number(e.target.value) : "")}
                    className={fieldClass}
                  >
                    <option value="">—</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => setNewAssigneeId(nilechatLink.agentId)}
                className="text-2xs text-teal hover:text-tealDark"
              >
                {t("rooms.assignToMe")}
              </button>

              {newTaskError && <p className="text-clay text-xs">{newTaskError}</p>}

              <Button variant="primary" fullWidth loading={creatingTask} onClick={submitNewTask}>
                {t("rooms.createTask")}
              </Button>
            </div>
          )}
        </div>
      )}

      {tasks.length > 0 && (
        <p className="text-xs text-inkSoft mb-4 mt-3">
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
      ) : sortedTasks.length === 0 && filter === "pending" ? (
        <div className="flex flex-col items-center text-center py-10 text-inkSoft text-sm">
          <ListChecks size={20} strokeWidth={1.75} className="mb-2 opacity-60" />
          {t("rooms.noPendingTasks")}
        </div>
      ) : sortedTasks.length === 0 && filter === "open" ? (
        <div className="flex flex-col items-center text-center py-10 text-inkSoft text-sm">
          <ListChecks size={20} strokeWidth={1.75} className="mb-2 opacity-60" />
          {t("rooms.noOpenTasks")}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sortedTasks.map((task) => {
            const badge = deliveryBadge(task.deliveryStatus);
            const taskComments = commentsByTask[task.id] || [];
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
                    disabled={togglingId === task.id || task.isPending}
                    title={
                      task.isPending
                        ? t("rooms.pendingBadge")
                        : task.done
                        ? t("rooms.markOpen")
                        : t("rooms.markDone")
                    }
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${
                      task.isPending ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    } ${task.done ? "bg-teal border-teal" : "border-inkFaint"}`}
                  >
                    {task.done && <span className="h-1.5 w-1.5 rounded-full bg-paper" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-2xs font-medium text-ink bg-paperDark rounded-full px-2 py-0.5">
                        <User size={11} strokeWidth={2} />
                        {task.customerName || t("rooms.unnamedCustomer")}
                      </span>
                      {task.isPending && (
                        <span className="text-2xs font-medium text-[#8A5A00] bg-[#FCEFC7] rounded-full px-2 py-0.5">
                          {t("rooms.pendingBadge")}
                        </span>
                      )}
                      {task.isPending && nilechatLink && (
                        <>
                          <button
                            onClick={() => approveTask(task.id)}
                            disabled={approvingId === task.id || dismissingId === task.id}
                            className="text-2xs font-medium text-white bg-teal hover:bg-tealDark rounded-full px-2 py-0.5 transition-colors disabled:opacity-50"
                          >
                            {t("rooms.approve")}
                          </button>
                          <button
                            onClick={() => dismissTask(task.id)}
                            disabled={approvingId === task.id || dismissingId === task.id}
                            className="text-2xs font-medium text-inkSoft border border-line hover:bg-paperDark rounded-full px-2 py-0.5 transition-colors disabled:opacity-50"
                          >
                            {t("rooms.dismiss")}
                          </button>
                        </>
                      )}
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
                        {t("rooms.from")}: <span className="text-inkSoft">{task.agentName || t("rooms.unknownPerson")}</span>
                      </span>
                      <span>
                        {t("rooms.to")}: <span className="text-inkSoft">{task.assignedToName || t("rooms.unknownPerson")}</span>
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

                    {task.isPending && (
                      <p className="text-2xs text-[#8A5A00] mt-1.5">
                        {task.pendingChanges?.updates?.status
                          ? t("rooms.pendingStatusChange").replace(
                              "{status}",
                              task.pendingChanges.updates.status === "ended"
                                ? t("rooms.statusEnded")
                                : t("rooms.statusOpen")
                            )
                          : t("rooms.pendingNewTask")}
                        {task.pendingChangedByName &&
                          ` — ${t("rooms.pendingRequestedBy").replace("{name}", task.pendingChangedByName)}`}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => toggleHistory(task.id)}
                        className="flex items-center gap-1 text-2xs text-inkFaint hover:text-teal transition-colors"
                      >
                        <History size={11} strokeWidth={1.75} />
                        {t("rooms.history")} {task.history.length > 0 && `(${task.history.length})`}
                        <ChevronDown
                          size={11}
                          strokeWidth={1.75}
                          className={`transition-transform ${expandedIds.has(task.id) ? "rotate-180" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => toggleComments(task.id)}
                        className="flex items-center gap-1 text-2xs text-inkFaint hover:text-teal transition-colors"
                      >
                        <MessageCircle size={11} strokeWidth={1.75} />
                        {t("rooms.comments")} {taskComments.length > 0 && `(${taskComments.length})`}
                        <ChevronDown
                          size={11}
                          strokeWidth={1.75}
                          className={`transition-transform ${commentsOpenIds.has(task.id) ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>

                    {expandedIds.has(task.id) && (
                      <div className="mt-2 rounded-md bg-paperDark/50 p-2.5">
                        {task.history.length === 0 ? (
                          <p className="text-2xs text-inkFaint">{t("rooms.noHistoryChanges")}</p>
                        ) : (
                          <ul className="space-y-2">
                            {task.history.map((entry) => (
                              <li key={entry.id} className="text-2xs">
                                <p className="text-inkSoft">
                                  <span className="text-ink font-medium">{entry.changedByName || t("rooms.unknownPerson")}</span>{" "}
                                  {t("rooms.edited")} {fieldLabelFor(entry)}
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

                    {commentsOpenIds.has(task.id) && (
                      <div className="mt-2 rounded-md bg-paperDark/50 p-2.5">
                        {loadingCommentsFor === task.id ? (
                          <p className="text-2xs text-inkFaint">{t("common.loading")}</p>
                        ) : taskComments.length === 0 ? (
                          <p className="text-2xs text-inkFaint mb-2">{t("rooms.noComments")}</p>
                        ) : (
                          <ul className="space-y-2 mb-2">
                            {taskComments.map((c) => (
                              <li key={c.id} className="text-2xs">
                                <p className="text-inkSoft">
                                  <span className="text-ink font-medium">{c.createdByName || t("rooms.unknownPerson")}</span>
                                </p>
                                <p className="text-ink mt-0.5">{c.commentText}</p>
                                <p className="text-inkFaint mt-0.5">{formatDateTime(c.createdAt, locale)}</p>
                              </li>
                            ))}
                          </ul>
                        )}

                        {nilechatLink ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Textarea
                                value={newCommentByTask[task.id] || ""}
                                onChange={(e) =>
                                  setNewCommentByTask((prev) => ({ ...prev, [task.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    submitComment(task.id);
                                  }
                                }}
                                placeholder={t("rooms.addCommentPlaceholder")}
                                className="flex-1 text-2xs py-1.5"
                              />
                              <button
                                onClick={() => submitComment(task.id)}
                                disabled={postingCommentFor === task.id || !(newCommentByTask[task.id] || "").trim()}
                                className="text-teal hover:text-tealDark disabled:opacity-40 shrink-0"
                              >
                                <Send size={14} strokeWidth={1.75} />
                              </button>
                            </div>
                            {commentErrorByTask[task.id] && (
                              <p className="text-clay text-2xs mt-1.5">{commentErrorByTask[task.id]}</p>
                            )}
                          </div>
                        ) : (
                          <Link href="/profile" className="text-2xs text-teal hover:text-tealDark">
                            {t("rooms.goToProfile")}
                          </Link>
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
