"use client";

import { useEffect, useState } from "react";
import { supabase, Project, Task } from "@/lib/supabase";
import TeamPanel from "./TeamPanel";
import ActivityFeed from "./ActivityFeed";
import ItemHistory from "./ItemHistory";

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
      .select("*, profiles!tasks_user_id_fkey(username)")
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
    if (!confirm("تحذف المشروع ده مع كل المهام اللي فيه؟")) return;
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
      .select("*, profiles!tasks_user_id_fkey(username)")
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
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      {/* Sidebar: قائمة المشاريع */}
      <aside className="fade-in">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm tracking-wide text-inkSoft">المشاريع</h2>
          <button
            onClick={() => setShowNewProject((s) => !s)}
            className="text-teal hover:text-tealDark text-lg leading-none w-6 h-6 flex items-center justify-center rounded border border-line hover:border-teal transition-colors"
            aria-label="مشروع جديد"
          >
            +
          </button>
        </div>

        {showNewProject && (
          <div className="mb-3 fade-in">
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProject()}
              placeholder="اسم المشروع"
              className="w-full bg-white border border-line rounded px-3 py-2 text-sm focus:outline-none focus:border-teal"
            />
          </div>
        )}

        <ul className="space-y-1">
          {projects.map((p) => (
            <li key={p.id} className="group flex items-center">
              <button
                onClick={() => setActiveProjectId(p.id)}
                className={`flex-1 text-right px-3 py-2 rounded text-sm transition-colors ${
                  activeProjectId === p.id
                    ? "bg-teal text-paper font-medium"
                    : "hover:bg-paperDark text-ink"
                }`}
              >
                {p.name}
                {p.user_id !== currentUserId && (
                  <span className="text-xs opacity-70 mr-1">🤝</span>
                )}
              </button>
              {p.user_id === currentUserId && (
                <button
                  onClick={() => deleteProject(p.id)}
                  className="opacity-0 group-hover:opacity-100 text-inkSoft hover:text-clay px-2 transition-opacity"
                  aria-label="حذف المشروع"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {projects.length === 0 && (
            <li className="text-inkSoft text-sm py-2">مفيش مشاريع لسه. ضيف واحد بالـ +</li>
          )}
        </ul>
      </aside>

      {/* Main: المهام */}
      <section className="fade-in min-h-[300px]">
        {activeProject ? (
          <>
            <div className="flex items-baseline justify-between mb-4 border-b border-line pb-3">
              <h2 className="font-display text-2xl font-medium">{activeProject.name}</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowTeam(true)}
                  className="text-xs text-teal hover:text-tealDark border border-line hover:border-teal rounded px-2.5 py-1 transition-colors"
                >
                  الفريق
                </button>
                {tasks.length > 0 && (
                  <span className="text-xs font-mono text-inkSoft">
                    {doneCount}/{tasks.length} خلصت
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 mb-5">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="اكتب مهمة جديدة واضغط Enter"
                className="flex-1 bg-white border border-line rounded px-3 py-2.5 text-sm focus:outline-none focus:border-teal"
              />
              <button
                onClick={addTask}
                className="bg-ink text-paper px-4 py-2.5 rounded text-sm hover:bg-tealDark transition-colors"
              >
                إضافة
              </button>
            </div>

            {loadingTasks ? (
              <p className="text-inkSoft text-sm">بتحمّل...</p>
            ) : tasks.length === 0 ? (
              <p className="text-inkSoft text-sm">مفيش مهام في المشروع ده لسه.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="group bg-white border border-line rounded px-3 py-3 shadow-card"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="task-check"
                        checked={task.is_done}
                        onChange={() => toggleTask(task)}
                      />
                      <span className={`task-title flex-1 text-sm ${task.is_done ? "done" : ""}`}>
                        {task.title}
                      </span>
                      {task.profiles?.username && (
                        <span className="text-xs text-teal font-mono shrink-0" dir="ltr">
                          @{task.profiles.username}
                        </span>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-inkSoft hover:text-clay transition-opacity"
                        aria-label="حذف المهمة"
                      >
                        ×
                      </button>
                    </div>
                    <ItemHistory table="activity_log" column="task_id" id={task.id} />
                  </li>
                ))}
              </ul>
            )}
            <ActivityFeed projectId={activeProject.id} />
          </>
        ) : (
          <p className="text-inkSoft text-sm">ضيف مشروع الأول عشان تبدأ تضيف مهام.</p>
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
