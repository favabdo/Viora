"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Project, Task, BoardColumn, TASK_COLORS } from "@/lib/supabase";
import { useSettings } from "@/lib/useSettings";
import BoardView from "./BoardView";
import CalendarView from "./CalendarView";
import TimelineView from "./TimelineView";
import BoardAnalytics from "./BoardAnalytics";
import TeamPanel from "./TeamPanel";
import ItemHistory from "./ItemHistory";
import TaskComments from "./TaskComments";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Avatar from "./ui/Avatar";
import { Input, Textarea } from "./ui/Input";
import EmptyState from "./ui/EmptyState";
import { SkeletonList } from "./ui/Skeleton";
import ProgressBar from "./ui/ProgressBar";
import Modal from "./ui/Modal";
import { Plus, Users, X, ListChecks, FolderPlus, Pencil, Check, LogOut, GripVertical, Palette, LayoutGrid, CalendarDays, GanttChart, Copy } from "lucide-react";
import { displayName } from "@/lib/displayName";
import ClickableName from "./ClickableName";
import ConfirmPasswordModal from "./ConfirmPasswordModal";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { formatTaskDate, normalizeTask } from "@/lib/taskShape";
import { deleteOwnedProject, deleteOwnedTask } from "@/lib/deletes";

/** بيرتب المهام: غير المنجزة فوق (حسب position)، والمنجزة تنزل تحت تلقائيًا */
function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
    return a.position - b.position;
  });
}

export default function TasksSection({
  currentUserId,
  currentUserEmail,
  initialProjectId,
}: {
  currentUserId: string;
  currentUserEmail: string;
  initialProjectId?: string | null;
}) {
  const [contextMenuProject, setContextMenuProject] = useState<Project | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const { t, lang } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const { settings } = useSettings();
  const [viewMode, setViewMode] = useState<"list" | "board" | "calendar" | "timeline">(settings.defaultView);

  useEffect(() => {
    setViewMode(settings.defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.defaultView]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [savingProjectName, setSavingProjectName] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "project"; id: string; name: string } | { type: "task"; id: string; name: string } | null
  >(null);
  const [leaveTarget, setLeaveTarget] = useState<{ id: string; name: string } | null>(null);
  const [leavingProject, setLeavingProject] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [colorPickerTaskId, setColorPickerTaskId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (initialProjectId) setActiveProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (activeProjectId) {
      loadTasks(activeProjectId);
      loadColumns(activeProjectId);
    } else {
      setTasks([]);
      setColumns([]);
    }
  }, [activeProjectId]);

  // قفل قائمة اختيار اللون لو المستخدم دس في أي مكان تاني بره القائمة
  useEffect(() => {
    if (!colorPickerTaskId) return;
    function handleClickOutside() {
      setColorPickerTaskId(null);
    }
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [colorPickerTaskId]);

  // إغلاق القائمة المنبثقة عند النقر خارجها
  useEffect(() => {
    if (!contextMenuProject) return;
    function handleClickOutside() {
      setContextMenuProject(null);
    }
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [contextMenuProject]);

  // لايف: أي تعديل على المهام من أي عضو تاني في المشروع يظهر عندك على طول
  useEffect(() => {
    if (!activeProjectId) return;
    const channel = supabase
      .channel(`tasks-${activeProjectId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${activeProjectId}` },
        () => loadTasks(activeProjectId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProjectId]);

  // لايف: نفس الفكرة لأعمدة البورد (لو حد تاني ضاف/عدّل/حذف عمود)
  useEffect(() => {
    if (!activeProjectId) return;
    const channel = supabase
      .channel(`board-columns-${activeProjectId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_columns", filter: `project_id=eq.${activeProjectId}` },
        () => loadColumns(activeProjectId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProjectId]);

  async function loadProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) {
      const list = data as Project[];
      setProjects(list);
      setActiveProjectId((current) => current ?? initialProjectId ?? list[0]?.id ?? null);
    }
  }

  async function loadTasks(projectId: string) {
    setLoadingTasks(true);
    const primary = await supabase
      .from("tasks")
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .eq("project_id", projectId)
      .order("is_done", { ascending: true })
      .order("position", { ascending: true });
    let rows: Task[] | null =
      !primary.error && primary.data ? (primary.data as Task[]) : null;
    if (!rows) {
      const fallback = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("is_done", { ascending: true })
        .order("position", { ascending: true });
      if (!fallback.error && fallback.data) rows = fallback.data as Task[];
    }
    if (rows) {
      const next = sortTasks(rows.map(normalizeTask));
      setTasks(next);
      loadCommentCounts(next.map((t) => t.id));
    }
    setLoadingTasks(false);
  }

  async function loadColumns(projectId: string) {
    const { data, error } = await supabase
      .from("board_columns")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    if (!error && data) setColumns(data as BoardColumn[]);
  }

  async function loadCommentCounts(taskIds: string[]) {
    if (taskIds.length === 0) {
      setCommentCounts({});
      return;
    }
    const { data, error } = await supabase.from("task_comments").select("task_id").in("task_id", taskIds);
    if (!error && data) {
      const counts: Record<string, number> = {};
      for (const row of data as { task_id: string }[]) {
        counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
      }
      setCommentCounts(counts);
    }
  }

  function handleCommentCountChange(taskId: string, delta: number) {
    setCommentCounts((prev) => ({ ...prev, [taskId]: (prev[taskId] ?? 0) + delta }));
  }

  async function addProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name })
      .select()
      .single();
    if (!error && data) {
      setProjects((prev) => [...prev, data as Project]);
      setActiveProjectId(data.id);
      setNewProjectName("");
      setShowNewProject(false);
    }
  }

  function requestDeleteProject(project: Project) {
    setDeleteTarget({ type: "project", id: project.id, name: project.name });
  }

  async function performDeleteProject(id: string) {
    const message = await deleteOwnedProject(id);
    if (!message) {
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
    } else {
      alert(message || t("tasks.err.deleteProject"));
    }
  }

  function requestLeaveProject(project: Project) {
    setLeaveTarget({ id: project.id, name: project.name });
  }

  async function performLeaveProject() {
    if (!leaveTarget) return;
    setLeavingProject(true);
    const { error } = await supabase.rpc("leave_project", { p_project_id: leaveTarget.id });
    if (!error) {
      const remaining = projects.filter((p) => p.id !== leaveTarget.id);
      setProjects(remaining);
      if (activeProjectId === leaveTarget.id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
      setLeaveTarget(null);
    }
    setLeavingProject(false);
  }

  function startEditProjectName(project: Project) {
    setProjectNameDraft(project.name);
    setEditingProjectName(true);
  }

  async function saveProjectName(project: Project) {
    const name = projectNameDraft.trim();
    if (!name || name === project.name) {
      setEditingProjectName(false);
      return;
    }
    setSavingProjectName(true);
    const { error } = await supabase.from("projects").update({ name }).eq("id", project.id);
    if (!error) {
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name } : p)));
      setEditingProjectName(false);
    }
    setSavingProjectName(false);
  }

  function startEditTask(task: Task) {
    setTaskTitleDraft(task.title);
    setEditingTaskId(task.id);
  }

  async function saveTaskTitle(task: Task) {
    const title = taskTitleDraft.trim();
    if (!title || title === task.title) {
      setEditingTaskId(null);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title } : t)));
    setEditingTaskId(null);
    const { error } = await supabase.from("tasks").update({ title }).eq("id", task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title: task.title } : t)));
    }
  }

  async function addTask() {
    const title = newTaskTitle.trim();
    if (!title || !activeProjectId) return;
    // المهمة الجديدة تتحط فوق كل المهام غير المنجزة تلقائيًا
    const position = tasks.length > 0 ? Math.min(...tasks.map((t) => t.position ?? 0)) - 1000 : 1000;
    // نحطها في أول عمود مش "منجز" افتراضيًا (لو فيه أعمدة أصلاً) عشان تظهر صح في البورد كمان
    const defaultColumn = columns.find((c) => !c.is_done_column);
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, project_id: activeProjectId, is_done: false, position, column_id: defaultColumn?.id ?? null })
      .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (!error && data) {
      setTasks((prev) => sortTasks([normalizeTask(data as Task), ...prev]));
      setNewTaskTitle("");
    }
  }

  // إعادة الترتيب بالسحب: أثناء السحب بنعيد ترتيب القائمة محليًا فورًا لإحساس سلس،
  // وأول ما المستخدم يسيب المهمة بنحسب موضعها الجديد (بين جارتها اللي قبلها واللي بعدها) ونحفظه في القاعدة
  //
  // على الموبايل: الدوسة العادية مش بتفعّل السحب على طول، لازم "دوسة مطوّلة" (long press) الأول
  // عشان اللمسة ماتتلخبطش مع سكرول الصفحة أو تحديد النص. على الماوس (سطح المكتب) السحب بيبدأ فورًا.
  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

  function handleDragStart(e: React.PointerEvent, taskId: string) {
    if (e.pointerType === "touch") {
      longPressStartRef.current = { x: e.clientX, y: e.clientY };
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        setDraggedTaskId(taskId);
      }, 300);
      return;
    }
    e.preventDefault();
    setDraggedTaskId(taskId);
  }

  function handleHandlePointerMove(e: React.PointerEvent) {
    if (longPressTimerRef.current === null || !longPressStartRef.current) return;
    const dx = e.clientX - longPressStartRef.current.x;
    const dy = e.clientY - longPressStartRef.current.y;
    // لو الإصبع اتحرك بشكل ملحوظ قبل ما الدوسة المطوّلة تكتمل، يبقى ده مش قصد سحب — نلغي المؤقت
    if (Math.hypot(dx, dy) > 10) clearLongPressTimer();
  }

  function handleHandlePointerEnd() {
    clearLongPressTimer();
  }

  useEffect(() => {
    if (!draggedTaskId) return;
    clearLongPressTimer();

    function handlePointerMove(e: PointerEvent) {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const row = target?.closest("[data-task-row]") as HTMLElement | null;
      const overId = row?.getAttribute("data-task-row");
      if (!overId || overId === draggedTaskId) return;
      setTasks((prev) => {
        const fromIndex = prev.findIndex((t) => t.id === draggedTaskId);
        const toIndex = prev.findIndex((t) => t.id === overId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    }

    function handlePointerUp() {
      const finishedId = draggedTaskId;
      setDraggedTaskId(null);
      if (!finishedId) return;
      setTasks((current) => {
        const idx = current.findIndex((t) => t.id === finishedId);
        if (idx === -1) return current;
        const prevTask = current[idx - 1];
        const nextTask = current[idx + 1];
        let newPosition: number;
        if (prevTask && nextTask) newPosition = (prevTask.position + nextTask.position) / 2;
        else if (prevTask) newPosition = prevTask.position + 1000;
        else if (nextTask) newPosition = nextTask.position - 1000;
        else newPosition = 1000;
        supabase.from("tasks").update({ position: newPosition }).eq("id", finishedId).then();
        return current.map((t) => (t.id === finishedId ? { ...t, position: newPosition } : t));
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedTaskId]);

  async function toggleTask(task: Task) {
    // المهمة اللي بتتعلّم منجزة تنزل تحت تلقائي، واللي بترجع معلّقة ترجع فوق مع باقي المعلّقات
    setTasks((prev) =>
      sortTasks(prev.map((t) => (t.id === task.id ? { ...t, is_done: !t.is_done } : t)))
    );
    const { error } = await supabase
      .from("tasks")
      .update({ is_done: !task.is_done })
      .eq("id", task.id);
    if (error) {
      setTasks((prev) =>
        sortTasks(prev.map((t) => (t.id === task.id ? { ...t, is_done: task.is_done } : t)))
      );
    }
  }

  async function setTaskColor(task: Task, color: string | null) {
    setColorPickerTaskId(null);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, color } : t)));
    const { error } = await supabase.from("tasks").update({ color }).eq("id", task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, color: task.color ?? null } : t)));
    }
  }

  function requestDeleteTask(task: Task) {
    setDeleteTarget({ type: "task", id: task.id, name: task.title });
  }

  async function performDeleteTask(id: string) {
    const message = await deleteOwnedTask(id);
    if (message) {
      alert(message || t("tasks.err.deleteTask"));
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneCount = tasks.filter((t) => t.is_done).length;

// Context menu functions
async function toggleFavorite(project: Project) {
  // Toggle favorite status - assuming we add is_favorite column to projects table
  const { error } = await supabase
    .from("projects")
    .update({ is_favorite: !project.is_favorite })
    .eq("id", project.id);

  if (error) {
    console.error("Error toggling favorite:", error);
    alert(t("projects.err.toggleFavorite"));
  } else {
    // Update local state
    setProjects(prev =>
      prev.map(p =>
        p.id === project.id
          ? { ...p, is_favorite: !p.is_favorite }
          : p
      )
    );
  }
}

async function toggleArchive(project: Project) {
  // Toggle archive status - assuming we add is_archived column to projects table
  const { error } = await supabase
    .from("projects")
    .update({ is_archived: !project.is_archived })
    .eq("id", project.id);

  if (error) {
    console.error("Error toggling archive:", error);
    alert(t("projects.err.toggleArchive"));
  } else {
    // Update local state
    setProjects(prev =>
      prev.map(p =>
        p.id === project.id
          ? { ...p, is_archived: !p.is_archived }
          : p
      )
    );

    // If archiving the active project, switch to another project if available
    if (activeProjectId === project.id && !project.is_archived) {
      const otherProjects = projects.filter(p => p.id !== project.id && !p.is_archived);
      setActiveProjectId(otherProjects.length > 0 ? otherProjects[0].id : null);
    }
  }
}

async function duplicateProject(project: Project) {
  // Create a duplicate of the project
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: `${project.name} (نسخة)`,
      user_id: project.user_id
    })
    .select()
    .single();

  if (!error && data) {
    setProjects(prev => [...prev, data as Project]);
    // Optionally switch to the new project
    setActiveProjectId(data.id);
  } else {
    console.error("Error duplicating project:", error);
    alert(t("projects.err.duplicate"));
  }
}

  return (
    <div className="grid grid-cols-1 md:grid-cols-[212px_1fr] gap-8">
      {/* قائمة المشاريع */}
      <aside className="fade-in">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">{t("tasks.projects")}</h2>
          <IconButton
            size="sm"
            aria-label={t("tasks.newProject")}
            tone={showNewProject ? "active" : "default"}
            onClick={() => setShowNewProject((s) => !s)}
          >
            <Plus size={14} strokeWidth={2} />
          </IconButton>
        </div>

        {showNewProject && (
          <div className="mb-2.5 fade-in flex items-center gap-1.5">
            <Input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProject()}
              placeholder={t("tasks.projectName")}
              className="text-sm py-1.5"
            />
            <IconButton
              size="sm"
              tone="active"
              aria-label={t("tasks.addProject")}
              onClick={addProject}
              disabled={!newProjectName.trim()}
            >
              <Check size={14} strokeWidth={2} />
            </IconButton>
          </div>
        )}

        <ul className="space-y-0.5">
          {projects.map((p) => {
            const active = activeProjectId === p.id;
            return (
              <li
                key={p.id}
                className="group flex items-center"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuProject(p);
                  setContextMenuPosition({ x: e.clientX, y: e.clientY });
                }}
                onClick={() => setActiveProjectId(p.id)}
              >
                <button
                  className={`flex-1 flex items-center gap-1.5 min-w-0 text-start px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    active ? "bg-teal text-white font-medium" : "hover:bg-paperDark text-ink"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.user_id !== currentUserId && (
                    <Users
                      size={11}
                      strokeWidth={2}
                      className={`shrink-0 ${active ? "text-white/70" : "text-inkFaint"}`}
                    />
                  )}
                </button>
                {p.user_id === currentUserId ? (
                  <IconButton
                    size="sm"
                    tone="danger"
                    aria-label={t("tasks.deleteProjectLabel").replace("{name}", p.name)}
                    onClick={() => requestDeleteProject(p)}
                    className="shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <X size={13} strokeWidth={2} />
                  </IconButton>
                ) : (
                  <IconButton
                    size="sm"
                    tone="danger"
                    aria-label={t("tasks.leaveProjectLabel").replace("{name}", p.name)}
                    onClick={() => requestLeaveProject(p)}
                    className="shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <LogOut size={13} strokeWidth={2} />
                  </IconButton>
                )}
              </li>
            );
          })}
          {projects.length === 0 && !showNewProject && (
            <li>
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full flex items-center gap-2 text-inkFaint hover:text-inkSoft text-sm py-2 transition-colors"
              >
                <FolderPlus size={14} strokeWidth={1.75} />
                {t("tasks.addFirstProject")}
              </button>
            </li>
          )}
        </ul>
      </aside>

      {/* المهام */}
      <section className="fade-in min-h-[300px] min-w-0">
        {activeProject ? (
          <>
            <div className="flex items-center justify-between mb-4 border-b border-line pb-3.5 gap-3">
              {editingProjectName ? (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Input
                    autoFocus
                    value={projectNameDraft}
                    onChange={(e) => setProjectNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveProjectName(activeProject)}
                    onBlur={() => saveProjectName(activeProject)}
                    className="font-display text-lg py-1 h-auto"
                  />
                  <IconButton
                    aria-label={t("tasks.saveProjectName")}
                    tone="active"
                    onClick={() => saveProjectName(activeProject)}
                    disabled={savingProjectName}
                  >
                    <Check size={15} strokeWidth={2} />
                  </IconButton>
                </div>
              ) : (
                <h2 className="font-display text-xl font-medium truncate flex items-center gap-2 min-w-0">
                  <span className="truncate">{activeProject.name}</span>
                  {activeProject.user_id === currentUserId && (
                    <IconButton
                      size="sm"
                      aria-label={t("tasks.editProjectName")}
                      onClick={() => startEditProjectName(activeProject)}
                      className="shrink-0"
                    >
                      <Pencil size={12} strokeWidth={1.75} />
                    </IconButton>
                  )}
                </h2>
              )}
              <div className="flex items-center gap-3 shrink-0">
                {tasks.length > 0 && <ProgressBar value={doneCount} total={tasks.length} />}
                <Button variant="secondary" size="sm" onClick={() => setShowTeam(true)}>
                  <Users size={13} strokeWidth={1.75} />
                  {t("tasks.team")}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 rounded-md border border-line p-0.5 mb-5 w-fit">
                  {(
                    [
                  ["list", t("views.list"), ListChecks],
                  ["board", t("views.board"), LayoutGrid],
                  ["calendar", t("views.calendar"), CalendarDays],
                  ["timeline", t("views.timeline"), GanttChart],
                ] as [typeof viewMode, string, typeof ListChecks][]
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    viewMode === key ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:text-ink"
                  }`}
                >
                  <Icon size={13} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>

            {viewMode !== "board" && (
              <div className="flex gap-2 mb-5">
                <Textarea
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  placeholder={t("tasks.newTaskPlaceholder")}
                />
                <Button variant="primary" onClick={addTask}>
                  <Plus size={15} strokeWidth={2} />
                  {t("tasks.add")}
                </Button>
              </div>
            )}

            {viewMode === "board" ? (
              <BoardView
                projectId={activeProject.id}
                projects={projects}
                members={[]}
                tasks={tasks}
                columns={columns}
                currentUserId={currentUserId}
                commentCounts={commentCounts}
                onRequestDeleteTask={requestDeleteTask}
                onTasksMutated={setTasks}
                onColumnsMutated={setColumns}
                onCommentCountChange={(taskId, delta) => {
                  setCommentCounts((prev) => ({ ...prev, [taskId]: Math.max(0, (prev[taskId] ?? 0) + delta) }));
                }}
                onInvitePeople={() => setShowTeam(true)}
              />
            ) : viewMode === "calendar" ? (
              <CalendarView
                tasks={tasks}
                onTasksMutated={setTasks}
                currentUserId={currentUserId}
                projectName={activeProject.name}
              />
            ) : viewMode === "timeline" ? (
              <TimelineView tasks={tasks} columns={columns} onTasksMutated={setTasks} />
            ) : loadingTasks ? (
              <SkeletonList rows={4} />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title={t("tasks.emptyProjectTitle")}
                hint={t("tasks.emptyProjectHint")}
              />
            ) : (
              <div className="border-t border-line">
                {(() => {
                  const grouped = columns.map((col) => ({
                    column: col,
                    items: tasks.filter((t2) => t2.column_id === col.id),
                  }));
                  const uncategorized = tasks.filter((t2) => !t2.column_id || !columns.some((c) => c.id === t2.column_id));
                  if (uncategorized.length > 0) {
                    grouped.push({
                      column: { id: "uncategorized", name: t("tasks.noColumn"), color: "#6b7280" } as BoardColumn,
                      items: uncategorized,
                    });
                  }
                  return grouped
                    .filter((g) => g.items.length > 0)
                    .map(({ column, items }) => (
                      <div key={column.id}>
                        <div className="flex items-center gap-2 px-1 py-2 bg-paperDark/40">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                          <span className="text-xs font-semibold text-ink">{column.name}</span>
                          <span className="text-2xs text-inkFaint">{items.length}</span>
                        </div>
                        <ul className="border-b border-line divide-y divide-line">
                          {items.map((task) => (
                            <li
                              key={task.id}
                              data-task-row={task.id}
                              className={`group relative px-1 py-2.5 transition-opacity ${
                                draggedTaskId === task.id ? "opacity-40" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  onPointerDown={(e) => handleDragStart(e, task.id)}
                                  onPointerMove={handleHandlePointerMove}
                                  onPointerUp={handleHandlePointerEnd}
                                  onPointerCancel={handleHandlePointerEnd}
                                  onContextMenu={(e) => e.preventDefault()}
                                  aria-label={t("tasks.dragHandle")}
                                  className="task-drag-handle relative z-10 mt-1 shrink-0 cursor-grab text-inkFaint hover:text-inkSoft active:cursor-grabbing"
                                >
                                  <GripVertical size={14} strokeWidth={1.75} />
                                </span>
                                <input
                                  type="checkbox"
                                  className="task-check relative z-10 mt-0.5"
                                  checked={task.is_done}
                                  onChange={() => toggleTask(task)}
                                />
                                {editingTaskId === task.id ? (
                                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                    <Textarea
                                      autoFocus
                                      value={taskTitleDraft}
                                      onChange={(e) => setTaskTitleDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          saveTaskTitle(task);
                                        }
                                      }}
                                      onBlur={() => saveTaskTitle(task)}
                                      className="text-sm py-1.5"
                                    />
                                    <IconButton
                                      size="sm"
                                      aria-label={t("tasks.saveTaskTitle")}
                                      tone="active"
                                      onClick={() => saveTaskTitle(task)}
                                    >
                                      <Check size={13} strokeWidth={2} />
                                    </IconButton>
                                  </div>
                                ) : (
                                  <div className="flex-1 min-w-0">
                                    <span
                                      className={`task-title block text-sm break-words pt-0.5 ${task.is_done ? "done" : ""}`}
                                    >
                                      {task.title}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
                                      {task.due_date && (
                                        <span className="text-[10px] text-inkFaint">
                                          {formatTaskDate(task.due_date, lang === "ar" ? "ar-EG" : "en-US")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {task.profiles && editingTaskId !== task.id && (
                                  <span className="flex items-center gap-1 text-2xs text-inkFaint shrink-0 pt-0.5">
                                    <ClickableName userId={task.user_id} className="flex items-center gap-1">
                                      <Avatar
                                        name={displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
                                        src={task.profiles.avatar_url}
                                        size="xs"
                                      />
                                      {displayName(task.user_id, task.profiles, currentUserId, t("common.you"))}
                                    </ClickableName>
                                  </span>
                                )}
                                {editingTaskId !== task.id && (
                                  <IconButton
                                    size="sm"
                                    aria-label={t("tasks.editTaskTitle")}
                                    onClick={() => startEditTask(task)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100"
                                  >
                                    <Pencil size={12} strokeWidth={1.75} />
                                  </IconButton>
                                )}
                                {editingTaskId !== task.id && (
                                  <div className="relative shrink-0" onPointerDown={(e) => e.stopPropagation()}>
                                    <IconButton
                                      size="sm"
                                      aria-label={t("tasks.setColor")}
                                      tone={task.color ? "active" : "default"}
                                      onClick={() => setColorPickerTaskId((id) => (id === task.id ? null : task.id))}
                                      className="opacity-0 group-hover:opacity-100 data-[open=true]:opacity-100"
                                      data-open={colorPickerTaskId === task.id}
                                    >
                                      <Palette size={13} strokeWidth={1.75} style={task.color ? { color: task.color } : undefined} />
                                    </IconButton>
                                    {colorPickerTaskId === task.id && (
                                      <div className="absolute start-0 bottom-full mb-1 z-30 flex items-center gap-1 bg-paper border border-line rounded-md shadow-modal p-1.5 fade-in">
                                        <button
                                          type="button"
                                          aria-label={t("tasks.noColor")}
                                          onClick={() => setTaskColor(task, null)}
                                          className="h-5 w-5 rounded-full border border-dashed border-inkFaint hover:border-ink"
                                        />
                                        {TASK_COLORS.map((c) => (
                                          <button
                                            key={c.name}
                                            type="button"
                                            title={t(`taskColor.${c.name}`)}
                                            aria-label={t("tasks.colorLabel").replace("{label}", t(`taskColor.${c.name}`))}
                                            onClick={() => setTaskColor(task, c.value)}
                                            className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                                              task.color === c.value ? "ring-2 ring-offset-1 ring-ink" : ""
                                            }`}
                                            style={{ backgroundColor: c.value }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <IconButton
                                  size="sm"
                                  tone="danger"
                                  aria-label={t("tasks.deleteTask")}
                                  onClick={() => requestDeleteTask(task)}
                                  className="shrink-0 opacity-0 group-hover:opacity-100"
                                >
                                  <X size={14} strokeWidth={1.75} />
                                </IconButton>
                              </div>
                              <div className="ps-[52px] flex flex-col gap-0.5">
                                <ItemHistory table="activity_log" column="task_id" id={task.id} currentUserId={currentUserId} />
                                <TaskComments
                                  taskId={task.id}
                                  projectId={task.project_id}
                                  currentUserId={currentUserId}
                                  count={commentCounts[task.id] ?? 0}
                                  onCountChange={handleCommentCountChange}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ));
                })()}
              </div>
            )}
              </div>

              <aside className="hidden lg:block w-72 shrink-0 sticky top-20">
                <BoardAnalytics
                  projects={projects}
                  activeProjectId={activeProject.id}
                  tasks={tasks}
                  columns={columns}
                  compact
                />
              </aside>
            </div>

            <div className="lg:hidden mt-6">
              <BoardAnalytics projects={projects} activeProjectId={activeProject.id} tasks={tasks} columns={columns} />
            </div>
          </>
        ) : projects.length > 0 ? (
          <EmptyState
            icon={ListChecks}
            title={t("tasks.selectProjectTitle")}
            hint={t("tasks.selectProjectHint")}
          />
        ) : (
          <EmptyState
            icon={FolderPlus}
            title={t("tasks.addProjectFirstTitle")}
          />
        )}
      </section>

      {showTeam && activeProject && (
        <TeamPanel
          projectId={activeProject.id}
          projectName={activeProject.name}
          currentUserId={currentUserId}
          ownerId={activeProject.user_id}
          onClose={() => setShowTeam(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmPasswordModal
          email={currentUserEmail}
          title={deleteTarget.type === "project" ? t("tasks.deleteProjectTitle") : t("tasks.deleteTaskTitle")}
          message={
            deleteTarget.type === "project"
              ? t("tasks.deleteProjectMessage").replace("{name}", deleteTarget.name)
              : t("tasks.deleteTaskMessage").replace("{name}", deleteTarget.name)
          }
          confirmLabel={t("common.delete")}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (deleteTarget.type === "project") await performDeleteProject(deleteTarget.id);
            else await performDeleteTask(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}

      {leaveTarget && (
        <Modal onClose={() => !leavingProject && setLeaveTarget(null)} maxWidth="max-w-xs">
          <h3 className="font-display text-lg font-medium mb-2">{t("tasks.leaveProjectTitle")}</h3>
          <p className="text-sm text-inkSoft mb-5 leading-relaxed">
            {t("tasks.leaveProjectMessage").replace("{name}", leaveTarget.name)}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={leavingProject} onClick={() => setLeaveTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" fullWidth loading={leavingProject} onClick={performLeaveProject}>
              {t("tasks.leave")}
            </Button>
          </div>
        </Modal>
      )}

      {/* Project Context Menu */}
      {contextMenuProject && (
        <div className="fixed z-50 pointer-events-none">
          <div
            className={`absolute left-[${contextMenuPosition?.x}px] top-[${contextMenuPosition?.y}px] transform pointer-events-all bg-paper shadow-lg rounded-md border border-line z-50 w-56`}
          >
            <div className="space-y-1 py-2">
              {/* Favorite */}
              <button
                onClick={() => {
                  toggleFavorite(contextMenuProject);
                  setContextMenuProject(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink hover:bg-paperDark hover:text-inkSoft transition-colors"
              >
                <span className="flex-1">{t("projects.favorite")}</span>
                {!!contextMenuProject.is_favorite ? (
                  <Check size={14} strokeWidth={1.5} className="shrink-0 text-teal" />
                ) : (
                  <Plus size={14} strokeWidth={1.5} className="shrink-0 text-inkFaint" />
                )}
              </button>

              {/* Archive */}
              <button
                onClick={() => {
                  toggleArchive(contextMenuProject);
                  setContextMenuProject(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink hover:bg-paperDark hover:text-inkSoft transition-colors"
              >
                <span className="flex-1">{t("projects.archive")}</span>
                {!!contextMenuProject.is_archived ? (
                  <Check size={14} strokeWidth={1.5} className="shrink-0 text-teal" />
                ) : (
                  <FolderPlus size={14} strokeWidth={1.5} className="shrink-0 text-inkFaint" />
                )}
              </button>

              {/* Edit */}
              <button
                onClick={() => {
                  startEditProjectName(contextMenuProject);
                  setContextMenuProject(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink hover:bg-paperDark hover:text-inkSoft transition-colors"
              >
                <span className="flex-1">{t("projects.edit")}</span>
                <Pencil size={14} strokeWidth={1.5} className="shrink-0" />
              </button>

              {/* Duplicate */}
              <button
                onClick={() => {
                  duplicateProject(contextMenuProject);
                  setContextMenuProject(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink hover:bg-paperDark hover:text-inkSoft transition-colors"
              >
                <span className="flex-1">{t("projects.duplicate")}</span>
                <Copy size={14} strokeWidth={1.5} className="shrink-0" />
              </button>

              {/* Delete */}
              {contextMenuProject.user_id === currentUserId && (
                <button
                  onClick={() => {
                    requestDeleteProject(contextMenuProject);
                    setContextMenuProject(null);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink hover:bg-paperDark hover:text-inkSoft transition-colors"
                >
                  <span className="flex-1">{t("projects.delete")}</span>
                  <X size={14} strokeWidth={1.5} className="shrink-0 text-clay" />
                </button>
              )}

              {/* Leave */}
              {contextMenuProject.user_id !== currentUserId && (
                <button
                  onClick={() => {
                    requestLeaveProject(contextMenuProject);
                    setContextMenuProject(null);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink hover:bg-paperDark hover:text-inkSoft transition-colors"
                >
                  <span className="flex-1">{t("projects.leave")}</span>
                  <LogOut size={14} strokeWidth={1.5} className="shrink-0 text-clay" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
