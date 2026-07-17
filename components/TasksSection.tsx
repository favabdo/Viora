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
import { Plus, Users, X, ListChecks, FolderPlus } from "lucide-react";
import { displayName } from "@/lib/displayName";

export default function TasksSection({ currentUserId }: { currentUserId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

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

  async function deleteProject(id: string) {
    if (!confirm("هل تريد حذف هذا المشروع مع جميع المهام الموجودة فيه؟")) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) {
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
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

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneCount = tasks.filter((t) => t.is_done).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
      {/* Sidebar: قائمة المشاريع */}
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
                    active ? "bg-teal text-paper font-medium" : "hover:bg-paperDark text-ink"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.user_id !== currentUserId && (
                    <Users
                      size={11}
                      strokeWidth={2}
                      className={`shrink-0 ${active ? "text-paper/70" : "text-inkFaint"}`}
                    />
                  )}
                </button>
                {p.user_id === currentUserId && (
                  <IconButton
                    size="sm"
                    tone="danger"
                    aria-label={`حذف مشروع ${p.name}`}
                    onClick={() => deleteProject(p.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <X size={13} strokeWidth={2} />
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

      {/* Main: المهام */}
      <section className="fade-in min-h-[300px] min-w-0">
        {activeProject ? (
          <>
            <div className="flex items-center justify-between mb-4 border-b border-line pb-3 gap-3">
              <h2 className="font-display text-xl font-medium truncate">{activeProject.name}</h2>
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
                      <span className={`task-title flex-1 text-sm min-w-0 break-words ${task.is_done ? "done" : ""}`}>
                        {task.title}
                      </span>
                      {task.profiles && (
                        <span className="text-2xs text-inkFaint shrink-0 pt-0.5">
                          {displayName(task.user_id, task.profiles, currentUserId)}
                        </span>
                      )}
                      <IconButton
                        size="sm"
                        tone="danger"
                        aria-label="حذف المهمة"
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 shrink-0"
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
    </div>
  );
}
