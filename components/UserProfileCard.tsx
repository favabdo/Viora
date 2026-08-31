"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  ChevronDown,
  Copy,
  FileText,
  Filter,
  FolderKanban,
  Mail,
  MessageSquare,
  Pencil,
  Settings,
  X,
} from "lucide-react";
import { supabase, ActivityEntry, BoardColumn, Profile, Project, Task } from "@/lib/supabase";
import { normalizeTask } from "@/lib/taskShape";
import { renderActivity, resolveName } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { getStoredSettings } from "@/lib/useSettings";
import Avatar from "./ui/Avatar";

type AccessRole = "viewer" | "commenter" | "editor" | "admin";

type TabId = "overview" | "projects" | "tasks" | "activity";
type TaskFilter = "all" | "assigned" | "created";
type ActivityFilter = "all" | "tasks" | "comments" | "files";

const ACCENT = "#6C5CE7";
const PROJECT_COLORS = ["#6C5CE7", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#EAB308"];
const ROLES_KEY = "viora-member-roles";
const TASK_ACTIONS = new Set([
  "task_created",
  "task_completed",
  "task_reopened",
  "task_title_changed",
  "task_deleted",
  "task_status_changed",
  "task_due_changed",
  "task_due_cleared",
  "task_start_changed",
  "task_priority_changed",
  "task_assignee_changed",
  "task_unassigned",
]);
const COMMENT_ACTIONS = new Set(["comment_added", "comment_deleted"]);
const FILE_ACTIONS = new Set(["file_uploaded", "file_deleted"]);

type SharedProject = Project & { role: AccessRole | "owner" };

function colorForProject(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

function readProjectRole(projectId: string, userId: string): AccessRole {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, AccessRole>>) : {};
    return all[projectId]?.[userId] || "editor";
  } catch {
    return "editor";
  }
}

function parseSkills(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function priorityOf(task: Task): "high" | "medium" | "low" | null {
  if (!task.color) return null;
  if (task.color === "#ef4444" || task.color === "#a855f7") return "high";
  if (task.color === "#f97316" || task.color === "#eab308") return "medium";
  return "low";
}

function statusOf(task: Task, columns: BoardColumn[]): { key: "done" | "progress" | "todo"; labelKey: string; dot: string } {
  const column = columns.find((c) => c.id === task.column_id);
  if (task.is_done || column?.is_done_column) {
    return { key: "done", labelKey: "timeline.completed", dot: "#22C55E" };
  }
  const name = (column?.name || "").toLowerCase();
  if (name.includes("progress") || name.includes("review") || name.includes("تنفيذ") || name.includes("مراجعة")) {
    return { key: "progress", labelKey: "timeline.inProgress", dot: "#3B82F6" };
  }
  return { key: "todo", labelKey: "timeline.todo", dot: "#F59E0B" };
}

function inferAction(entry: ActivityEntry): string {
  if (entry.action) return entry.action;
  const msg = (entry.message || "").toLowerCase();
  if (msg.includes("comment") || msg.includes("تعليق")) return "comment_added";
  if (msg.includes("file") || msg.includes("ملف")) return "file_uploaded";
  return "task_created";
}

async function loadProfileRow(userId: string): Promise<Profile | null> {
  const full = await supabase
    .from("profiles")
    .select("id, username, full_name, email, avatar_url, created_at, bio, location, timezone, skills")
    .eq("id", userId)
    .single();
  if (!full.error && full.data) return full.data as Profile;
  const basic = await supabase
    .from("profiles")
    .select("id, username, full_name, email, avatar_url, created_at")
    .eq("id", userId)
    .single();
  if (!basic.error && basic.data) return basic.data as Profile;
  return null;
}

export default function UserProfileCard({
  userId,
  currentUserId,
  onClose,
}: {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const isSelf = userId === currentUserId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const [projects, setProjects] = useState<SharedProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<string>>(new Set());
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [copied, setCopied] = useState("");
  const [mounted, setMounted] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowActivityMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTab("overview");
    setShowAllProjects(false);
    setShowAllTasks(false);
    setShowAllActivity(false);
    setTaskFilter("all");
    setActivityFilter("all");

    async function load() {
      const row = await loadProfileRow(userId);
      if (!active) return;
      setProfile(row);

      const { data: visibleProjects } = await supabase.from("projects").select("id, name, user_id, created_at");
      const mine = (visibleProjects || []) as Project[];
      const ids = mine.map((p) => p.id);

      let memberIds = new Set<string>();
      if (ids.length > 0) {
        const { data: memberships } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", userId)
          .eq("status", "accepted")
          .in("project_id", ids);
        memberIds = new Set((memberships || []).map((m) => m.project_id as string));
      }

      const shared: SharedProject[] = mine
        .filter((p) => p.user_id === userId || memberIds.has(p.id))
        .map((p) => ({
          ...p,
          role: p.user_id === userId ? "owner" : readProjectRole(p.id, userId),
        }));

      if (!active) return;
      setProjects(shared);
      const sharedIds = shared.map((p) => p.id);

      if (sharedIds.length === 0) {
        setTasks([]);
        setColumns([]);
        setActivity([]);
        setCreatedTaskIds(new Set());
        setCommentCount(0);
        setLoading(false);
        return;
      }

      const [tasksRes, colsRes, actRes, createdRes, commentsRes] = await Promise.all([
        supabase.from("tasks").select("*").in("project_id", sharedIds),
        supabase.from("board_columns").select("*").in("project_id", sharedIds),
        supabase
          .from("activity_log")
          .select("*")
          .eq("actor_id", userId)
          .in("project_id", sharedIds)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("activity_log")
          .select("task_id")
          .eq("actor_id", userId)
          .eq("action", "task_created")
          .in("project_id", sharedIds),
        supabase
          .from("task_comments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .in("project_id", sharedIds),
      ]);

      if (!active) return;
      setTasks((tasksRes.data || []).map((row) => normalizeTask(row as Record<string, unknown>)));
      setColumns((colsRes.data || []) as BoardColumn[]);
      setActivity((actRes.data || []) as ActivityEntry[]);
      setCreatedTaskIds(new Set((createdRes.data || []).map((r) => r.task_id as string).filter(Boolean)));
      setCommentCount(commentsRes.count || 0);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [userId]);

  const name = profile ? resolveName(profile, t("common.user")) : "";
  const skills = parseSkills(profile?.skills);
  const timezone =
    profile?.timezone ||
    (isSelf
      ? getStoredSettings().timezone === "auto"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : getStoredSettings().timezone
      : "");

  const headerRole = useMemo(() => {
    if (projects.some((p) => p.role === "owner")) return "owner";
    if (projects.some((p) => p.role === "admin")) return "admin";
    if (projects.some((p) => p.role === "editor")) return "editor";
    if (projects[0]) return projects[0].role;
    return null;
  }, [projects]);

  const assignedTasks = useMemo(() => tasks.filter((task) => task.user_id === userId), [tasks, userId]);
  const createdTasks = useMemo(() => tasks.filter((task) => createdTaskIds.has(task.id)), [tasks, createdTaskIds]);
  const visibleTasks = useMemo(() => {
    if (taskFilter === "assigned") return assignedTasks;
    if (taskFilter === "created") return createdTasks;
    const seen = new Set<string>();
    return [...assignedTasks, ...createdTasks].filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }, [taskFilter, assignedTasks, createdTasks]);

  const completedCount = assignedTasks.filter((task) => task.is_done).length;
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const filteredActivity = useMemo(() => {
    return activity.filter((entry) => {
      const action = inferAction(entry);
      if (activityFilter === "tasks") return TASK_ACTIONS.has(action) || (!COMMENT_ACTIONS.has(action) && !FILE_ACTIONS.has(action));
      if (activityFilter === "comments") return COMMENT_ACTIONS.has(action);
      if (activityFilter === "files") return FILE_ACTIONS.has(action);
      return true;
    });
  }, [activity, activityFilter]);

  function roleLabel(role: AccessRole | "owner") {
    if (role === "owner") return t("userCard.role.owner");
    return t(`share.role.${role}`);
  }

  function roleClass(role: AccessRole | "owner") {
    if (role === "owner" || role === "admin") return "bg-[#6C5CE7]/12 text-[#6C5CE7]";
    if (role === "editor") return "bg-[#3B82F6]/12 text-[#2563EB]";
    if (role === "commenter") return "bg-[#F59E0B]/12 text-[#D97706]";
    return "bg-paperDark text-inkSoft";
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
      setShowMore(false);
    } catch {
      /* ignore */
    }
  }

  function joinedLabel() {
    if (!profile?.created_at) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(profile.created_at)
      );
    } catch {
      return profile.created_at.slice(0, 10);
    }
  }

  const shownProjects = showAllProjects ? projects : projects.slice(0, 4);
  const shownTasks = showAllTasks ? visibleTasks : visibleTasks.slice(0, 5);
  const shownActivity = showAllActivity ? filteredActivity : filteredActivity.slice(0, 6);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "overview", label: t("userCard.tab.overview") },
    { id: "projects", label: t("userCard.tab.projects"), count: projects.length },
    {
      id: "tasks",
      label: t("userCard.tab.tasks"),
      count: new Set([...assignedTasks, ...createdTasks].map((task) => task.id)).size,
    },
    { id: "activity", label: t("userCard.tab.activity") },
  ];

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 fade-in" onClick={onClose}>
      <div
        className="w-full max-w-[720px] rounded-2xl border border-line bg-surface shadow-modal max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-[#6C5CE7]/10 px-6 pt-7 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 end-3 h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-surface/70"
            aria-label={t("common.close")}
          >
            <X size={16} strokeWidth={1.75} />
          </button>

          {loading ? (
            <div className="flex flex-col items-center">
              <div className="skeleton h-[72px] w-[72px] rounded-full mb-3" />
              <div className="skeleton h-5 w-40 rounded-sm mb-2" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          ) : !profile ? (
            <p className="text-sm text-inkSoft text-center py-6">{t("userCard.loadFailed")}</p>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar name={name} src={profile.avatar_url} size="lg" className="h-[72px] w-[72px] text-2xl mb-3" />
              <h3 className="text-lg font-semibold text-ink tracking-tight">{name}</h3>
              {headerRole && (
                <span className={`mt-1.5 inline-flex text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${roleClass(headerRole)}`}>
                  {roleLabel(headerRole)}
                </span>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {isSelf ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push("/profile");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#6C5CE7] hover:bg-[#5b4bd6] text-white text-xs font-semibold px-3 py-2"
                    >
                      <Pencil size={13} strokeWidth={2} />
                      {t("userCard.editProfile")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push("/settings");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface text-ink text-xs font-semibold px-3 py-2 hover:bg-paperDark"
                    >
                      <Settings size={13} strokeWidth={2} />
                      {t("settings.title")}
                    </button>
                  </>
                ) : (
                  <>
                    <a
                      href={profile.email ? `mailto:${profile.email}` : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-lg bg-[#6C5CE7] hover:bg-[#5b4bd6] text-white text-xs font-semibold px-3 py-2 ${
                        profile.email ? "" : "pointer-events-none opacity-50"
                      }`}
                    >
                      <MessageSquare size={13} strokeWidth={2} />
                      {t("userCard.message")}
                    </a>
                    <a
                      href={profile.email ? `mailto:${profile.email}` : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface text-ink text-xs font-semibold px-3 py-2 hover:bg-paperDark ${
                        profile.email ? "" : "pointer-events-none opacity-50"
                      }`}
                    >
                      <Mail size={13} strokeWidth={2} />
                      {t("userCard.email")}
                    </a>
                  </>
                )}
                <div className="relative" ref={moreRef}>
                  <button
                    type="button"
                    onClick={() => setShowMore((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface text-ink text-xs font-semibold px-3 py-2 hover:bg-paperDark"
                  >
                    {t("userCard.more")}
                    <ChevronDown size={12} />
                  </button>
                  {showMore && (
                    <div className="absolute top-full start-0 mt-1 z-10 min-w-[180px] rounded-xl border border-line bg-surface shadow-modal p-1 fade-in">
                      <button
                        type="button"
                        onClick={() => copyText(`@${profile.username}`, "user")}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-inkSoft hover:bg-paperDark hover:text-ink text-start"
                      >
                        <Copy size={12} />
                        {copied === "user" ? t("share.copied") : t("userCard.copyUsername")}
                      </button>
                      {profile.email && (
                        <button
                          type="button"
                          onClick={() => copyText(profile.email || "", "email")}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-inkSoft hover:bg-paperDark hover:text-ink text-start"
                        >
                          <Copy size={12} />
                          {copied === "email" ? t("share.copied") : t("userCard.copyEmail")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex border-b border-line px-4 gap-1 overflow-x-auto thin-scroll">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative shrink-0 px-3 py-2.5 text-[13px] font-medium ${
                  active ? "text-[#6C5CE7]" : "text-inkFaint hover:text-inkSoft"
                }`}
              >
                {item.label}
                {item.count != null ? ` (${item.count})` : ""}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: ACCENT }} />}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll px-6 py-5">
          {loading || !profile ? null : tab === "overview" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2">{t("userCard.about")}</h4>
                <p className="text-sm text-inkSoft leading-relaxed mb-5">
                  {profile.bio?.trim() || t("userCard.noBio")}
                </p>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-inkFaint">{t("userCard.email")}</dt>
                    <dd className="min-w-0 flex items-center gap-1.5 text-ink">
                      <span dir="ltr" className="truncate">
                        {profile.email || "—"}
                      </span>
                      {profile.email && (
                        <button type="button" onClick={() => copyText(profile.email || "", "email")} className="text-inkFaint hover:text-ink">
                          <Copy size={12} />
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-inkFaint">{t("userCard.detailRole")}</dt>
                    <dd className="text-ink">{headerRole ? roleLabel(headerRole) : "—"}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-inkFaint">{t("userCard.joined")}</dt>
                    <dd className="text-ink">{joinedLabel()}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-inkFaint">{t("userCard.location")}</dt>
                    <dd className="text-ink">{profile.location?.trim() || "—"}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-inkFaint">{t("userCard.timezone")}</dt>
                    <dd className="text-ink" dir="ltr">
                      {timezone || "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink mb-2">{t("userCard.skills")}</h4>
                {skills.length === 0 ? (
                  <p className="text-sm text-inkFaint mb-6">{t("userCard.noSkills")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-paperDark text-inkSoft text-[11px] font-medium px-2.5 py-1">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <h4 className="text-xs font-semibold text-ink mb-3">{t("userCard.stats")}</h4>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2.5 text-inkSoft">
                    <FolderKanban size={14} className="text-inkFaint" />
                    <span className="flex-1">{t("userCard.stat.projects")}</span>
                    <span className="font-semibold text-ink">{projects.length}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-inkSoft">
                    <CheckSquare size={14} className="text-inkFaint" />
                    <span className="flex-1">{t("userCard.stat.completed")}</span>
                    <span className="font-semibold text-ink">{completedCount}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-inkSoft">
                    <MessageSquare size={14} className="text-inkFaint" />
                    <span className="flex-1">{t("userCard.stat.comments")}</span>
                    <span className="font-semibold text-ink">{commentCount}</span>
                  </li>
                  <li className="flex items-center gap-2.5 text-inkSoft">
                    <FileText size={14} className="text-inkFaint" />
                    <span className="flex-1">{t("userCard.stat.files")}</span>
                    <span className="font-semibold text-ink">0</span>
                  </li>
                </ul>
                <p className="text-[11px] text-inkFaint mt-4 leading-relaxed">{t("userCard.sharedOnlyHint")}</p>
              </div>
            </div>
          ) : tab === "projects" ? (
            projects.length === 0 ? (
              <p className="text-sm text-inkFaint text-center py-8">{t("userCard.noSharedProjects")}</p>
            ) : (
              <div>
                <ul className="divide-y divide-line">
                  {shownProjects.map((project) => {
                    const color = colorForProject(project.id);
                    return (
                      <li key={project.id} className="flex items-center gap-3 py-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {initials(project.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{project.name}</p>
                        </div>
                        <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${roleClass(project.role)}`}>
                          {roleLabel(project.role)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {projects.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllProjects(true)}
                    className="mt-3 text-xs font-semibold text-[#6C5CE7] hover:underline"
                    hidden={showAllProjects}
                  >
                    {t("userCard.viewAllProjects")}
                  </button>
                )}
              </div>
            )
          ) : tab === "tasks" ? (
            <div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(
                  [
                    ["all", t("list.allTasks")],
                    ["assigned", isSelf ? t("userCard.tasks.assignedMe") : t("userCard.tasks.assigned")],
                    ["created", isSelf ? t("userCard.tasks.createdMe") : t("userCard.tasks.created")],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTaskFilter(id);
                      setShowAllTasks(false);
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                      taskFilter === id ? "bg-[#6C5CE7] text-white" : "bg-paperDark text-inkSoft hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {shownTasks.length === 0 ? (
                <p className="text-sm text-inkFaint text-center py-8">{t("userCard.noTasks")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {shownTasks.map((task) => {
                    const prio = priorityOf(task);
                    const status = statusOf(task, columns);
                    const prioClass =
                      prio === "high"
                        ? "bg-[#EF4444]/12 text-[#EF4444]"
                        : prio === "medium"
                          ? "bg-[#6C5CE7]/12 text-[#6C5CE7]"
                          : prio === "low"
                            ? "bg-[#22C55E]/12 text-[#16A34A]"
                            : "bg-paperDark text-inkFaint";
                    return (
                      <li key={task.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{task.title}</p>
                          <p className="text-[11px] text-inkFaint truncate">{projectById[task.project_id]?.name || ""}</p>
                        </div>
                        {prio && (
                          <span className={`shrink-0 text-[10px] font-semibold rounded-md px-2 py-0.5 ${prioClass}`}>
                            {t(`list.priority.${prio}`)}
                          </span>
                        )}
                        <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-inkSoft">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.dot }} />
                          {t(status.labelKey)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {visibleTasks.length > 5 && !showAllTasks && (
                <button type="button" onClick={() => setShowAllTasks(true)} className="mt-3 text-xs font-semibold text-[#6C5CE7] hover:underline">
                  {t("userCard.viewAllTasks")}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-ink">{t("userCard.recentActivity")}</h4>
                <div className="relative" ref={filterRef}>
                  <button
                    type="button"
                    onClick={() => setShowActivityMenu((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-inkSoft hover:text-ink"
                  >
                    <Filter size={12} />
                    {t("list.filter")}
                    <ChevronDown size={11} />
                  </button>
                  {showActivityMenu && (
                    <div className="absolute top-full end-0 mt-1 z-10 min-w-[140px] rounded-xl border border-line bg-surface shadow-modal p-1 fade-in">
                      {(
                        [
                          ["all", t("userCard.activity.all")],
                          ["tasks", t("userCard.tab.tasks")],
                          ["comments", t("taskDetail.comments")],
                          ["files", t("workspace.files")],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setActivityFilter(id);
                            setShowActivityMenu(false);
                            setShowAllActivity(false);
                          }}
                          className={`w-full text-start px-2.5 py-1.5 rounded-lg text-xs ${
                            activityFilter === id ? "bg-paperDark text-ink" : "text-inkSoft hover:bg-paperDark hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {shownActivity.length === 0 ? (
                <p className="text-sm text-inkFaint text-center py-8">{t("userCard.noActivity")}</p>
              ) : (
                <ul className="space-y-3">
                  {shownActivity.map((entry) => {
                    const action = inferAction(entry);
                    const Icon = COMMENT_ACTIONS.has(action) ? MessageSquare : FILE_ACTIONS.has(action) ? FileText : CheckSquare;
                    const { rest } = renderActivity(entry, t, currentUserId, true);
                    const projectName = projectById[entry.project_id]?.name;
                    return (
                      <li key={entry.id} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 h-7 w-7 rounded-lg bg-paperDark text-inkSoft inline-flex items-center justify-center shrink-0">
                          <Icon size={13} />
                        </span>
                        <p className="flex-1 min-w-0 text-inkSoft leading-snug">
                          {rest.trim()}
                          {projectName ? ` ${t("userCard.inProject").replace("{name}", projectName)}` : ""}
                        </p>
                        <span className="text-[11px] text-inkFaint whitespace-nowrap font-mono pt-0.5">
                          {timeAgo(entry.created_at, t)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {filteredActivity.length > 6 && !showAllActivity && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity(true)}
                  className="mt-4 text-xs font-semibold text-[#6C5CE7] hover:underline"
                >
                  {t("userCard.viewAllActivity")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
