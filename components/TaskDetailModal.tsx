"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Calendar,
  Check,
  Clock,
  Expand,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Maximize2,
  MessageCircle,
  Plus,
  X,
} from "lucide-react";
import { supabase, ActivityEntry, BoardColumn, Project, ProjectMember, Task, TASK_COLORS } from "@/lib/supabase";
import { displayName, renderActivity } from "@/lib/displayName";
import { patchTaskExtras, subtaskProgress, type TaskExtras, type TaskSubtask } from "@/lib/taskExtras";
import { timeAgo } from "@/lib/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ClickableAvatar from "./ClickableAvatar";
import ClickableName from "./ClickableName";
import ItemHistory from "./ItemHistory";
import TaskComments from "./TaskComments";
import { Textarea } from "./ui/Input";

const CATEGORIES = ["dev", "design", "research", "ops"] as const;

function formatLongDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
    );
  } catch {
    return iso;
  }
}

function isOverdue(iso: string | null | undefined, done?: boolean) {
  if (!iso || done) return false;
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function taskCode(projectName: string, taskId: string) {
  const initials =
    projectName
      .split(/\s+/)
      .map((word) => word[0] || "")
      .join("")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "VI";
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) hash = (hash * 31 + taskId.charCodeAt(i)) >>> 0;
  return `${initials}-${1000 + (hash % 9000)}`;
}

function splitList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function memberById(members: ProjectMember[], userId?: string | null) {
  if (!userId) return null;
  return members.find((item) => item.user_id === userId) || null;
}

export default function TaskDetailModal({
  task,
  extras,
  project,
  column,
  members,
  currentUserId,
  commentCount,
  onClose,
  onExtrasChange,
  onCommentCountChange,
  onAttach,
  onSetColor,
  onSetDueDate,
  onAssign,
}: {
  task: Task;
  extras: TaskExtras;
  project: Project | null;
  column: BoardColumn | null;
  members: ProjectMember[];
  currentUserId: string;
  commentCount: number;
  onClose: () => void;
  onExtrasChange: () => void;
  onCommentCountChange: (taskId: string, delta: number) => void;
  onAttach: () => void;
  onSetColor: (color: string | null) => void;
  onSetDueDate: (date: string | null) => void;
  onAssign: (userId: string | null) => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"activity" | "comments" | "history">("activity");
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(extras.description || "");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const progress = subtaskProgress(extras);
  const tags = splitList(extras.tags);
  const labels = splitList(extras.labels);
  const colorMeta = TASK_COLORS.find((item) => item.value === task.color);
  const assignee = memberById(members, task.user_id) || (task.profiles ? { user_id: task.user_id, profiles: task.profiles } : null);
  const assigneeName = assignee
    ? displayName(task.user_id, assignee.profiles, currentUserId, t("common.you"))
    : t("taskDetail.unassigned");
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const code = taskCode(project?.name || "Viora", task.id);

  useEffect(() => {
    setDescriptionDraft(extras.description || "");
  }, [extras.description, task.id]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("activity_log")
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false })
      .limit(25)
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (!error && data && data.length > 0) {
          setEntries(data as ActivityEntry[]);
          return;
        }
        const fallback = await supabase
          .from("activity_log")
          .select("*")
          .eq("project_id", task.project_id)
          .order("created_at", { ascending: false })
          .limit(8);
        if (!cancelled && !fallback.error && fallback.data) setEntries(fallback.data as ActivityEntry[]);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.project_id]);

  function savePatch(patch: Partial<TaskExtras>) {
    patchTaskExtras(task.id, patch);
    onExtrasChange();
  }

  function toggleSubtask(index: number) {
    const list = [...(extras.subtasks || [])];
    if (!list[index]) return;
    list[index] = { ...list[index], done: !list[index].done };
    savePatch({ subtasks: list });
  }

  function updateSubtask(index: number, patch: Partial<TaskSubtask>) {
    const list = [...(extras.subtasks || [])];
    if (!list[index]) return;
    list[index] = { ...list[index], ...patch };
    savePatch({ subtasks: list });
  }

  function addSubtask() {
    const text = subtaskDraft.trim();
    if (!text) return;
    savePatch({
      subtasks: [...(extras.subtasks || []), { text, done: false, due: task.due_date || null, assigneeId: task.user_id }],
    });
    setSubtaskDraft("");
  }

  function addChip(kind: "tags" | "labels", value: string) {
    const next = value.trim();
    if (!next) return;
    const current = splitList(extras[kind]);
    if (current.includes(next)) return;
    savePatch({ [kind]: [...current, next].join(", ") });
    if (kind === "tags") setTagDraft("");
    else setLabelDraft("");
  }

  function removeChip(kind: "tags" | "labels", value: string) {
    savePatch({ [kind]: splitList(extras[kind]).filter((item) => item !== value).join(", ") });
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 fade-in" onClick={onClose}>
      <div
        className={`w-full ${expanded ? "max-w-6xl" : "max-w-5xl"} max-h-[92vh] overflow-hidden rounded-2xl border border-line bg-surface shadow-modal flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
              aria-label={t("taskDetail.expand")}
            >
              {expanded ? <Expand size={15} /> : <Maximize2 size={15} />}
            </button>
            <p className="text-xs text-inkFaint truncate">
              {project?.name || "Viora"} / {column?.name || t("taskDetail.breadcrumbTasks")} / {code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
            aria-label={t("common.close")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] overflow-hidden">
          <div className="min-w-0 overflow-y-auto thin-scroll p-5 space-y-6">
            <div>
              <div className="flex items-start gap-2">
                <h2 className="text-[22px] font-semibold text-ink leading-snug flex-1">{task.title}</h2>
                <span className="inline-flex items-center gap-1 text-xs text-inkFaint mt-1">
                  <MessageCircle size={13} />
                  {commentCount}
                </span>
              </div>
              {editingDescription ? (
                <Textarea
                  autoFocus
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  onBlur={() => {
                    savePatch({ description: descriptionDraft.trim() });
                    setEditingDescription(false);
                  }}
                  className="mt-2"
                />
              ) : (
                <button type="button" onClick={() => setEditingDescription(true)} className="mt-2 text-start w-full">
                  <p className={`text-sm leading-relaxed ${extras.description ? "text-inkSoft" : "text-inkFaint italic"}`}>
                    {extras.description || t("taskDetail.noDescription")}
                  </p>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] text-inkFaint mb-1.5">{t("taskDetail.assignee")}</p>
                <div className="flex items-center gap-2">
                  {assignee?.profiles ? (
                    <ClickableAvatar userId={assignee.user_id} name={assigneeName} src={assignee.profiles.avatar_url} size="sm" />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-paperDark" />
                  )}
                  <select
                    value={task.user_id || ""}
                    onChange={(e) => onAssign(e.target.value || null)}
                    className="bg-transparent text-sm font-medium text-ink outline-none max-w-[10rem]"
                  >
                    <option value="">{t("taskDetail.unassigned")}</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.user_id}>
                        {displayName(member.user_id, member.profiles, currentUserId, t("common.you"))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-inkFaint mb-1.5">{t("taskDetail.project")}</p>
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <FolderKanban size={15} className="text-[#6C5CE7]" />
                  {project?.name || "—"}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-inkFaint mb-1.5">{t("taskDetail.due")}</p>
                <label className={`flex items-center gap-1.5 text-sm font-medium ${isOverdue(task.due_date, task.is_done) ? "text-[#EF4444]" : "text-ink"}`}>
                  <Calendar size={14} className={isOverdue(task.due_date, task.is_done) ? "text-[#EF4444]" : "text-inkSoft"} />
                  <input
                    type="date"
                    value={task.due_date ? task.due_date.slice(0, 10) : ""}
                    onChange={(e) => onSetDueDate(e.target.value || null)}
                    className="bg-transparent outline-none w-[9.75rem]"
                  />
                </label>
              </div>
              <div>
                <p className="text-[11px] text-inkFaint mb-1.5">{t("taskDetail.created")}</p>
                <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Calendar size={14} className="text-inkSoft" />
                  {formatLongDate(task.created_at)}
                </div>
              </div>
            </div>

            <section>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-ink">{t("taskDetail.subtasks")}</h3>
                <span className="text-xs text-inkSoft">
                  {t("taskDetail.completedOf").replace("{done}", String(progress.done)).replace("{total}", String(progress.total))}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-paperDark overflow-hidden min-w-[80px]">
                  <div className="h-full rounded-full bg-[#6C5CE7]" style={{ width: `${percent}%` }} />
                </div>
              </div>
              {(extras.subtasks || []).length === 0 && (
                <p className="text-xs text-inkFaint mb-2">{t("taskDetail.noSubtasks")}</p>
              )}
              <ul className="space-y-2">
                {(extras.subtasks || []).map((item, index) => {
                  const person = memberById(members, item.assigneeId);
                  const name = person
                    ? displayName(person.user_id, person.profiles, currentUserId, t("common.you"))
                    : "";
                  const due = item.due || task.due_date;
                  return (
                    <li key={`${item.text}-${index}`} className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSubtask(index)}
                        className={`h-5 w-5 rounded-full border-2 inline-flex items-center justify-center shrink-0 ${
                          item.done ? "bg-[#22C55E] border-[#22C55E] text-white" : "border-[#3B82F6] bg-transparent"
                        }`}
                      >
                        {item.done && <Check size={11} strokeWidth={3} />}
                      </button>
                      <span className={`flex-1 min-w-0 text-sm ${item.done ? "text-inkFaint line-through" : "text-ink"}`}>
                        {item.text}
                      </span>
                      {person && (
                        <ClickableAvatar userId={person.user_id} name={name} src={person.profiles?.avatar_url} size="xs" />
                      )}
                      <select
                        value={item.assigneeId || ""}
                        onChange={(e) => updateSubtask(index, { assigneeId: e.target.value || null })}
                        className="max-w-[110px] rounded-lg bg-surfaceSunken border-0 px-2 py-1 text-[11px] text-ink outline-none"
                        aria-label={t("taskDetail.subtaskAssignee")}
                      >
                        <option value="">{t("taskDetail.unassigned")}</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.user_id}>
                            {displayName(member.user_id, member.profiles, currentUserId, t("common.you"))}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={item.due || ""}
                        onChange={(e) => updateSubtask(index, { due: e.target.value || null })}
                        aria-label={t("taskDetail.subtaskDue")}
                        className={`w-[9.5rem] bg-transparent text-xs outline-none ${
                          item.done ? "text-[#22C55E]" : isOverdue(due, item.done) ? "text-[#EF4444]" : "text-[#3B82F6]"
                        }`}
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-2 mt-3">
                <Textarea
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder={t("board.menu.subtaskPlaceholder")}
                  className="text-sm py-2"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#6C5CE7] text-white text-xs font-medium px-3 py-2"
                >
                  <Plus size={13} />
                  {t("taskDetail.addSubtask")}
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-ink mb-3">{t("taskDetail.details")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Field label={t("taskDetail.priority")}>
                  <select
                    value={task.color || ""}
                    onChange={(e) => onSetColor(e.target.value || null)}
                    className="rounded-md px-2 py-1 text-xs font-medium outline-none"
                    style={{
                      backgroundColor: (colorMeta?.value || "#6B7280") + "22",
                      color: colorMeta?.value || "#9CA3AF",
                    }}
                  >
                    <option value="">{t("taskDetail.priority.none")}</option>
                    {TASK_COLORS.map((item) => (
                      <option key={item.name} value={item.value}>
                        {t(`taskColor.${item.name}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("taskDetail.category")}>
                  <select
                    value={extras.category || ""}
                    onChange={(e) => savePatch({ category: e.target.value })}
                    className="rounded-md bg-[#6C5CE7]/15 text-[#6C5CE7] px-2 py-1 text-xs font-medium outline-none"
                  >
                    <option value="">{t("taskDetail.none")}</option>
                    {CATEGORIES.map((id) => (
                      <option key={id} value={id}>
                        {t(`taskDetail.category.${id}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div>
                  <p className="text-[11px] text-inkFaint mb-1.5">{t("taskDetail.tags")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.length === 0 && <span className="text-xs text-inkFaint">{t("taskDetail.noTags")}</span>}
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeChip("tags", tag)}
                        className="rounded-md px-2 py-1 text-xs bg-[#3B82F6]/15 text-[#60A5FA]"
                      >
                        {tag} ×
                      </button>
                    ))}
                    <input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChip("tags", tagDraft))}
                      placeholder={t("taskDetail.addTag")}
                      className="w-24 bg-transparent text-xs outline-none text-inkFaint"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-inkFaint mb-1.5">{t("taskDetail.labels")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.length === 0 && <span className="text-xs text-inkFaint">{t("taskDetail.noLabels")}</span>}
                    {labels.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => removeChip("labels", label)}
                        className="rounded-md px-2 py-1 text-xs bg-[#6C5CE7]/20 text-[#A78BFA]"
                      >
                        {label} ×
                      </button>
                    ))}
                    <input
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChip("labels", labelDraft))}
                      placeholder={t("taskDetail.addLabel")}
                      className="w-24 bg-transparent text-xs outline-none text-inkFaint"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-inkFaint mt-4 mb-2">{t("taskDetail.timeTracking")}</p>
              <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2 text-inkSoft">
                  <Clock size={14} />
                  <span>{t("taskDetail.estimated")}:</span>
                  <input
                    value={extras.estimate || ""}
                    onChange={(e) => savePatch({ estimate: e.target.value })}
                    placeholder="24 hours"
                    className="bg-transparent outline-none text-ink w-28"
                  />
                </label>
                <label className="flex items-center gap-2 text-inkSoft">
                  <Clock size={14} />
                  <span>{t("taskDetail.timeSpent")}:</span>
                  <input
                    value={extras.timeSpent || ""}
                    onChange={(e) => savePatch({ timeSpent: e.target.value })}
                    placeholder="16h 30m"
                    className="bg-transparent outline-none text-ink w-28"
                  />
                </label>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink">
                  {t("taskDetail.attachments")} {(extras.attachments || []).length}
                </h3>
                <button type="button" onClick={onAttach} className="text-xs text-[#6C5CE7] inline-flex items-center gap-1">
                  <Plus size={12} />
                  {t("board.menu.attachFile")}
                </button>
              </div>
              {(extras.attachments || []).length === 0 && (
                <p className="text-xs text-inkFaint mb-2">{t("taskDetail.noAttachments")}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(extras.attachments || []).map((file) => {
                  const isImage = (file.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
                  return (
                    <a
                      key={file.id}
                      href={file.dataUrl || "#"}
                      download={file.name}
                      className="flex items-center gap-3 rounded-xl border border-line bg-paperDark/40 px-3 py-2.5"
                    >
                      <span className="h-9 w-9 rounded-lg bg-surface inline-flex items-center justify-center text-inkSoft">
                        {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-ink truncate">{file.name}</span>
                        <span className="block text-[11px] text-inkFaint">{formatBytes(file.size)}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="border-t lg:border-t-0 lg:border-s border-line flex flex-col min-h-0 bg-[#12141c]/40">
            <div className="flex items-center gap-3 px-4 pt-4 border-b border-line">
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
                  className={`relative pb-3 text-xs font-medium ${tab === id ? "text-ink" : "text-inkFaint hover:text-inkSoft"}`}
                >
                  {label}
                  {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#6C5CE7]" />}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll p-4">
              {tab === "activity" && (
                <ul className="space-y-4">
                  {entries.length === 0 ? (
                    <p className="text-xs text-inkFaint">{t("taskDetail.noActivity")}</p>
                  ) : (
                    entries.map((entry) => {
                      const { label, rest, actorId } = renderActivity(entry, t, currentUserId, true);
                      return (
                        <li key={entry.id} className="relative ps-4 text-xs text-inkSoft">
                          <span className="absolute start-0 top-1.5 h-2 w-2 rounded-full bg-[#6C5CE7]" />
                          <p>
                            {label && (
                              <ClickableName userId={actorId} className="text-ink font-medium">
                                {label}
                              </ClickableName>
                            )}{" "}
                            {label ? rest.trimStart() : rest}
                          </p>
                          <p className="text-[10px] text-inkFaint mt-1">{timeAgo(entry.created_at, t)}</p>
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
                  variant="detail"
                />
              )}
              {tab === "history" && (
                <ItemHistory table="activity_log" column="task_id" id={task.id} currentUserId={currentUserId} />
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-inkFaint mb-1.5">{label}</p>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
