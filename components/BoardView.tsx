"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { supabase, Task, BoardColumn, TASK_COLORS } from "@/lib/supabase";
import Avatar from "./ui/Avatar";
import IconButton from "./ui/IconButton";
import { Input } from "./ui/Input";
import { Plus, X, Pencil, Check, Calendar, Palette, GripVertical } from "lucide-react";
import { displayName } from "@/lib/displayName";
import ClickableName from "./ClickableName";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const COLUMN_PALETTE = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ef4444", "#06b6d4", "#eab308", "#6b7280"];

function formatDueDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function TaskCard({
  task,
  currentUserId,
  locale,
  onRequestDelete,
  onRenameTask,
  onSetColor,
  onSetDueDate,
}: {
  task: Task;
  currentUserId: string;
  locale: string;
  onRequestDelete: (task: Task) => void;
  onRenameTask: (task: Task, title: string) => void;
  onSetColor: (task: Task, color: string | null) => void;
  onSetDueDate: (task: Task, date: string | null) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-surface border border-line rounded-lg p-3 shadow-sm hover:shadow-modal transition-shadow"
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-inkFaint hover:text-inkSoft touch-none"
          aria-label={t("tasks.dragHandle")}
        >
          <GripVertical size={13} strokeWidth={1.75} />
        </button>

        {editing ? (
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRenameTask(task, titleDraft);
                  setEditing(false);
                }
              }}
              onBlur={() => {
                onRenameTask(task, titleDraft);
                setEditing(false);
              }}
              className="text-sm py-1"
            />
          </div>
        ) : (
          <p
            onClick={() => {
              setTitleDraft(task.title);
              setEditing(true);
            }}
            className="flex-1 text-sm text-ink leading-snug cursor-text break-words"
          >
            {task.title}
          </p>
        )}

        <IconButton
          size="sm"
          tone="danger"
          aria-label={t("tasks.deleteTask")}
          onClick={() => onRequestDelete(task)}
          className="shrink-0 opacity-0 group-hover:opacity-100"
        >
          <X size={13} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {task.color && (
          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
        )}

        <div className="relative">
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

        <div className="relative ms-auto">
          <button
            onClick={() => setShowDatePicker((v) => !v)}
            className={`flex items-center gap-1 text-2xs transition-colors ${
              task.due_date ? "text-inkSoft" : "text-inkFaint opacity-0 group-hover:opacity-100"
            } hover:text-teal`}
          >
            <Calendar size={11} strokeWidth={1.75} />
            {task.due_date && formatDueDate(task.due_date, locale)}
          </button>
          {showDatePicker && (
            <div className="absolute z-30 top-full mt-1 end-0 bg-paper border border-line rounded-md shadow-modal p-2 fade-in">
              <input
                type="date"
                autoFocus
                defaultValue={task.due_date || ""}
                onChange={(e) => {
                  onSetDueDate(task, e.target.value || null);
                  setShowDatePicker(false);
                }}
                className="text-xs bg-transparent text-ink focus:outline-none"
              />
            </div>
          )}
        </div>

        {task.profiles && (
          <ClickableName userId={task.user_id}>
            <Avatar
              name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
              src={task.profiles.avatar_url}
              size="xs"
            />
          </ClickableName>
        )}
      </div>
    </div>
  );
}

function ColumnContainer({
  column,
  tasks,
  currentUserId,
  locale,
  onRequestDelete,
  onRenameTask,
  onSetColor,
  onSetDueDate,
  onRenameColumn,
  onDeleteColumn,
  onAddTask,
}: {
  column: BoardColumn;
  tasks: Task[];
  currentUserId: string;
  locale: string;
  onRequestDelete: (task: Task) => void;
  onRenameTask: (task: Task, title: string) => void;
  onSetColor: (task: Task, color: string | null) => void;
  onSetDueDate: (task: Task, date: string | null) => void;
  onRenameColumn: (column: BoardColumn, name: string) => void;
  onDeleteColumn: (column: BoardColumn) => void;
  onAddTask: (columnId: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 px-1 mb-2.5">
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
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-ink focus:outline-none border-b border-teal"
          />
        ) : (
          <button
            onClick={() => {
              setNameDraft(column.name);
              setEditingName(true);
            }}
            className="flex-1 min-w-0 text-start text-sm font-semibold text-ink truncate hover:text-teal transition-colors"
          >
            {column.name}
          </button>
        )}
        <span className="text-2xs text-inkFaint shrink-0">{tasks.length}</span>
        <IconButton size="sm" aria-label={t("common.delete")} tone="danger" onClick={() => onDeleteColumn(column)}>
          <X size={12} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 min-h-[80px] rounded-lg p-1.5 transition-colors ${
          isOver ? "bg-tealSoft/40" : ""
        }`}
      >
        <SortableContext items={tasks.map((t2) => t2.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              locale={locale}
              onRequestDelete={onRequestDelete}
              onRenameTask={onRenameTask}
              onSetColor={onSetColor}
              onSetDueDate={onSetDueDate}
            />
          ))}
        </SortableContext>
      </div>

      {showAddTask ? (
        <div className="flex items-center gap-1 mt-2 px-1">
          <Input
            autoFocus
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTaskTitle.trim()) {
                onAddTask(column.id, newTaskTitle.trim());
                setNewTaskTitle("");
              }
              if (e.key === "Escape") setShowAddTask(false);
            }}
            placeholder={t("tasks.newTaskPlaceholder")}
            className="text-sm py-1.5"
          />
          <IconButton
            size="sm"
            tone="active"
            aria-label={t("tasks.add")}
            onClick={() => {
              if (newTaskTitle.trim()) {
                onAddTask(column.id, newTaskTitle.trim());
                setNewTaskTitle("");
              }
            }}
          >
            <Check size={13} strokeWidth={2} />
          </IconButton>
        </div>
      ) : (
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center gap-1.5 mt-2 px-2 py-1.5 text-xs text-inkFaint hover:text-teal hover:bg-paperDark rounded-md transition-colors"
        >
          <Plus size={13} strokeWidth={2} />
          {t("tasks.add")}
        </button>
      )}
    </div>
  );
}

export default function BoardView({
  projectId,
  tasks,
  columns,
  currentUserId,
  onRequestDeleteTask,
  onTasksMutated,
  onColumnsMutated,
}: {
  projectId: string;
  tasks: Task[];
  columns: BoardColumn[];
  currentUserId: string;
  onRequestDeleteTask: (task: Task) => void;
  /** بننادي عليها بعد أي تعديل محلي عشان صاحب الصفحة يحدّث نسخته من tasks (باقي التزامن اللايف بيحصل تلقائي عن طريق realtime) */
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
  onColumnsMutated: (updater: (prev: BoardColumn[]) => BoardColumn[]) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) map.set(col.id, []);
    for (const task of tasks) {
      if (task.column_id && map.has(task.column_id)) {
        map.get(task.column_id)!.push(task);
      }
    }
    for (const [, list] of map) list.sort((a, b) => a.position - b.position);
    return map;
  }, [tasks, columns]);

  const activeTask = tasks.find((t2) => t2.id === activeTaskId) || null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTaskItem = tasks.find((t2) => t2.id === active.id);
    if (!activeTaskItem) return;

    // الهدف ممكن يكون عمود فاضي (over.id = column id) أو مهمة تانية جواه (over.id = task id)
    const overIsColumn = columns.some((c) => c.id === over.id);
    const targetColumnId = overIsColumn ? String(over.id) : tasks.find((t2) => t2.id === over.id)?.column_id;
    if (!targetColumnId) return;

    const columnTasks = (tasksByColumn.get(targetColumnId) || []).filter((t2) => t2.id !== activeTaskItem.id);
    let newPosition: number;
    if (overIsColumn || !tasks.find((t2) => t2.id === over.id)) {
      // اتسابت آخر العمود
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

  async function addTaskToColumn(columnId: string, title: string) {
    const list = tasksByColumn.get(columnId) || [];
    const position = list.length > 0 ? list[list.length - 1].position + 1000 : 1000;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, project_id: projectId, column_id: columnId, position })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (!error && data) {
      onTasksMutated((prev) => [...prev, data as Task]);
    }
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
    // المهام اللي كانت في العمود ده بترجع "بلا عمود" بدل ما تتحذف
    onTasksMutated((prev) => prev.map((t2) => (t2.column_id === column.id ? { ...t2, column_id: null } : t2)));
    await supabase.from("tasks").update({ column_id: null }).eq("column_id", column.id);
    onColumnsMutated((prev) => prev.filter((c) => c.id !== column.id));
    await supabase.from("board_columns").delete().eq("id", column.id);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex items-start gap-4 overflow-x-auto pb-4 thin-scroll">
        {columns.map((column) => (
          <ColumnContainer
            key={column.id}
            column={column}
            tasks={tasksByColumn.get(column.id) || []}
            currentUserId={currentUserId}
            locale={locale}
            onRequestDelete={onRequestDeleteTask}
            onRenameTask={renameTask}
            onSetColor={setColor}
            onSetDueDate={setDueDate}
            onRenameColumn={renameColumn}
            onDeleteColumn={deleteColumn}
            onAddTask={addTaskToColumn}
          />
        ))}

        <div className="w-72 shrink-0">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-inkFaint hover:text-teal hover:bg-paperDark rounded-md transition-colors w-full"
            >
              <Plus size={14} strokeWidth={2} />
              {t("board.addColumn")}
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="bg-surface border border-teal rounded-lg p-3 shadow-modal w-72 opacity-90">
            <p className="text-sm text-ink">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
