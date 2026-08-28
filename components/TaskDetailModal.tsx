"use client";

import { useEffect, useState } from "react";
import { Check, Paperclip, X } from "lucide-react";
import { supabase, ActivityEntry, BoardColumn, Project, Task } from "@/lib/supabase";
import { displayName, renderActivity } from "@/lib/displayName";
import { TASK_COLORS } from "@/lib/supabase";
import { patchTaskExtras, subtaskProgress, type TaskExtras } from "@/lib/taskExtras";
import { timeAgo } from "@/lib/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import ClickableName from "./ClickableName";
import ItemHistory from "./ItemHistory";
import TaskComments from "./TaskComments";

function formatLongDate(iso: string | null | undefined, locale: string) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
    );
  } catch {
    return iso;
  }
}

function isOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export default function TaskDetailModal({
  task,
  extras,
  project,
  column,
  currentUserId,
  commentCount,
  onClose,
  onExtrasChange,
  onCommentCountChange,
}: {
  task: Task;
  extras: TaskExtras;
  project: Project | null;
  column: BoardColumn | null;
  currentUserId: string;
  commentCount: number;
  onClose: () => void;
  onExtrasChange: () => void;
  onCommentCountChange: (taskId: string, delta: number) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "en-US" : "en-US";
  const [tab, setTab] = useState<"activity" | "comments" | "history">("activity");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const progress = subtaskProgress(extras);
  const tags = (extras.tags || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const colorMeta = TASK_COLORS.find((item) => item.value === task.color);
  const assignee = task.profiles
    ? displayName(task.user_id, task.profiles, currentUserId, t("common.you"))
    : t("taskDetail.unassigned");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("activity_log")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setEntries(data as ActivityEntry[]);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  function toggleSubtask(index: number) {
    const list = [...(extras.subtasks || [])];
    if (!list[index]) return;
    list[index] = { ...list[index], done: !list[index].done };
    patchTaskExtras(task.id, { subtasks: list });
    onExtrasChange();
  }

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 fade-in" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-line bg-surface shadow-modal flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
          <p className="text-xs text-inkFaint truncate">
            {project?.name || "Viora"} / {t("taskDetail.breadcrumbTasks")}
            {column ? ` / ${column.name}` : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_280px] overflow-hidden">
          <div className="min-w-0 overflow-y-auto thin-scroll p-5 space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-ink leading-snug">{task.title}</h2>
              {extras.description && <p className="mt-2 text-sm text-inkSoft leading-relaxed">{extras.description}</p>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <Meta label={t("taskDetail.assignee")} value={assignee} />
              <Meta label={t("taskDetail.project")} value={project?.name || "—"} />
              <Meta
                label={t("taskDetail.due")}
                value={formatLongDate(task.due_date, locale)}
                tone={isOverdue(task.due_date) && !task.is_done ? "danger" : "info"}
              />
              <Meta label={t("taskDetail.created")} value={formatLongDate(task.created_at, locale)} />
            </div>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-ink">{t("taskDetail.subtasks")}</h3>
                {progress.total > 0 && (
                  <span className="text-xs text-inkSoft">
                    {t("taskDetail.completedOf").replace("{done}", String(progress.done)).replace("{total}", String(progress.total))}
                  </span>
                )}
              </div>
              {progress.total > 0 && (
                <div className="h-1.5 rounded-full bg-paperDark overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${percent}%` }} />
                </div>
              )}
              <ul className="space-y-2">
                {(extras.subtasks || []).map((item, index) => (
                  <li key={`${item.text}-${index}`} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSubtask(index)}
                      className={`h-5 w-5 rounded-full border inline-flex items-center justify-center shrink-0 ${
                        item.done ? "bg-[#22C55E] border-[#22C55E] text-white" : "border-[#3B82F6] text-transparent"
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className={`flex-1 text-sm ${item.done ? "text-inkFaint line-through" : "text-ink"}`}>
                      {item.text}
                    </span>
                    {task.due_date && (
                      <span className={`text-xs shrink-0 ${item.done ? "text-[#22C55E]" : "text-[#3B82F6]"}`}>
                        {formatLongDate(task.due_date, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-ink mb-3">{t("taskDetail.details")}</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {colorMeta && (
                  <span className="rounded-md px-2 py-1 bg-[#EF4444]/15 text-[#EF4444]">
                    {t("taskDetail.priority")}: {t(`taskColor.${colorMeta.name}`)}
                  </span>
                )}
                {column && (
                  <span className="rounded-md px-2 py-1 bg-[#6C5CE7]/15 text-[#6C5CE7]">{column.name}</span>
                )}
                {tags.map((tag) => (
                  <span key={tag} className="rounded-md px-2 py-1 bg-[#3B82F6]/15 text-[#3B82F6]">
                    {tag}
                  </span>
                ))}
              </div>
              {extras.estimate && (
                <p className="mt-3 text-xs text-inkSoft">
                  {t("taskDetail.estimated")}: {extras.estimate}
                </p>
              )}
            </section>

            {(extras.attachments || []).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-ink mb-3">{t("taskDetail.attachments")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {extras.attachments!.map((file) => (
                    <a
                      key={file.id}
                      href={file.dataUrl || "#"}
                      download={file.name}
                      className="flex items-center gap-2 rounded-xl border border-line bg-paperDark/50 px-3 py-2 text-xs text-ink"
                    >
                      <Paperclip size={14} className="text-inkFaint" />
                      <span className="truncate">{file.name}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="border-t lg:border-t-0 lg:border-s border-line p-4 overflow-y-auto thin-scroll bg-paperDark/30">
            <div className="flex items-center gap-1 mb-3">
              {(
                [
                  ["activity", t("taskDetail.activity")],
                  ["comments", `${t("taskDetail.comments")} (${commentCount})`],
                  ["history", t("taskDetail.history")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-2 py-1.5 text-[11px] font-medium rounded-lg ${
                    tab === id ? "bg-[#6C5CE7]/15 text-ink" : "text-inkFaint hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "activity" && (
              <ul className="space-y-3">
                {entries.length === 0 ? (
                  <p className="text-xs text-inkFaint">{t("taskDetail.noActivity")}</p>
                ) : (
                  entries.map((entry) => {
                    const { label, rest, actorId } = renderActivity(entry, t, currentUserId, true);
                    return (
                      <li key={entry.id} className="text-xs text-inkSoft">
                        {label && (
                          <ClickableName userId={actorId} className="text-ink font-medium">
                            {label}
                          </ClickableName>
                        )}{" "}
                        {label ? rest.trimStart() : rest}
                        <span className="block text-[10px] text-inkFaint mt-0.5">{timeAgo(entry.created_at, t)}</span>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
            {tab === "comments" && (
              <TaskComments
                taskId={task.id}
                projectId={task.project_id}
                currentUserId={currentUserId}
                count={commentCount}
                onCountChange={onCommentCountChange}
                alwaysOpen
              />
            )}
            {tab === "history" && (
              <ItemHistory table="activity_log" column="task_id" id={task.id} currentUserId={currentUserId} />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: "danger" | "info" }) {
  const color = tone === "danger" ? "text-[#EF4444]" : tone === "info" ? "text-[#3B82F6]" : "text-ink";
  return (
    <div>
      <p className="text-[11px] text-inkFaint mb-0.5">{label}</p>
      <p className={`font-medium ${color}`}>{value}</p>
    </div>
  );
}
