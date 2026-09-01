"use client";

import { useEffect, useState } from "react";
import {
  Star,
  Share2,
  MoreHorizontal,
  ChevronDown,
  LayoutGrid,
  List,
  CalendarDays,
  GanttChart,
  FileText,
  History,
  Settings,
  ArrowRight,
  CheckSquare,
} from "lucide-react";
import { supabase, Project, Task, BoardColumn, ProjectMember } from "@/lib/supabase";
import { normalizeProjectMember, normalizeTask } from "@/lib/taskShape";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { displayName } from "@/lib/displayName";
import BoardView from "./BoardView";
import ProjectListView from "./ProjectListView";
import ProjectCalendarView from "./ProjectCalendarView";
import ProjectTimelineView from "./ProjectTimelineView";
import ProjectHistoryView from "./ProjectHistoryView";
import ComingSoon from "./ComingSoon";
import BoardAnalytics from "./BoardAnalytics";
import TeamPanel from "./TeamPanel";
import ClickableAvatar from "./ClickableAvatar";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import ConfirmPasswordModal from "./ConfirmPasswordModal";
import ProjectSettingsView from "./ProjectSettingsView";

type WorkspaceView = "board" | "list" | "calendar" | "timeline" | "files" | "history" | "settings";

const DEFAULT_COLUMNS = [
  { name: "Backlog", color: "#6C5CE7", position: 0, is_done_column: false },
  { name: "To Do", color: "#3B82F6", position: 1, is_done_column: false },
  { name: "In Progress", color: "#F59E0B", position: 2, is_done_column: false },
  { name: "Review", color: "#EC4899", position: 3, is_done_column: false },
  { name: "Done", color: "#22C55E", position: 4, is_done_column: true },
];

const FAVORITES_KEY = "viora-favorite-projects";

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function ProjectWorkspace({
  projectId,
  currentUserId,
  currentUserEmail,
  onBack,
}: {
  projectId: string;
  currentUserId: string;
  currentUserEmail: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [view, setView] = useState<WorkspaceView>("board");
  const [loading, setLoading] = useState(true);
  const [showTeam, setShowTeam] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  useEffect(() => {
    setFavorited(readFavorites().includes(projectId));
    setView("board");
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [projectRes, projectsRes, tasksRes, columnsRes, membersRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("projects").select("*").order("created_at", { ascending: true }),
        supabase
          .from("tasks")
          .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
          .eq("project_id", projectId),
        supabase.from("board_columns").select("*").eq("project_id", projectId).order("position", { ascending: true }),
        supabase
          .from("project_members")
          .select(
            "id, project_id, user_id, status, invited_by, created_at, profiles!project_members_user_id_fkey(username, full_name, avatar_url)"
          )
          .eq("project_id", projectId)
          .eq("status", "accepted"),
      ]);

      if (cancelled) return;

      if (projectRes.data) {
        setProject(projectRes.data as Project);
      }
      if (projectsRes.data) setProjects(projectsRes.data as Project[]);

      let cols = (!columnsRes.error && columnsRes.data ? columnsRes.data : []) as BoardColumn[];
      if (cols.length === 0) {
        const { data: seeded } = await supabase
          .from("board_columns")
          .insert(DEFAULT_COLUMNS.map((col) => ({ ...col, project_id: projectId })))
          .select();
        if (seeded) cols = seeded as BoardColumn[];
      }
      setColumns(cols);

      let rows: Record<string, unknown>[] = !tasksRes.error && tasksRes.data ? (tasksRes.data as Record<string, unknown>[]) : [];
      if (tasksRes.error) {
        const fallback = await supabase.from("tasks").select("*").eq("project_id", projectId);
        if (!fallback.error && fallback.data) rows = fallback.data as Record<string, unknown>[];
      }
      const normalized = rows.map(normalizeTask);
      setTasks(normalized);
      loadCommentCounts(normalized.map((row) => row.id));

      if (!membersRes.error && membersRes.data) {
        setMembers(membersRes.data.map(normalizeProjectMember));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function reloadMembers() {
    const { data, error } = await supabase
      .from("project_members")
      .select(
        "id, project_id, user_id, status, invited_by, created_at, profiles!project_members_user_id_fkey(username, full_name, avatar_url)"
      )
      .eq("project_id", projectId)
      .eq("status", "accepted");
    if (!error && data) setMembers(data.map(normalizeProjectMember));
  }

  useEffect(() => {
    const tasksChannel = supabase
      .channel(`workspace-tasks-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        async () => {
          const { data } = await supabase
            .from("tasks")
            .select("*, profiles!tasks_user_id_fkey(username, full_name, avatar_url)")
            .eq("project_id", projectId);
          if (data) setTasks(data.map(normalizeTask));
        }
      )
      .subscribe();
    const colsChannel = supabase
      .channel(`workspace-cols-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_columns", filter: `project_id=eq.${projectId}` },
        async () => {
          const { data } = await supabase
            .from("board_columns")
            .select("*")
            .eq("project_id", projectId)
            .order("position", { ascending: true });
          if (data) setColumns(data as BoardColumn[]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(colsChannel);
    };
  }, [projectId]);

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

  function toggleFavorite() {
    const next = readFavorites();
    const exists = next.includes(projectId);
    const updated = exists ? next.filter((id) => id !== projectId) : [...next, projectId];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    setFavorited(!exists);
  }

  async function performDeleteTask(task: Task) {
    setTasks((prev) => prev.filter((item) => item.id !== task.id));
    await supabase.from("tasks").delete().eq("id", task.id);
    setDeleteTask(null);
  }

  const views: { id: WorkspaceView; label: string; icon: typeof LayoutGrid }[] = [
    { id: "board", label: t("workspace.board"), icon: LayoutGrid },
    { id: "list", label: t("workspace.list"), icon: List },
    { id: "calendar", label: t("workspace.calendar"), icon: CalendarDays },
    { id: "timeline", label: t("workspace.timeline"), icon: GanttChart },
    { id: "history", label: t("workspace.history"), icon: History },
    { id: "files", label: t("workspace.files"), icon: FileText },
    { id: "settings", label: t("workspace.settings"), icon: Settings },
  ];

  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const shownMembers = acceptedMembers.slice(0, 4);
  const extraMembers = Math.max(0, acceptedMembers.length - shownMembers.length);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-lg skeleton" />
        <div className="h-9 w-full max-w-lg rounded-lg skeleton" />
        <div className="h-[360px] rounded-xl border border-line bg-surface skeleton" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={CheckSquare}
        title={t("workspace.missing")}
        action={
          <Button variant="primary" onClick={onBack}>
            {t("workspace.back")}
          </Button>
        }
      />
    );
  }

  if (view === "settings") {
    return (
      <>
        <ProjectSettingsView
          project={project}
          members={acceptedMembers}
          tasks={tasks}
          columns={columns}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          onBack={() => setView("board")}
          onViewProject={() => setView("board")}
          onOpenHistory={() => setView("history")}
          onOpenMembers={() => setShowTeam(true)}
          onProjectUpdated={setProject}
          onDeleted={onBack}
        />
        {showTeam && (
          <TeamPanel
            projectId={project.id}
            projectName={project.name}
            currentUserId={currentUserId}
            ownerId={project.user_id}
            onClose={() => {
              setShowTeam(false);
              void reloadMembers();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="fade-in">
      <div className="flex flex-col gap-4 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1 text-xs text-inkFaint hover:text-ink"
            >
              <ArrowRight size={12} className="rtl:rotate-0 ltr:rotate-180" />
              {t("workspace.back")}
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-[26px] font-semibold tracking-tight text-ink truncate">{project.name}</h1>
              <button
                onClick={toggleFavorite}
                aria-label={t("workspace.favorite")}
                className={favorited ? "text-amber" : "text-inkFaint hover:text-amber"}
              >
                <Star size={18} strokeWidth={1.75} fill={favorited ? "currentColor" : "none"} />
              </button>
            </div>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-inkSoft">
              {t("workspace.teamProject")}
              <ChevronDown size={12} />
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setShowTeam(true)}>
              <Share2 size={14} strokeWidth={1.75} />
              {t("workspace.share")}
            </Button>
            <div className="flex items-center ps-1">
              {shownMembers.map((member, index) => (
                <div key={member.id} className={index === 0 ? "" : "-ms-2"} style={{ zIndex: shownMembers.length - index }}>
                  <ClickableAvatar
                    userId={member.user_id}
                    name={displayName(member.user_id, member.profiles, currentUserId, t("common.you"))}
                    src={member.profiles?.avatar_url}
                    size="sm"
                    className="ring-2 ring-paper"
                  />
                </div>
              ))}
              {extraMembers > 0 && (
                <span className="-ms-2 h-6 min-w-6 rounded-full bg-paperDark text-[10px] font-semibold text-inkSoft flex items-center justify-center ring-2 ring-paper px-1">
                  +{extraMembers}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowMore((v) => !v)}
              className="relative h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-surface"
              aria-label={t("workspace.more")}
            >
              <MoreHorizontal size={16} />
              {showMore && (
                <div
                  className="absolute top-full end-0 mt-1 w-48 rounded-xl border border-line bg-paper shadow-modal p-1 z-30 text-start"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-sm text-ink hover:bg-paperDark"
                    onClick={() => {
                      setShowMore(false);
                      setView("settings");
                    }}
                  >
                    {t("workspace.projectSettings")}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-sm text-ink hover:bg-paperDark"
                    onClick={() => {
                      setShowMore(false);
                      setShowTeam(true);
                    }}
                  >
                    {t("workspace.shareProject")}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-sm text-ink hover:bg-paperDark"
                    onClick={() => {
                      setShowMore(false);
                      setShowTeam(true);
                    }}
                  >
                    {t("workspace.menuMembers")}
                  </button>
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
          {views.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`relative shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "text-ink" : "text-inkFaint hover:text-inkSoft"
                }`}
              >
                <Icon size={14} strokeWidth={1.75} />
                {label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#6C5CE7]" />}
              </button>
            );
          })}
        </div>
      </div>

      {view === "board" && (
        <>
          <BoardView
            projectId={project.id}
            projects={projects}
            members={acceptedMembers}
            tasks={tasks}
            columns={columns}
            currentUserId={currentUserId}
            commentCounts={commentCounts}
            onRequestDeleteTask={setDeleteTask}
            onTasksMutated={setTasks}
            onColumnsMutated={setColumns}
            onCommentCountChange={(taskId, delta) => {
              setCommentCounts((prev) => ({ ...prev, [taskId]: Math.max(0, (prev[taskId] ?? 0) + delta) }));
            }}
            onInvitePeople={() => setShowTeam(true)}
          />
          <div className="mt-6">
            <BoardAnalytics
              projects={projects}
              activeProjectId={project.id}
              tasks={tasks}
              columns={columns}
              layout="workspace"
            />
          </div>
        </>
      )}

      {view === "list" && (
        <ProjectListView
          project={project}
          projects={projects}
          tasks={tasks}
          columns={columns}
          currentUserId={currentUserId}
          commentCounts={commentCounts}
          onTasksMutated={setTasks}
        />
      )}

      {view === "calendar" && (
        <ProjectCalendarView
          project={project}
          projects={projects}
          tasks={tasks}
          columns={columns}
          onTasksMutated={setTasks}
        />
      )}
      {view === "timeline" && (
        <ProjectTimelineView
          project={project}
          tasks={tasks}
          currentUserId={currentUserId}
          onTasksMutated={setTasks}
        />
      )}
      {view === "history" && (
        <ProjectHistoryView
          project={project}
          members={acceptedMembers}
          tasks={tasks}
          currentUserId={currentUserId}
        />
      )}
      {view === "files" && <ComingSoon title={t("workspace.files")} icon={FileText} />}

      {showTeam && (
        <TeamPanel
          projectId={project.id}
          projectName={project.name}
          currentUserId={currentUserId}
          ownerId={project.user_id}
          onClose={() => {
            setShowTeam(false);
            void reloadMembers();
          }}
        />
      )}
      {deleteTask && (
        <ConfirmPasswordModal
          email={currentUserEmail}
          title={t("tasks.deleteTaskTitle")}
          message={t("tasks.deleteTaskMessage").replace("{name}", deleteTask.title)}
          confirmLabel={t("common.delete")}
          onCancel={() => setDeleteTask(null)}
          onConfirm={async () => {
            await performDeleteTask(deleteTask);
          }}
        />
      )}
    </div>
  );
}
