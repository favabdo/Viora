"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Task } from "@/lib/supabase";
import { dateKey, formatTaskDate } from "@/lib/taskShape";
import { displayName } from "@/lib/displayName";
import Avatar from "./ui/Avatar";
import {
  DONE_COLOR,
  OVERDUE_COLOR,
  overdueDays,
  remainingLabel,
  taskCreated,
  taskDue,
  taskProgress,
  ymd,
} from "@/lib/taskScheduleMeta";

export function TaskHoverCard({
  task,
  x,
  y,
  locale,
  currentUserId,
  t,
  projectName,
}: {
  task: Task;
  x: number;
  y: number;
  locale: string;
  currentUserId: string;
  t: (key: string) => string;
  projectName?: string;
}) {
  const today = ymd(new Date());
  const created = taskCreated(task);
  const due = taskDue(task);
  const late = overdueDays(task, today);
  const { planned, filled, pct } = taskProgress(task, today);
  const remaining = remainingLabel(task, today, t);
  const assignee = task.profiles
    ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
    : t("timeline.unassigned");
  const status = task.is_done ? t("timeline.completed") : late > 0 ? t("list.overdue") : t("timeline.inProgress");
  const cardW = 280;
  const cardH = 270;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let left = x + 14;
  let top = y + 16;
  if (left + cardW + 8 > vw) left = x - cardW - 14;
  if (top + cardH + 8 > vh) top = y - cardH - 8;
  left = Math.max(8, left);
  top = Math.max(8, top);

  return createPortal(
    <div
      className="pointer-events-none fixed z-[80] w-[280px] rounded-xl border border-line bg-surface p-3 shadow-lg"
      style={{ left, top }}
      role="tooltip"
    >
      {projectName ? (
        <p className="text-[11px] font-medium text-[#7c5cff] mb-0.5 truncate">{projectName}</p>
      ) : null}
      <p className="text-sm font-medium text-ink leading-snug">{task.title}</p>
      <p className={`mt-1 text-[11px] font-medium ${late > 0 ? "text-red-500" : "text-inkSoft"}`}>{status}</p>
      <dl className="mt-2.5 space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("taskDetail.created")}</dt>
          <dd className="text-ink">{formatTaskDate(created, locale)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("taskDetail.due")}</dt>
          <dd className="text-ink">{due ? formatTaskDate(due, locale) : t("board.noDueDate")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("timeline.timeLeft")}</dt>
          <dd className={late > 0 ? "text-red-500 font-medium" : "text-ink"}>{remaining}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-inkFaint">{t("list.col.assignee")}</dt>
          <dd className="text-ink truncate max-w-[150px]">{assignee}</dd>
        </div>
      </dl>
      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[11px] text-inkFaint">
          <span>{t("projects.progress")}</span>
          <span>
            {t("timeline.daysProgress").replace("{done}", String(filled)).replace("{total}", String(planned))} · {pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-paperDark">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: late > 0 ? OVERDUE_COLOR : task.is_done ? DONE_COLOR : "#6C5CE7",
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function DetailRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="text-inkFaint shrink-0">{label}</span>
      <span className={`text-end ${danger ? "text-red-500 font-medium" : "text-ink"}`}>{value}</span>
    </div>
  );
}

export function TaskDetailsPanel({
  task,
  projectName,
  locale,
  currentUserId,
  t,
  onClose,
}: {
  task: Task;
  projectName: string;
  locale: string;
  currentUserId: string;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const today = ymd(new Date());
  const created = taskCreated(task);
  const due = taskDue(task);
  const start = dateKey(task.start_date);
  const completed = dateKey(task.completed_at);
  const late = overdueDays(task, today);
  const remaining = remainingLabel(task, today, t);
  const { planned, filled, pct } = taskProgress(task, today);
  const assignee = task.profiles
    ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
    : t("timeline.unassigned");
  const status = task.is_done ? t("timeline.completed") : late > 0 ? t("list.overdue") : t("timeline.inProgress");
  const priorityLabel =
    task.color === "#ef4444"
      ? t("list.priority.high")
      : task.color === "#f97316"
        ? t("list.priority.medium")
        : task.color
          ? t("list.priority.low")
          : t("taskDetail.priority.none");

  return (
    <div className="rounded-xl border border-line bg-surface p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">{t("taskDetail.details")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
          aria-label={t("common.close")}
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-sm font-medium text-ink leading-snug">{task.title}</p>
      <p className={`text-[11px] font-medium ${late > 0 ? "text-red-500" : "text-inkSoft"}`}>{status}</p>
      <div className="space-y-1.5">
        <DetailRow label={t("taskDetail.project")} value={projectName} />
        <DetailRow label={t("taskDetail.created")} value={formatTaskDate(created, locale)} />
        {start && <DetailRow label={t("board.startDate")} value={formatTaskDate(start, locale)} />}
        <DetailRow label={t("taskDetail.due")} value={due ? formatTaskDate(due, locale) : t("board.noDueDate")} />
        {completed && <DetailRow label={t("timeline.completed")} value={formatTaskDate(completed, locale)} />}
        <DetailRow label={t("timeline.timeLeft")} value={remaining} danger={late > 0} />
        <DetailRow label={t("list.col.assignee")} value={assignee} />
        <DetailRow label={t("taskDetail.priority")} value={priorityLabel} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-inkFaint">
          <span>{t("projects.progress")}</span>
          <span>
            {t("timeline.daysProgress").replace("{done}", String(filled)).replace("{total}", String(planned))} · {pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-paperDark">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: late > 0 ? OVERDUE_COLOR : task.is_done ? DONE_COLOR : "#6C5CE7",
            }}
          />
        </div>
      </div>
      {task.profiles && (
        <div className="flex items-center gap-2 pt-1">
          <Avatar name={assignee} src={task.profiles.avatar_url} size="sm" />
          <span className="text-xs text-ink truncate">{assignee}</span>
        </div>
      )}
    </div>
  );
}
