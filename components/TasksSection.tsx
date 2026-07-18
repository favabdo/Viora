"use client";

import { useEffect, useState } from "react";
import { supabase, Project, Task } from "@/lib/supabase";
import TeamPanel from "./TeamPanel";
import ActivityFeed from "./ActivityFeed";
import ItemHistory from "./ItemHistory";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import { Input } from "./ui/Input";
import EmptyState from "./ui/EmptyState";
import { SkeletonList } from "./ui/Skeleton";
import ProgressBar from "./ui/ProgressBar";
import Modal from "./ui/Modal";
import { Plus, Users, X, ListChecks, FolderPlus, Pencil, Check, LogOut } from "lucide-react";
import { displayName } from "@/lib/displayName";
import ClickableName from "./ClickableName";
import ConfirmPasswordModal from "./ConfirmPasswordModal";

export default function TasksSection({
  currentUserId,
  currentUserEmail,
}: {
  currentUserId: string;
  currentUserEmail: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) loadTasks(activeProjectId);
    else setTasks([]);
  }, [activeProjectId]);

  // لايف: أي تعديل على المهام من أي عضو تاني في المشروع يظهر عندك على طول
  useEffect(() => {
    if (!activeProjectId) return;
    const channel = supabase
      .channel(`tasks-${activeProjectId}`)
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

  async function loadProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) {
      setProjects(data as Project[]);
      if (data.length > 0 && !activeProjectId) setActiveProjectId(data[0].id);
    }
  }

  async function loadTasks(projectId: string) {
    setLoadingTasks(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*, profiles!tasks_user_id_fkey(username, full_name)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (!error && data) setTasks(data as Task[]);
    setLoadingTasks(false);
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
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) {
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
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
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, project_id: activeProjectId, is_done: false })
      .select("*, profiles!tasks_user_id_fkey(username, full_name)")
      .single();
    if (!error && data) {
      setTasks((prev) => [...prev, data as Task]);
      setNewTaskTitle("");
    }
  }

  async function toggleTask(task: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_done: !t.is_done } : t))
    );
    const { error } = await supabase
      .from("tasks")
      .update({ is_done: !task.is_done })
      .eq("id", task.id);
    if (error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_done: task.is_done } : t))
      );
    }
  }

  function requestDeleteTask(task: Task) {
    setDeleteTarget({ type: "task", id: task.id, name: task.title });
  }

  async function performDeleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneCount = tasks.filter((t) => t.is_done).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[212px_1fr] gap-8">
      {/* قائمة المشاريع */}
      <aside className="fade-in">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase">المشاريع</h2>
          <IconButton
            size="sm"
            aria-label="مشروع جديد"
            tone={showNewProject ? "active" : "default"}
            onClick={() => setShowNewProject((s) => !s)}
          >
            <Plus size={14} strokeWidth={2} />
          </IconButton>
        </div>

        {showNewProject && (
          <div className="mb-2.5 fade-in">
            <Input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProject()}
              onBlur={() => !newProjectName && setShowNewProject(false)}
              placeholder="اسم المشروع"
              className="text-sm py-1.5"
            />
          </div>
        )}

        <ul className="space-y-0.5">
          {projects.map((p) => {
            const active = activeProjectId === p.id;
            return (
              <li key={p.id} className="group flex items-center">
                <button
                  onClick={() => setActiveProjectId(p.id)}
                  className={`flex-1 flex items-center gap-1.5 min-w-0 text-right px-2.5 py-1.5 rounded-md text-sm transition-colors ${
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
                    aria-label={`حذف مشروع ${p.name}`}
                    onClick={() => requestDeleteProject(p)}
                    className="shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <X size={13} strokeWidth={2} />
                  </IconButton>
                ) : (
                  <IconButton
                    size="sm"
                    tone="danger"
                    aria-label={`مغادرة مشروع ${p.name}`}
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
                أضف أول مشروع
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
                    aria-label="حفظ اسم المشروع"
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
                      aria-label="تعديل اسم المشروع"
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
                  الفريق
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mb-5">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="أدخل مهمة جديدة ثم اضغط Enter"
              />
              <Button variant="primary" onClick={addTask}>
                <Plus size={15} strokeWidth={2} />
                إضافة
              </Button>
            </div>

            {loadingTasks ? (
              <SkeletonList rows={4} />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="لا توجد مهام في هذا المشروع بعد"
                hint="أدخل أول مهمة في الحقل أعلاه لتبدأ."
              />
            ) : (
              <ul className="border-t border-b border-line divide-y divide-line">
                {tasks.map((task) => (
                  <li key={task.id} className="group px-1 py-2.5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="task-check mt-0.5"
                        checked={task.is_done}
                        onChange={() => toggleTask(task)}
                      />
                      {editingTaskId === task.id ? (
                        <div className="flex-1 flex items-center gap-1.5 min-w-0">
                          <Input
                            autoFocus
                            value={taskTitleDraft}
                            onChange={(e) => setTaskTitleDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveTaskTitle(task)}
                            onBlur={() => saveTaskTitle(task)}
                            className="text-sm py-1"
                          />
                          <IconButton
                            size="sm"
                            aria-label="حفظ عنوان المهمة"
                            tone="active"
                            onClick={() => saveTaskTitle(task)}
                          >
                            <Check size={13} strokeWidth={2} />
                          </IconButton>
                        </div>
                      ) : (
                        <span
                          className={`task-title flex-1 text-sm min-w-0 break-words pt-0.5 ${task.is_done ? "done" : ""}`}
                        >
                          {task.title}
                        </span>
                      )}
                      {task.profiles && editingTaskId !== task.id && (
                        <span className="text-2xs text-inkFaint shrink-0 pt-1">
                          <ClickableName userId={task.user_id}>
                            {displayName(task.user_id, task.profiles, currentUserId)}
                          </ClickableName>
                        </span>
                      )}
                      {editingTaskId !== task.id && (
                        <IconButton
                          size="sm"
                          aria-label="تعديل عنوان المهمة"
                          onClick={() => startEditTask(task)}
                          className="shrink-0 opacity-0 group-hover:opacity-100"
                        >
                          <Pencil size={12} strokeWidth={1.75} />
                        </IconButton>
                      )}
                      <IconButton
                        size="sm"
                        tone="danger"
                        aria-label="حذف المهمة"
                        onClick={() => requestDeleteTask(task)}
                        className="shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <X size={14} strokeWidth={1.75} />
                      </IconButton>
                    </div>
                    <div className="pr-[34px]">
                      <ItemHistory table="activity_log" column="task_id" id={task.id} currentUserId={currentUserId} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ActivityFeed projectId={activeProject.id} currentUserId={currentUserId} />
          </>
        ) : (
          <EmptyState
            icon={FolderPlus}
            title="أضف مشروعًا أولًا لتتمكن من إضافة المهام"
          />
        )}
      </section>

      {showTeam && activeProject && (
        <TeamPanel
          projectId={activeProject.id}
          currentUserId={currentUserId}
          onClose={() => setShowTeam(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmPasswordModal
          email={currentUserEmail}
          title={deleteTarget.type === "project" ? "حذف المشروع؟" : "حذف المهمة؟"}
          message={
            deleteTarget.type === "project"
              ? `أدخل كلمة المرور لتأكيد حذف مشروع "${deleteTarget.name}" مع جميع المهام الموجودة فيه.`
              : `أدخل كلمة المرور لتأكيد حذف مهمة "${deleteTarget.name}".`
          }
          confirmLabel="حذف"
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
          <h3 className="font-display text-lg font-medium mb-2">مغادرة المشروع؟</h3>
          <p className="text-sm text-inkSoft mb-5 leading-relaxed">
            هل أنت متأكد أنك تريد مغادرة مشروع "{leaveTarget.name}"؟ لن تظهر لك مهامه بعد ذلك، ويمكنك
            الانضمام إليه مرة أخرى لو دعاك أحد الأعضاء مجددًا.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={leavingProject} onClick={() => setLeaveTarget(null)}>
              إلغاء
            </Button>
            <Button variant="danger" fullWidth loading={leavingProject} onClick={performLeaveProject}>
              مغادرة
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
