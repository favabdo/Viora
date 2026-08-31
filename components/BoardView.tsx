"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Eye, Paperclip, Pin, Plus, X, Check, Palette, MessageCircle } from "lucide-react";
import { supabase, Task, BoardColumn, Project, ProjectMember, TASK_COLORS } from "@/lib/supabase";
import { normalizeTask } from "@/lib/taskShape";
import {
  copyTaskExtras,
  patchTaskExtras,
  readTaskExtras,
  subtaskProgress,
  writeTaskMeta,
  type TaskAttachment,
  type TaskExtras,
} from "@/lib/taskExtras";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ClickableAvatar from "./ClickableAvatar";
import IconButton from "./ui/IconButton";
import { Input, Textarea } from "./ui/Input";
import AddTaskModal, { type NewTaskDraft } from "./AddTaskModal";
import TaskContextMenu, { type TaskMenuState } from "./TaskContextMenu";
import TaskComments from "./TaskComments";
import TaskDetailModal from "./TaskDetailModal";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

const COLUMN_PALETTE = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#eab308", "#6b7280"];
const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

/** إسقاط فقط لو المؤشر فوق العمود أو المهمة فعلًا — مش أقرب عمود في الفاضي */
const exactDropCollision: CollisionDetection = (args) => pointerWithin(args);

function formatDueDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T00:00:00`));
  } catch {
    return "";
  }
}

function isOverdue(iso: string | null | undefined) {
  if (!iso) return false;
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function TaskCard({
  task,
  extras,
  currentUserId,
  locale,
  commentCount,
  startEditing,
  onEditingConsumed,
  onRequestDelete,
  onRenameTask,
  onSetColor,
  onSetDueDate,
  onContextMenu,
  onOpenDetail,
}: {
  task: Task;
  extras: TaskExtras;
  currentUserId: string;
  locale: string;
  commentCount: number;
  startEditing: boolean;
  onEditingConsumed: () => void;
  onRequestDelete: (task: Task) => void;
  onRenameTask: (task: Task, title: string) => void;
  onSetColor: (task: Task, color: string | null) => void;
  onSetDueDate: (task: Task, date: string | null) => void;
  onContextMenu: (task: Task, x: number, y: number) => void;
  onOpenDetail: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: editing,
  });
  const progress = subtaskProgress(extras);

  useEffect(() => {
    if (!startEditing) return;
    setTitleDraft(task.title);
    setEditing(true);
    onEditingConsumed();
  }, [startEditing, task.title, onEditingConsumed]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : extras.archived ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!editing) onOpenDetail(task);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(task, e.clientX, e.clientY);
      }}
      className="group bg-surfaceSunken border border-line rounded-lg p-3 hover:border-lineStrong transition-colors cursor-pointer touch-none"
    >
      <div className="flex items-start gap-1.5">
        {editing ? (
          <div className="flex-1 flex items-center gap-1 min-w-0" onPointerDown={(e) => e.stopPropagation()}>
            <Textarea
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onRenameTask(task, titleDraft);
                  setEditing(false);
                }
              }}
              onBlur={() => {
                onRenameTask(task, titleDraft);
                setEditing(false);
              }}
              className="text-sm py-1.5"
            />
          </div>
        ) : (
          <p className="flex-1 text-sm text-ink leading-snug break-words">{task.title}</p>
        )}

        <IconButton
          size="sm"
          tone="danger"
          aria-label={t("tasks.deleteTask")}
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(task);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 opacity-0 group-hover:opacity-100"
        >
          <X size={13} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {task.color &&
          (() => {
            const colorMeta = TASK_COLORS.find((c) => c.value === task.color);
            return colorMeta ? (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ backgroundColor: colorMeta.value + "22", color: colorMeta.value }}
              >
                {t(`taskColor.${colorMeta.name}`)}
              </span>
            ) : null;
          })()}

        {extras.category && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#6C5CE7]/15 text-[#A78BFA]">
            {t(`taskDetail.category.${extras.category}`)}
          </span>
        )}
        {(extras.tags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#3B82F6]/15 text-[#60A5FA]">
              {tag}
            </span>
          ))}
        {progress.total > 0 && (
          <span className="text-[10px] text-inkSoft">{`${progress.done}/${progress.total}`}</span>
        )}
        {extras.pinned && <Pin size={11} className="text-[#8C3AED]" />}
        {extras.watching && <Eye size={11} className="text-inkSoft" />}
        {(extras.attachments?.length || 0) > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-inkFaint">
            <Paperclip size={11} strokeWidth={1.75} />
            {extras.attachments?.length}
          </span>
        )}

        <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowColorPicker((v) => !v)}
            className="opacity-0 group-hover:opacity-100 text-inkFaint hover:text-inkSoft transition-opacity"
            aria-label={t("tasks.setColor")}
          >
            <Palette size={11} strokeWidth={1.75} />
          </button>
          {showColorPicker && (
            <div className="absolute z-30 top-full mt-1 start-0 flex items-center gap-1 bg-paper border border-line rounded-md shadow-modal p-1.5 fade-in">
              <button
                type="button"
                aria-label={t("tasks.noColor")}
                onClick={() => {
                  onSetColor(task, null);
                  setShowColorPicker(false);
                }}
                className="h-4 w-4 rounded-full border border-dashed border-inkFaint hover:border-ink"
              />
              {TASK_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={t(`taskColor.${c.name}`)}
                  onClick={() => {
                    onSetColor(task, c.value);
                    setShowColorPicker(false);
                  }}
                  className={`h-4 w-4 rounded-full transition-transform hover:scale-110 ${
                    task.color === c.value ? "ring-2 ring-offset-1 ring-ink" : ""
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="relative ms-auto" onPointerDown={(e) => e.stopPropagation()}>
          {task.due_date && (
            <span className={`text-2xs font-medium ${isOverdue(task.due_date) && !task.is_done ? "text-[#EF4444]" : "text-[#3B82F6]"}`}>
              {formatDueDate(task.due_date, "en-US")}
            </span>
          )}
        </div>

        {commentCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-inkFaint">
            <MessageCircle size={11} strokeWidth={1.75} />
            {commentCount}
          </span>
        )}

        {task.profiles && (
          <ClickableAvatar
            userId={task.user_id}
            name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
            src={task.profiles.avatar_url}
            size="xs"
          />
        )}
      </div>
    </div>
  );
}

function ColumnContainer({
  column,
  tasks,
  extrasByTask,
  currentUserId,
  locale,
  commentCounts,
  editingTaskId,
  onEditingConsumed,
  onRequestDelete,
  onRenameTask,
  onSetColor,
  onSetDueDate,
  onRenameColumn,
  onDeleteColumn,
  onAddTask,
  onContextMenu,
  onOpenDetail,
}: {
  column: BoardColumn;
  tasks: Task[];
  extrasByTask: Record<string, TaskExtras>;
  currentUserId: string;
  locale: string;
  commentCounts: Record<string, number>;
  editingTaskId: string | null;
  onEditingConsumed: () => void;
  onRequestDelete: (task: Task) => void;
  onRenameTask: (task: Task, title: string) => void;
  onSetColor: (task: Task, color: string | null) => void;
  onSetDueDate: (task: Task, date: string | null) => void;
  onRenameColumn: (column: BoardColumn, name: string) => void;
  onDeleteColumn: (column: BoardColumn) => void;
  onAddTask: (columnId: string) => void;
  onContextMenu: (task: Task, x: number, y: number) => void;
  onOpenDetail: (task: Task) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[280px] shrink-0 rounded-xl border p-3 min-h-[28rem] transition-colors ${
        isOver ? "border-[#8C3AED] bg-[#8C3AED]/10" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRenameColumn(column, nameDraft);
                setEditingName(false);
              }
            }}
            onBlur={() => {
              onRenameColumn(column, nameDraft);
              setEditingName(false);
            }}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-ink focus:outline-none border-b border-[#8C3AED]"
          />
        ) : (
          <button
            onClick={() => {
              setNameDraft(column.name);
              setEditingName(true);
            }}
            className="flex-1 min-w-0 text-start text-sm font-semibold text-ink truncate hover:text-[#8C3AED] transition-colors"
          >
            {column.name}
          </button>
        )}
        <span className="text-2xs text-inkFaint shrink-0">({tasks.length})</span>
        <IconButton size="sm" aria-label={t("common.delete")} tone="danger" onClick={() => onDeleteColumn(column)}>
          <X size={12} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-[80px] rounded-lg p-0.5">
        <SortableContext items={tasks.map((t2) => t2.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              extras={extrasByTask[task.id] || {}}
              currentUserId={currentUserId}
              locale={locale}
              commentCount={commentCounts[task.id] ?? 0}
              startEditing={editingTaskId === task.id}
              onEditingConsumed={onEditingConsumed}
              onRequestDelete={onRequestDelete}
              onRenameTask={onRenameTask}
              onSetColor={onSetColor}
              onSetDueDate={onSetDueDate}
              onContextMenu={onContextMenu}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </SortableContext>
      </div>

      <button
        onClick={() => onAddTask(column.id)}
        className="flex items-center gap-1.5 mt-2 px-2 py-2 text-xs text-inkFaint hover:text-[#8C3AED] rounded-md border border-transparent hover:border-dashed hover:border-[#8C3AED] transition-colors"
      >
        <Plus size={13} strokeWidth={2} />
        {t("board.addTask")}
      </button>
    </div>
  );
}

export default function BoardView({
  projectId,
  projects,
  members,
  tasks,
  columns,
  currentUserId,
  commentCounts,
  onRequestDeleteTask,
  onTasksMutated,
  onColumnsMutated,
  onCommentCountChange,
  onInvitePeople,
}: {
  projectId: string;
  projects: Project[];
  members: ProjectMember[];
  tasks: Task[];
  columns: BoardColumn[];
  currentUserId: string;
  commentCounts: Record<string, number>;
  onRequestDeleteTask: (task: Task) => void;
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
  onColumnsMutated: (updater: (prev: BoardColumn[]) => BoardColumn[]) => void;
  onCommentCountChange: (taskId: string, delta: number) => void;
  onInvitePeople: () => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskMode, setAddTaskMode] = useState<"quick" | "full">("quick");
  const [addTaskColumnId, setAddTaskColumnId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [menu, setMenu] = useState<TaskMenuState | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [extrasTick, setExtrasTick] = useState(0);
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const skipCardClickRef = useRef(false);
  const [subtaskTask, setSubtaskTask] = useState<Task | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [toast, setToast] = useState("");
  const [extrasReady, setExtrasReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTaskRef = useRef<Task | null>(null);

  useEffect(() => {
    setExtrasReady(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } })
  );

  const extrasByTask = useMemo(() => {
    const map: Record<string, TaskExtras> = {};
    if (!extrasReady) return map;
    for (const task of tasks) map[task.id] = readTaskExtras(task.id);
    return map;
  }, [tasks, extrasTick, extrasReady]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) map.set(col.id, []);
    for (const task of tasks) {
      if (task.column_id && map.has(task.column_id)) {
        map.get(task.column_id)!.push(task);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const pinA = extrasByTask[a.id]?.pinned ? 0 : 1;
        const pinB = extrasByTask[b.id]?.pinned ? 0 : 1;
        if (pinA !== pinB) return pinA - pinB;
        return a.position - b.position;
      });
    }
    return map;
  }, [tasks, columns, extrasByTask]);

  const activeTask = tasks.find((t2) => t2.id === activeTaskId) || null;
  const menuExtras = menu ? extrasByTask[menu.task.id] || {} : {};

  function bumpExtras() {
    setExtrasTick((n) => n + 1);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function handleDragStart(event: DragStartEvent) {
    skipCardClickRef.current = true;
    setActiveTaskId(String(event.active.id));
    setMenu(null);
    setDetailTask(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    window.setTimeout(() => {
      skipCardClickRef.current = false;
    }, 80);
    const { active, over } = event;
    if (!over || over.id === active.id) return;

    const activeTaskItem = tasks.find((t2) => t2.id === active.id);
    if (!activeTaskItem) return;

    const overIsColumn = columns.some((c) => c.id === over.id);
    const overTask = tasks.find((t2) => t2.id === over.id);
    const targetColumnId = overIsColumn ? String(over.id) : overTask?.column_id;
    if (!targetColumnId) return;

    const columnTasks = (tasksByColumn.get(targetColumnId) || []).filter((t2) => t2.id !== activeTaskItem.id);
    let newPosition: number;
    if (overIsColumn || !overTask) {
      newPosition = columnTasks.length > 0 ? columnTasks[columnTasks.length - 1].position + 1000 : 1000;
    } else {
      const overIndex = columnTasks.findIndex((t2) => t2.id === over.id);
      const prevTask = columnTasks[overIndex - 1];
      const nextTask = columnTasks[overIndex];
      if (prevTask && nextTask) newPosition = (prevTask.position + nextTask.position) / 2;
      else if (nextTask) newPosition = nextTask.position - 1000;
      else newPosition = columnTasks.length > 0 ? columnTasks[columnTasks.length - 1].position + 1000 : 1000;
    }

    if (activeTaskItem.column_id === targetColumnId && activeTaskItem.position === newPosition) return;

    onTasksMutated((prev) =>
      prev.map((t2) => (t2.id === activeTaskItem.id ? { ...t2, column_id: targetColumnId, position: newPosition } : t2))
    );
    await supabase.from("tasks").update({ column_id: targetColumnId, position: newPosition }).eq("id", activeTaskItem.id);
  }

  function handleDragCancel() {
    setActiveTaskId(null);
    window.setTimeout(() => {
      skipCardClickRef.current = false;
    }, 80);
  }

  async function renameTask(task: Task, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) return;
    onTasksMutated((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, title: trimmed } : t2)));
    await supabase.from("tasks").update({ title: trimmed }).eq("id", task.id);
  }

  async function setColor(task: Task, color: string | null) {
    onTasksMutated((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, color } : t2)));
    await supabase.from("tasks").update({ color }).eq("id", task.id);
  }

  async function setDueDate(task: Task, date: string | null) {
    onTasksMutated((prev) => prev.map((t2) => (t2.id === task.id ? { ...t2, due_date: date } : t2)));
    await supabase.from("tasks").update({ due_date: date }).eq("id", task.id);
  }

  function openAddTask(columnId?: string, mode: "quick" | "full" = "quick") {
    setAddTaskColumnId(columnId ?? columns[0]?.id ?? null);
    setAddTaskMode(mode);
    setAddTaskOpen(true);
  }

  async function createTask(draft: NewTaskDraft) {
    const targetProjectId = draft.projectId || projectId;
    const targetColumnId = targetProjectId === projectId ? draft.columnId : null;
    const list = targetColumnId ? tasksByColumn.get(targetColumnId) || [] : [];
    const position = list.length > 0 ? list[list.length - 1].position + 1000 : 1000;
    const member = members.find((item) => item.user_id === draft.assigneeId);
    setCreatingTask(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: draft.title,
        project_id: targetProjectId,
        column_id: targetColumnId,
        position,
        color: draft.color,
        due_date: draft.dueDate,
        ...(draft.assigneeId ? { user_id: draft.assigneeId } : {}),
      })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    setCreatingTask(false);
    if (error || !data) return;
    const created = normalizeTask(data);
    if (member?.profiles && !created.profiles) created.profiles = member.profiles;
    writeTaskMeta(created.id, draft.extras);
    bumpExtras();
    if (created.project_id === projectId) {
      onTasksMutated((prev) => [...prev, created]);
    }
    if (!draft.createAnother) setAddTaskOpen(false);
  }

  async function addColumn() {
    const name = newColumnName.trim();
    if (!name) return;
    const color = COLUMN_PALETTE[columns.length % COLUMN_PALETTE.length];
    const position = columns.length > 0 ? columns[columns.length - 1].position + 1 : 0;
    const { data, error } = await supabase
      .from("board_columns")
      .insert({ project_id: projectId, name, color, position })
      .select()
      .single();
    if (!error && data) {
      onColumnsMutated((prev) => [...prev, data as BoardColumn]);
      setNewColumnName("");
      setShowAddColumn(false);
    }
  }

  async function renameColumn(column: BoardColumn, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) return;
    onColumnsMutated((prev) => prev.map((c) => (c.id === column.id ? { ...c, name: trimmed } : c)));
    await supabase.from("board_columns").update({ name: trimmed }).eq("id", column.id);
  }

  async function deleteColumn(column: BoardColumn) {
    if (!confirm(t("board.confirmDeleteColumn").replace("{name}", column.name))) return;
    onTasksMutated((prev) => prev.map((t2) => (t2.column_id === column.id ? { ...t2, column_id: null } : t2)));
    await supabase.from("tasks").update({ column_id: null }).eq("column_id", column.id);
    onColumnsMutated((prev) => prev.filter((c) => c.id !== column.id));
    await supabase.from("board_columns").delete().eq("id", column.id);
  }

  async function assignTask(task: Task, userId: string | null) {
    const member = userId ? members.find((item) => item.user_id === userId) : null;
    onTasksMutated((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, user_id: userId || "", profiles: member?.profiles || null } : item
      )
    );
    await supabase.from("tasks").update({ user_id: userId }).eq("id", task.id);
  }

  async function moveTask(task: Task, columnId: string) {
    const list = tasksByColumn.get(columnId) || [];
    const position = list.length > 0 ? list[list.length - 1].position + 1000 : 1000;
    const doneColumn = columns.find((column) => column.id === columnId)?.is_done_column;
    onTasksMutated((prev) =>
      prev.map((item) =>
        item.id === task.id
          ? { ...item, column_id: columnId, position, is_done: doneColumn ? true : item.is_done }
          : item
      )
    );
    await supabase
      .from("tasks")
      .update({ column_id: columnId, position, ...(doneColumn ? { is_done: true } : {}) })
      .eq("id", task.id);
  }

  async function duplicateTask(task: Task) {
    const list = (task.column_id && tasksByColumn.get(task.column_id)) || [];
    const position = list.length > 0 ? list[list.length - 1].position + 1000 : 1000;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: `${task.title}${t("board.copySuffix")}`,
        project_id: task.project_id,
        column_id: task.column_id,
        position,
        color: task.color,
        due_date: task.due_date,
        user_id: task.user_id,
        is_done: false,
      })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (error || !data) return;
    const created = normalizeTask(data);
    copyTaskExtras(task.id, created.id);
    bumpExtras();
    onTasksMutated((prev) => [...prev, created]);
  }

  async function copyTaskLink(task: Task) {
    const url = `${window.location.origin}/?tab=projects&project=${projectId}&task=${task.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("board.menu.linkCopied"));
    } catch {
      showToast(url);
    }
  }

  async function toggleArchive(task: Task) {
    const extras = readTaskExtras(task.id);
    const archived = !extras.archived;
    const doneColumn = columns.find((column) => column.is_done_column);
    patchTaskExtras(task.id, { archived });
    bumpExtras();
    if (archived) {
      const columnId = doneColumn?.id || task.column_id;
      onTasksMutated((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, is_done: true, column_id: columnId } : item
        )
      );
      await supabase.from("tasks").update({ is_done: true, column_id: columnId }).eq("id", task.id);
    } else {
      onTasksMutated((prev) => prev.map((item) => (item.id === task.id ? { ...item, is_done: false } : item)));
      await supabase.from("tasks").update({ is_done: false }).eq("id", task.id);
    }
  }

  function addSubtask() {
    if (!subtaskTask) return;
    const text = subtaskDraft.trim();
    if (!text) return;
    const extras = readTaskExtras(subtaskTask.id);
    patchTaskExtras(subtaskTask.id, { subtasks: [...(extras.subtasks || []), { text, done: false }] });
    bumpExtras();
    setSubtaskDraft("");
    setSubtaskTask(null);
  }

  async function onAttachFiles(files: FileList | null) {
    const task = attachTaskRef.current;
    if (!task || !files || files.length === 0) return;
    const extras = readTaskExtras(task.id);
    const next: TaskAttachment[] = [...(extras.attachments || [])];
    let skipped = false;
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        skipped = true;
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
      });
    }
    patchTaskExtras(task.id, { attachments: next });
    bumpExtras();
    if (skipped) showToast(t("board.menu.fileTooLarge"));
    attachTaskRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={exactDropCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex items-center justify-end mb-3">
        <button
          type="button"
          onClick={() => openAddTask(columns[0]?.id, "quick")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#6C5CE7] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#7c6ef0] active:bg-[#5a4bd1] transition-colors"
        >
          <Plus size={15} strokeWidth={2.25} />
          {t("board.addTask")}
        </button>
      </div>
      <div className="flex items-start gap-4 overflow-x-auto pb-4 thin-scroll">
        {columns.map((column) => (
          <ColumnContainer
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) || []}
            extrasByTask={extrasByTask}
            currentUserId={currentUserId}
            locale={locale}
            commentCounts={commentCounts}
            editingTaskId={editingTaskId}
            onEditingConsumed={() => setEditingTaskId(null)}
            onRequestDelete={onRequestDeleteTask}
            onRenameTask={renameTask}
            onSetColor={setColor}
            onSetDueDate={setDueDate}
            onRenameColumn={renameColumn}
            onDeleteColumn={deleteColumn}
            onAddTask={(columnId) => openAddTask(columnId, "quick")}
            onContextMenu={(task, x, y) => setMenu({ task, x, y })}
            onOpenDetail={(task) => {
              if (skipCardClickRef.current) return;
              setDetailTask(task);
            }}
          />
        ))}

        <div className="w-[280px] shrink-0 rounded-xl border border-dashed border-line bg-paperDark/60 p-3 min-h-[28rem]">
          {showAddColumn ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addColumn()}
                placeholder={t("board.newColumnPlaceholder")}
                className="text-sm py-1.5"
              />
              <IconButton size="sm" tone="active" aria-label={t("board.addColumn")} onClick={addColumn}>
                <Check size={13} strokeWidth={2} />
              </IconButton>
            </div>
          ) : (
            <button
              onClick={() => setShowAddColumn(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-inkFaint hover:text-[#8C3AED] hover:bg-paperDark rounded-lg transition-colors w-full"
            >
              <Plus size={14} strokeWidth={2} />
              {t("board.addColumn")}
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="bg-surface border border-[#8C3AED] rounded-lg p-3 shadow-modal w-72 opacity-90">
            <p className="text-sm text-ink">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>

      {addTaskOpen && (
        <AddTaskModal
          mode={addTaskMode}
          columns={columns}
          projects={projects.length ? projects : [{ id: projectId, user_id: currentUserId, name: "", created_at: "" }]}
          members={members}
          currentUserId={currentUserId}
          defaultProjectId={projectId}
          defaultColumnId={addTaskColumnId}
          creating={creatingTask}
          onClose={() => setAddTaskOpen(false)}
          onExpand={() => setAddTaskMode("full")}
          onCollapse={() => setAddTaskMode("quick")}
          onCreate={createTask}
        />
      )}

      {menu && (
        <TaskContextMenu
          menu={menu}
          members={members}
          columns={columns}
          currentUserId={currentUserId}
          pinned={Boolean(menuExtras.pinned)}
          watching={Boolean(menuExtras.watching)}
          archived={Boolean(menuExtras.archived)}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setEditingTaskId(menu.task.id);
            setMenu(null);
          }}
          onAssign={(userId) => {
            void assignTask(menu.task, userId);
            setMenu(null);
          }}
          onInvite={() => {
            setMenu(null);
            onInvitePeople();
          }}
          onMove={(columnId) => {
            void moveTask(menu.task, columnId);
            setMenu(null);
          }}
          onDuplicate={() => {
            void duplicateTask(menu.task);
            setMenu(null);
          }}
          onAddSubtask={() => {
            setSubtaskTask(menu.task);
            setSubtaskDraft("");
            setMenu(null);
          }}
          onAddComment={() => {
            setCommentTask(menu.task);
            setMenu(null);
          }}
          onAttach={() => {
            attachTaskRef.current = menu.task;
            setMenu(null);
            fileInputRef.current?.click();
          }}
          onCopyLink={() => {
            void copyTaskLink(menu.task);
            setMenu(null);
          }}
          onTogglePin={() => {
            patchTaskExtras(menu.task.id, { pinned: !menuExtras.pinned });
            bumpExtras();
            setMenu(null);
          }}
          onToggleWatch={() => {
            patchTaskExtras(menu.task.id, { watching: !menuExtras.watching });
            bumpExtras();
            setMenu(null);
          }}
          onToggleArchive={() => {
            void toggleArchive(menu.task);
            setMenu(null);
          }}
          onDelete={() => {
            onRequestDeleteTask(menu.task);
            setMenu(null);
          }}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={tasks.find((item) => item.id === detailTask.id) || detailTask}
          extras={extrasByTask[detailTask.id] || {}}
          project={projects.find((item) => item.id === projectId) || null}
          column={columns.find((item) => item.id === (tasks.find((row) => row.id === detailTask.id)?.column_id || detailTask.column_id)) || null}
          members={members}
          currentUserId={currentUserId}
          commentCount={commentCounts[detailTask.id] ?? 0}
          onClose={() => setDetailTask(null)}
          onExtrasChange={bumpExtras}
          onCommentCountChange={onCommentCountChange}
          onAttach={() => {
            attachTaskRef.current = tasks.find((item) => item.id === detailTask.id) || detailTask;
            fileInputRef.current?.click();
          }}
          onSetColor={(color) => void setColor(tasks.find((item) => item.id === detailTask.id) || detailTask, color)}
          onSetDueDate={(date) => void setDueDate(tasks.find((item) => item.id === detailTask.id) || detailTask, date)}
          onAssign={(userId) => void assignTask(tasks.find((item) => item.id === detailTask.id) || detailTask, userId)}
        />
      )}

      {commentTask && (
        <Modal title={t("board.menu.addComment")} onClose={() => setCommentTask(null)} maxWidth="max-w-md">
          <TaskComments
            taskId={commentTask.id}
            projectId={projectId}
            currentUserId={currentUserId}
            count={commentCounts[commentTask.id] ?? 0}
            onCountChange={onCommentCountChange}
            alwaysOpen
          />
        </Modal>
      )}

      {subtaskTask && (
        <Modal title={t("board.menu.addSubtask")} onClose={() => setSubtaskTask(null)} maxWidth="max-w-sm">
          <div className="space-y-3">
            <Input
              autoFocus
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubtask()}
              placeholder={t("board.menu.subtaskPlaceholder")}
            />
            <Button variant="primary" onClick={addSubtask} disabled={!subtaskDraft.trim()}>
              {t("board.menu.saveSubtask")}
            </Button>
          </div>
        </Modal>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => void onAttachFiles(e.target.files)}
      />

      {toast && (
        <div className="fixed bottom-5 start-1/2 -translate-x-1/2 z-[90] rounded-full bg-ink text-paper px-4 py-2 text-xs shadow-modal">
          {toast}
        </div>
      )}
    </DndContext>
  );
}
