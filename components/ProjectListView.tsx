"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Filter,
  ArrowUpDown,
  Layers,
  MoreHorizontal,
  Plus,
  MessageCircle,
  FolderKanban,
  Check,
} from "lucide-react";
import { supabase, Project, ProjectMember, Task, BoardColumn, TASK_COLORS } from "@/lib/supabase";
import { displayName } from "@/lib/displayName";
import { formatTaskDate, isDueAfterCreated, normalizeTask } from "@/lib/taskShape";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ClickableAvatar from "./ClickableAvatar";
import ClickableName from "./ClickableName";
import DonutChart from "./ui/DonutChart";
import { Input, Textarea } from "./ui/Input";
import TaskDetailModal from "./TaskDetailModal";
import { readTaskExtras } from "@/lib/taskExtras";

type GroupBy = "status" | "none";
type SortBy = "position" | "due" | "priority" | "title";
type Priority = "high" | "medium" | "low" | null;

function priorityOf(task: Task): Priority {
  if (!task.color) return null;
  if (task.color === "#ef4444" || task.color === "#a855f7") return "high";
  if (task.color === "#f97316" || task.color === "#eab308") return "medium";
  return "low";
}

function isOverdue(task: Task): boolean {
  if (task.is_done || !task.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.due_date}T00:00:00`) < today;
}

function tagLabel(task: Task, t: (key: string) => string): string | null {
  const meta = TASK_COLORS.find((c) => c.value === task.color);
  return meta ? t(`taskColor.${meta.name}`) : null;
}

export default function ProjectListView({
  project,
  projects,
  tasks,
  columns,
  members = [],
  currentUserId,
  commentCounts,
  onTasksMutated,
  onCommentCountChange,
}: {
  project: Project;
  projects: Project[];
  tasks: Task[];
  columns: BoardColumn[];
  members?: ProjectMember[];
  currentUserId: string;
  commentCounts: Record<string, number>;
  onTasksMutated: (updater: (prev: Task[]) => Task[]) => void;
  onCommentCountChange?: (taskId: string, delta: number) => void;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [query, setQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [sortBy, setSortBy] = useState<SortBy>("position");
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [countsByProject, setCountsByProject] = useState<Record<string, number>>({});
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [extrasTick, setExtrasTick] = useState(0);

  useEffect(() => {
    if (projects.length === 0) return;
    supabase
      .from("tasks")
      .select("project_id")
      .in(
        "project_id",
        projects.map((p) => p.id)
      )
      .then(({ data, error }) => {
        if (error || !data) return;
        const map: Record<string, number> = {};
        for (const row of data as { project_id: string }[]) {
          map[row.project_id] = (map[row.project_id] ?? 0) + 1;
        }
        setCountsByProject(map);
      });
  }, [projects, tasks.length]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tasks.filter((task) => !q || task.title.toLowerCase().includes(q));

    const rank = (task: Task) => {
      if (sortBy === "due") return task.due_date || "9999-12-31";
      if (sortBy === "title") return task.title.toLowerCase();
      if (sortBy === "priority") {
        const p = priorityOf(task);
        return p === "high" ? "0" : p === "medium" ? "1" : p === "low" ? "2" : "3";
      }
      return String(task.position).padStart(8, "0");
    };
    list = [...list].sort((a, b) => rank(a).localeCompare(rank(b)));

    if (groupBy === "none") {
      return [{ id: "all", name: t("list.allTasks"), color: "#6C5CE7", tasks: list }];
    }

    const byColumn = columns.map((column) => ({
      id: column.id,
      name: column.name,
      color: column.color,
      tasks: list.filter((task) => task.column_id === column.id),
    }));
    const ungrouped = list.filter((task) => !task.column_id || !columns.some((c) => c.id === task.column_id));
    if (ungrouped.length > 0) {
      byColumn.push({ id: "none", name: t("list.noStatus"), color: "#6b7280", tasks: ungrouped });
    }
    return byColumn.filter((group) => group.tasks.length > 0 || columns.some((c) => c.id === group.id));
  }, [tasks, columns, query, groupBy, sortBy, t]);

  const overdueCount = tasks.filter(isOverdue).length;

  async function addTask(columnId: string | null) {
    const title = newTitle.trim();
    if (!title) return;
    const siblings = tasks.filter((task) => (columnId ? task.column_id === columnId : !task.column_id));
    const position = siblings.length > 0 ? Math.max(...siblings.map((task) => task.position)) + 1000 : 1000;
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, project_id: project.id, column_id: columnId, position })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (!error && data) {
      onTasksMutated((prev) => [...prev, normalizeTask(data)]);
      setNewTitle("");
      setAddingFor(null);
    }
  }

  async function setColor(task: Task, color: string | null) {
    onTasksMutated((prev) => prev.map((row) => (row.id === task.id ? { ...row, color } : row)));
    await supabase.from("tasks").update({ color }).eq("id", task.id);
  }

  async function setDueDate(task: Task, date: string | null) {
    if (date && !isDueAfterCreated(task.created_at, date)) return;
    onTasksMutated((prev) => prev.map((row) => (row.id === task.id ? { ...row, due_date: date } : row)));
    await supabase.from("tasks").update({ due_date: date }).eq("id", task.id);
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

  const statusLegend = [
    ...columns.map((column) => ({
      label: column.name,
      color: column.color,
      count: tasks.filter((task) => task.column_id === column.id).length,
    })),
    { label: t("list.overdue"), color: "#ef4444", count: overdueCount },
  ];

  return (
    <>
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {t("list.allTasks")}{" "}
              <span className="ms-1 text-inkFaint font-medium">{tasks.length}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5 relative">
            <button
              onClick={() => {
                setShowFilter((v) => !v);
                setShowGroupMenu(false);
                setShowSortMenu(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft hover:text-ink"
            >
              <Filter size={13} strokeWidth={1.75} />
              {t("list.filter")}
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  setShowGroupMenu((v) => !v);
                  setShowSortMenu(false);
                  setShowFilter(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft hover:text-ink"
              >
                <Layers size={13} strokeWidth={1.75} />
                {t("list.group")}
              </button>
              {showGroupMenu && (
                <div className="absolute end-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-line bg-surface shadow-modal p-1">
                  <button
                    onClick={() => {
                      setGroupBy("status");
                      setShowGroupMenu(false);
                    }}
                    className={`w-full text-start rounded-md px-2.5 py-1.5 text-xs ${groupBy === "status" ? "bg-tealSoft text-ink" : "text-inkSoft hover:bg-paperDark"}`}
                  >
                    {t("list.groupStatus")}
                  </button>
                  <button
                    onClick={() => {
                      setGroupBy("none");
                      setShowGroupMenu(false);
                    }}
                    className={`w-full text-start rounded-md px-2.5 py-1.5 text-xs ${groupBy === "none" ? "bg-tealSoft text-ink" : "text-inkSoft hover:bg-paperDark"}`}
                  >
                    {t("list.groupNone")}
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => {
                  setShowSortMenu((v) => !v);
                  setShowGroupMenu(false);
                  setShowFilter(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-inkSoft hover:text-ink"
              >
                <ArrowUpDown size={13} strokeWidth={1.75} />
                {t("list.sort")}
              </button>
              {showSortMenu && (
                <div className="absolute end-0 top-full mt-1 z-20 min-w-[150px] rounded-lg border border-line bg-surface shadow-modal p-1">
                  {(
                    [
                      ["position", t("list.sortDefault")],
                      ["due", t("list.sortDue")],
                      ["priority", t("list.sortPriority")],
                      ["title", t("list.sortTitle")],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setSortBy(id);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-start rounded-md px-2.5 py-1.5 text-xs ${sortBy === id ? "bg-tealSoft text-ink" : "text-inkSoft hover:bg-paperDark"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-surface">
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="mb-3">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("list.searchTasks")}
              className="max-w-sm"
            />
          </div>
        )}

        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_110px_90px_130px_100px_120px_90px] gap-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-inkFaint border-b border-line">
            <span>{t("list.col.task")}</span>
            <span>{t("list.col.status")}</span>
            <span>{t("list.col.priority")}</span>
            <span>{t("list.col.assignee")}</span>
            <span>{t("list.col.due")}</span>
            <span>{t("list.col.project")}</span>
            <span>{t("list.col.tags")}</span>
          </div>

          {groups.map((group) => {
            const closed = collapsed[group.id];
            return (
              <div key={group.id} className="border-b border-line last:border-b-0">
                <button
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-start hover:bg-paperDark/40"
                >
                  <ChevronDown
                    size={14}
                    className={`text-inkFaint transition-transform ${closed ? "-rotate-90" : ""}`}
                  />
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="text-sm font-medium text-ink">{group.name}</span>
                  <span className="text-xs text-inkFaint">{group.tasks.length}</span>
                </button>

                {!closed && (
                  <div>
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        columnName={columns.find((c) => c.id === task.column_id)?.name || t("list.noStatus")}
                        columnColor={columns.find((c) => c.id === task.column_id)?.color || group.color}
                        projectName={project.name}
                        currentUserId={currentUserId}
                        commentCount={commentCounts[task.id] ?? 0}
                        locale={locale}
                        t={t}
                        onOpen={() => setDetailTask(task)}
                      />
                    ))}
                    {addingFor === group.id ? (
                      <div className="flex items-center gap-2 px-4 py-2">
                        <Textarea
                          autoFocus
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder={t("tasks.newTaskPlaceholder")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              addTask(group.id === "all" || group.id === "none" ? null : group.id);
                            }
                            if (e.key === "Escape") {
                              setAddingFor(null);
                              setNewTitle("");
                            }
                          }}
                          className="text-sm py-1.5"
                        />
                        <button
                          onClick={() => addTask(group.id === "all" || group.id === "none" ? null : group.id)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[#6C5CE7] text-white"
                          aria-label={t("tasks.add")}
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingFor(group.id);
                          setNewTitle("");
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs text-inkFaint hover:text-[#6C5CE7]"
                      >
                        <Plus size={13} />
                        {t("list.addTask")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {tasks.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-inkFaint">{t("board.noTasksYet")}</p>
          )}
        </div>

        <div className="flex justify-center mt-3">
          <button
            onClick={() => {
              const first = columns[0]?.id || "none";
              setCollapsed((prev) => ({ ...prev, [first]: false }));
              setAddingFor(first);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-inkSoft hover:text-ink"
          >
            <Plus size={13} />
            {t("list.addNewTask")}
          </button>
        </div>
      </div>

      <aside className="w-full xl:w-64 shrink-0 space-y-4">
        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("list.totalTasks")}</h3>
          <div className="flex flex-col items-center">
            <DonutChart
              segments={statusLegend.filter((s) => s.label !== t("list.overdue")).map((s) => ({ value: s.count, color: s.color }))}
              size={132}
              strokeWidth={14}
              centerLabel={String(tasks.length)}
              centerSubLabel={t("board.tasksCount")}
            />
          </div>
          <ul className="mt-4 space-y-2">
            {statusLegend.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-inkSoft truncate">{item.label}</span>
                <span className="font-medium text-ink">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("list.projectsSummary")}</h3>
          <ul className="space-y-2.5">
            {projects.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={`truncate ${item.id === project.id ? "text-ink font-medium" : "text-inkSoft"}`}>
                  {item.name}
                </span>
                <span className="text-inkFaint tabular-nums">{countsByProject[item.id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
    {detailTask && (
      <TaskDetailModal
        key={`${detailTask.id}-${extrasTick}`}
        task={tasks.find((item) => item.id === detailTask.id) || detailTask}
        extras={readTaskExtras(detailTask.id)}
        project={project}
        column={columns.find((item) => item.id === (tasks.find((row) => row.id === detailTask.id)?.column_id || detailTask.column_id)) || null}
        members={members}
        currentUserId={currentUserId}
        commentCount={commentCounts[detailTask.id] ?? 0}
        onClose={() => setDetailTask(null)}
        onExtrasChange={() => setExtrasTick((n) => n + 1)}
        onCommentCountChange={onCommentCountChange || (() => undefined)}
        onAttach={() => undefined}
        onSetColor={(color) => void setColor(tasks.find((item) => item.id === detailTask.id) || detailTask, color)}
        onSetDueDate={(date) => void setDueDate(tasks.find((item) => item.id === detailTask.id) || detailTask, date)}
        onAssign={(userId) => void assignTask(tasks.find((item) => item.id === detailTask.id) || detailTask, userId)}
      />
    )}
    </>
  );
}

function TaskRow({
  task,
  columnName,
  columnColor,
  projectName,
  currentUserId,
  commentCount,
  locale,
  t,
  onOpen,
}: {
  task: Task;
  columnName: string;
  columnColor: string;
  projectName: string;
  currentUserId: string;
  commentCount: number;
  locale: string;
  t: (key: string) => string;
  onOpen: () => void;
}) {
  const priority = priorityOf(task);
  const priorityClass =
    priority === "high"
      ? "bg-[#EF4444]/15 text-[#DC2626] dark:text-[#F87171]"
      : priority === "medium"
        ? "bg-[#F59E0B]/15 text-[#B45309] dark:text-[#FBBF24]"
        : priority === "low"
          ? "bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]"
          : "text-inkFaint";
  const tag = tagLabel(task, t);
  const due = formatTaskDate(task.due_date, locale);
  const overdue = isOverdue(task);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_110px_90px_130px_100px_120px_90px] gap-2 items-center px-4 py-2.5 border-t border-line/80 hover:bg-paperDark/30 cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
            task.is_done ? "bg-sage border-sage text-white" : "border-lineStrong"
          }`}
        >
          {task.is_done && <Check size={10} strokeWidth={3} />}
        </span>
        <p className={`text-sm truncate ${task.is_done ? "text-inkFaint line-through" : "text-ink"}`}>{task.title}</p>
        {commentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-inkFaint shrink-0">
            <MessageCircle size={11} />
            {commentCount}
          </span>
        )}
      </div>
      <span
        className="justify-self-start text-[11px] font-medium px-2 py-0.5 rounded-md"
        style={{ backgroundColor: `${columnColor}22`, color: columnColor }}
      >
        {columnName}
      </span>
      <span className={`justify-self-start text-[11px] font-medium px-2 py-0.5 rounded-md ${priorityClass}`}>
        {priority ? t(`list.priority.${priority}`) : "—"}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {task.profiles ? (
          <>
            <ClickableAvatar
              userId={task.user_id}
              name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
              src={task.profiles.avatar_url}
              size="xs"
            />
            <ClickableName userId={task.user_id} className="text-xs text-inkSoft truncate">
              {displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
            </ClickableName>
          </>
        ) : (
          <span className="text-xs text-inkFaint">—</span>
        )}
      </div>
      <span className={`text-xs ${overdue ? "text-clay" : "text-inkSoft"}`}>{due || "—"}</span>
      <span className="inline-flex items-center gap-1 text-xs text-inkSoft min-w-0">
        <FolderKanban size={12} className="shrink-0 text-inkFaint" />
        <span className="truncate">{projectName}</span>
      </span>
      <div>
        {tag ? (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-paperDark text-inkSoft">{tag}</span>
        ) : (
          <span className="text-xs text-inkFaint">—</span>
        )}
      </div>
    </div>
  );
}
