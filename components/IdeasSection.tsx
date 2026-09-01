"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  Check,
  Download,
  FileText,
  Filter,
  FolderKanban,
  FolderPlus,
  LayoutGrid,
  Lightbulb,
  List,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase, Project } from "@/lib/supabase";
import { patchTaskExtras, type TaskAttachment } from "@/lib/taskExtras";
import { defaultProjectKey, writeProjectMeta } from "@/lib/projectMeta";
import {
  addIdeaNote,
  createIdea,
  deleteIdea,
  formatBytes,
  ideaFilesToTaskAttachments,
  IDEA_CATEGORIES,
  IDEA_COLORS,
  loadIdeas,
  migrateLocalIdeas,
  updateIdea,
  uploadIdeaAttachments,
  type Idea,
  type IdeaPriority,
  type IdeaStatus,
} from "@/lib/ideas";
import { timeAgo } from "@/lib/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ClickableAvatar from "./ClickableAvatar";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";
import { Input, Textarea } from "./ui/Input";

const PAGE_SIZE = 6;
const MAX_FILE = 1.5 * 1024 * 1024;

const ICONS: { id: string; icon: LucideIcon }[] = [
  { id: "sparkles", icon: Sparkles },
  { id: "monitor", icon: Monitor },
  { id: "phone", icon: Smartphone },
  { id: "chart", icon: BarChart3 },
  { id: "chat", icon: MessageCircle },
  { id: "folder", icon: FolderKanban },
  { id: "file", icon: FileText },
];

const DEFAULT_COLUMNS = [
  { name: "Backlog", color: "#6C5CE7", position: 0, is_done_column: false },
  { name: "To Do", color: "#3B82F6", position: 1, is_done_column: false },
  { name: "In Progress", color: "#F59E0B", position: 2, is_done_column: false },
  { name: "Review", color: "#EC4899", position: 3, is_done_column: false },
  { name: "Done", color: "#22C55E", position: 4, is_done_column: true },
];

const fieldClass =
  "w-full !rounded-xl border border-line bg-paperDark/80 px-3.5 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none focus:!rounded-xl";

type Scope = "all" | "mine" | "favorites" | "archived";
type DetailTab = "overview" | "notes" | "activity" | "files";
type SortKey = "latest" | "oldest" | "priority";

function IdeaIcon({ id, size = 18 }: { id: string; size?: number }) {
  const Icon = ICONS.find((item) => item.id === id)?.icon || Lightbulb;
  return <Icon size={size} strokeWidth={1.75} />;
}

function statusTone(status: IdeaStatus) {
  if (status === "in_progress") return "bg-[#3B82F6]/15 text-[#60A5FA]";
  if (status === "planned") return "bg-[#F59E0B]/15 text-[#FBBF24]";
  if (status === "implemented") return "bg-[#22C55E]/15 text-[#4ADE80]";
  return "bg-paperDark text-inkSoft";
}

function priorityTone(priority: IdeaPriority) {
  if (priority === "high") return "bg-[#EF4444]/15 text-[#F87171]";
  if (priority === "medium") return "bg-[#F59E0B]/15 text-[#FBBF24]";
  return "bg-[#22C55E]/15 text-[#4ADE80]";
}

function categoryTone(category: string) {
  if (category === "AI") return "bg-[#6C5CE7]/15 text-[#A78BFA]";
  if (category === "Mobile") return "bg-[#3B82F6]/15 text-[#60A5FA]";
  if (category === "Design") return "bg-[#EC4899]/15 text-[#F472B6]";
  return "bg-paperDark text-inkSoft";
}

async function filesFromList(list: FileList | null): Promise<{ files: TaskAttachment[]; skipped: boolean }> {
  const files: TaskAttachment[] = [];
  let skipped = false;
  if (!list) return { files, skipped };
  for (const file of Array.from(list)) {
    if (file.size > MAX_FILE) {
      skipped = true;
      continue;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    files.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl,
    });
  }
  return { files, skipped };
}

export default function IdeasSection({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  openCreateSignal,
  selectedIdeaId,
  onSelectIdea,
  onOpenProject,
}: {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  openCreateSignal?: number;
  selectedIdeaId?: string | null;
  onSelectIdea?: (id: string | null) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const { t, lang } = useTranslation();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [page, setPage] = useState(1);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = onSelectIdea ? selectedIdeaId ?? null : internalSelectedId;

  function selectIdea(id: string | null) {
    if (onSelectIdea) onSelectIdea(id);
    else setInternalSelectedId(id);
  }
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("sparkles");
  const [color, setColor] = useState(IDEA_COLORS[0]);
  const [category, setCategory] = useState("AI");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<IdeaStatus>("planned");
  const [priority, setPriority] = useState<IdeaPriority>("medium");
  const [linkedProject, setLinkedProject] = useState("");
  const [formFiles, setFormFiles] = useState<TaskAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const detailFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await migrateLocalIdeas(currentUserId);
      const list = await loadIdeas();
      if (!cancelled) {
        setIdeas(list);
        setLoading(false);
      }
    })();
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) openCreate();
  }, [openCreateSignal]);

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name || "";

  const scoped = useMemo(() => {
    return ideas.filter((idea) => {
      if (scope === "mine" && idea.userId !== currentUserId) return false;
      if (scope === "favorites" && !idea.favorite) return false;
      if (scope === "archived") return idea.status === "archived";
      if (idea.status === "archived") return false;
      return true;
    });
  }, [ideas, scope, currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();
    const list = scoped.filter((idea) => {
      if (categoryFilter !== "all" && idea.category !== categoryFilter) return false;
      if (projectFilter !== "all" && idea.projectId !== projectFilter) return false;
      if (statusFilter !== "all" && idea.status !== statusFilter) return false;
      if (tag && !idea.tags.some((item) => item.toLowerCase().includes(tag))) return false;
      if (q) {
        const hay = `${idea.title} ${idea.description} ${idea.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const rank = { high: 3, medium: 2, low: 1 };
    list.sort((a, b) => {
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "priority") return rank[b.priority] - rank[a.priority];
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [scoped, query, categoryFilter, projectFilter, statusFilter, tagFilter, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selected = ideas.find((idea) => idea.id === selectedId) || null;

  const stats = {
    all: ideas.filter((i) => i.status !== "archived").length,
    in_progress: ideas.filter((i) => i.status === "in_progress").length,
    planned: ideas.filter((i) => i.status === "planned").length,
    implemented: ideas.filter((i) => i.status === "implemented").length,
    archived: ideas.filter((i) => i.status === "archived").length,
  };
  const liveTotal = Math.max(stats.all, 1);

  async function refresh() {
    setIdeas(await loadIdeas());
  }

  function openCreate() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setIcon("sparkles");
    setColor(IDEA_COLORS[0]);
    setCategory("AI");
    setTags("");
    setStatus("planned");
    setPriority("medium");
    setLinkedProject("");
    setFormFiles([]);
    setShowForm(true);
  }

  function openEdit(idea: Idea) {
    setEditing(idea);
    setTitle(idea.title);
    setDescription(idea.description);
    setIcon(idea.icon);
    setColor(idea.color);
    setCategory(idea.category);
    setTags(idea.tags.join(", "));
    setStatus(idea.status);
    setPriority(idea.priority);
    setLinkedProject(idea.projectId || "");
    setFormFiles(idea.attachments);
    setShowForm(true);
    setMenuId(null);
  }

  async function saveForm() {
    const parsedTags = tags.split(/[,،]/).map((item) => item.trim()).filter(Boolean);
    if (!title.trim()) return;
    if (editing) {
      await updateIdea(
        editing.id,
        {
          title: title.trim(),
          description: description.trim(),
          icon,
          color,
          category,
          tags: parsedTags,
          status,
          priority,
          projectId: linkedProject || null,
          progress: status === "implemented" ? 100 : status === "in_progress" ? Math.max(editing.progress, 40) : editing.progress,
        },
        "updated"
      );
      const fresh = formFiles.filter((file) => file.dataUrl?.startsWith("data:"));
      if (fresh.length) await uploadIdeaAttachments(editing.id, currentUserId, fresh);
    } else {
      const idea = await createIdea({
        userId: currentUserId,
        title,
        description,
        icon,
        color,
        category,
        tags: parsedTags,
        status,
        priority,
        projectId: linkedProject || null,
        attachments: formFiles,
      });
      if (idea) selectIdea(idea.id);
    }
    setShowForm(false);
    await refresh();
  }

  async function convert(idea: Idea) {
    if (idea.convertedProjectId) {
      onOpenProject(idea.convertedProjectId);
      return;
    }
    setConverting(true);
    const { data: project, error } = await supabase.from("projects").insert({ name: idea.title }).select().single();
    if (error || !project) {
      setConverting(false);
      return;
    }
    writeProjectMeta(project.id, {
      description: idea.description,
      icon: idea.icon === "sparkles" ? "folder" : idea.icon,
      color: idea.color,
      key: defaultProjectKey(idea.title),
      tags: idea.tags,
      category: idea.category,
      sourceIdeaId: idea.id,
    });
    const { data: cols } = await supabase
      .from("board_columns")
      .insert(DEFAULT_COLUMNS.map((col) => ({ ...col, project_id: project.id })))
      .select();
    const columns = (cols || []) as { id: string; name: string; is_done_column: boolean }[];
    const startCol = columns.find((col) => col.name === "To Do") || columns.find((col) => !col.is_done_column) || columns[0];
    const { data: task } = await supabase
      .from("tasks")
      .insert({
        title: idea.title,
        project_id: project.id,
        column_id: startCol?.id ?? null,
        position: 1000,
        is_done: false,
        user_id: currentUserId,
      })
      .select()
      .single();
    if (task) {
      const copiedFiles = await ideaFilesToTaskAttachments(idea.attachments);
      patchTaskExtras(task.id, {
        description: idea.description,
        tags: idea.tags.join(", "),
        category: idea.category,
        attachments: copiedFiles,
        subtasks: idea.notes.map((note) => ({ text: note.message, done: false })),
      });
      for (const note of idea.notes) {
        await supabase.from("task_comments").insert({
          task_id: task.id,
          project_id: project.id,
          user_id: currentUserId,
          message:
            note.userId && note.userId !== currentUserId
              ? `${note.authorName}: ${note.message}`
              : note.message,
        });
      }
    }
    await updateIdea(
      idea.id,
      {
        convertedProjectId: project.id,
        projectId: project.id,
        status: "implemented",
        progress: 100,
      },
      "converted"
    );
    setConverting(false);
    await refresh();
    onOpenProject(project.id);
  }

  function formatDate(iso: string, withTime = false) {
    const date = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    if (withTime) {
      opts.hour = "numeric";
      opts.minute = "2-digit";
    }
    return date.toLocaleString(lang === "ar" ? "ar" : "en-US", opts);
  }

  const hasFilters = categoryFilter !== "all" || projectFilter !== "all" || statusFilter !== "all" || tagFilter.trim();

  const scopes: { id: Scope; label: string; count: number }[] = [
    { id: "all", label: t("ideas.tab.all"), count: stats.all },
    { id: "mine", label: t("ideas.tab.mine"), count: ideas.filter((i) => i.userId === currentUserId && i.status !== "archived").length },
    { id: "favorites", label: t("ideas.tab.favorites"), count: ideas.filter((i) => i.favorite && i.status !== "archived").length },
    { id: "archived", label: t("ideas.tab.archived"), count: stats.archived },
  ];

  const statCards = [
    { key: "all", label: t("ideas.stat.all"), value: stats.all, hint: t("ideas.stat.totalHint"), color: "#6C5CE7", Icon: Lightbulb, pct: 100 },
    { key: "in_progress", label: t("ideas.status.in_progress"), value: stats.in_progress, hint: t("ideas.stat.pct").replace("{n}", String(Math.round((stats.in_progress / liveTotal) * 100))), color: "#3B82F6", Icon: Sparkles, pct: Math.round((stats.in_progress / liveTotal) * 100) },
    { key: "planned", label: t("ideas.status.planned"), value: stats.planned, hint: t("ideas.stat.pct").replace("{n}", String(Math.round((stats.planned / liveTotal) * 100))), color: "#F59E0B", Icon: FolderKanban, pct: Math.round((stats.planned / liveTotal) * 100) },
    { key: "implemented", label: t("ideas.status.implemented"), value: stats.implemented, hint: t("ideas.stat.pct").replace("{n}", String(Math.round((stats.implemented / liveTotal) * 100))), color: "#22C55E", Icon: Check, pct: Math.round((stats.implemented / liveTotal) * 100) },
    { key: "archived", label: t("ideas.status.archived"), value: stats.archived, hint: t("ideas.stat.pct").replace("{n}", String(Math.round((stats.archived / Math.max(ideas.length, 1)) * 100))), color: "#6B7280", Icon: Archive, pct: Math.round((stats.archived / Math.max(ideas.length, 1)) * 100) },
  ];

  return (
    <div className="fade-in">
      {loading && (
        <div className="space-y-4 mb-6">
          <div className="h-10 w-48 rounded-lg skeleton" />
          <div className="h-24 rounded-xl border border-line skeleton" />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#6C5CE7]/15 text-[#6C5CE7] flex items-center justify-center">
            <Lightbulb size={20} />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("ideas.title")}</h1>
            <p className="mt-1 text-sm text-inkSoft">{t("ideas.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-inkFaint" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t("ideas.search")}
              className="w-56 bg-surfaceSunken border-0 rounded-[1.75rem] ps-9 pe-3 py-2 text-sm text-ink placeholder:text-inkFaint outline-none"
            />
          </div>
          <button className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line text-inkFaint hover:text-ink">
            <Filter size={15} />
          </button>
          <div className="flex rounded-lg border border-line p-0.5">
            <button
              onClick={() => setView("list")}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md ${view === "list" ? "bg-[#6C5CE7] text-white" : "text-inkFaint"}`}
              aria-label={t("ideas.listView")}
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md ${view === "grid" ? "bg-[#6C5CE7] text-white" : "text-inkFaint"}`}
              aria-label={t("ideas.gridView")}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} />
            {t("ideas.new")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-line mb-5">
        {scopes.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setScope(item.id);
              setPage(1);
            }}
            className={`relative shrink-0 px-3 py-2.5 text-sm font-medium ${scope === item.id ? "text-ink" : "text-inkFaint hover:text-inkSoft"}`}
          >
            {item.label} ({item.count})
            {scope === item.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#6C5CE7]" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        {statCards.map((card) => (
          <div key={card.key} className="rounded-xl border border-line bg-surface p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-inkFaint">{card.label}</span>
              <span className="h-8 w-8 rounded-lg inline-flex items-center justify-center" style={{ backgroundColor: `${card.color}22`, color: card.color }}>
                <card.Icon size={15} />
              </span>
            </div>
            <p className="text-2xl font-semibold text-ink">{card.value}</p>
            <p className="text-[11px] text-inkFaint mt-1">{card.hint}</p>
            {card.key !== "all" && (
              <div className="mt-2 h-1 rounded-full bg-paperDark overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${card.pct}%`, backgroundColor: card.color }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="!rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">
          <option value="all">{t("ideas.filter.categories")}</option>
          {IDEA_CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }} className="!rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">
          <option value="all">{t("ideas.filter.projects")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="!rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">
          <option value="all">{t("ideas.filter.status")}</option>
          {(["planned", "in_progress", "implemented", "archived"] as IdeaStatus[]).map((item) => (
            <option key={item} value={item}>{t(`ideas.status.${item}`)}</option>
          ))}
        </select>
        <div className="relative">
          <Tag size={12} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-inkFaint" />
          <input
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
            placeholder={t("ideas.filter.tags")}
            className="w-32 !rounded-lg border border-line bg-surface ps-7 pe-2 py-2 text-xs text-ink placeholder:text-inkFaint outline-none"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setCategoryFilter("all");
              setProjectFilter("all");
              setStatusFilter("all");
              setTagFilter("");
            }}
            className="text-xs text-inkFaint hover:text-ink"
          >
            {t("ideas.clear")}
          </button>
        )}
        <div className="ms-auto">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="!rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">
            <option value="latest">{t("ideas.sort.latest")}</option>
            <option value="oldest">{t("ideas.sort.oldest")}</option>
            <option value="priority">{t("ideas.sort.priority")}</option>
          </select>
        </div>
      </div>

      <div className={`grid gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="min-w-0">
          {pageItems.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface">
              <EmptyState
                icon={Lightbulb}
                title={t("ideas.empty")}
                hint={t("ideas.emptyHint")}
                action={
                  <Button variant="primary" onClick={openCreate}>
                    <Plus size={15} />
                    {t("ideas.new")}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className={view === "grid" ? "grid sm:grid-cols-2 gap-3" : "space-y-3"}>
              {pageItems.map((idea) => {
                const active = selectedId === idea.id;
                return (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => {
                      selectIdea(idea.id);
                      setDetailTab("overview");
                    }}
                    className={`w-full text-start rounded-xl border bg-surface p-4 transition-colors ${
                      active ? "border-[#6C5CE7] ring-1 ring-[#6C5CE7]/40" : "border-line hover:border-lineStrong"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="h-10 w-10 rounded-lg shrink-0 inline-flex items-center justify-center" style={{ backgroundColor: `${idea.color}22`, color: idea.color }}>
                        <IdeaIcon id={idea.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-ink leading-snug">{idea.title}</h3>
                          <span
                            className="relative shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-inkFaint hover:text-ink"
                              onClick={() => setMenuId(menuId === idea.id ? null : idea.id)}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {menuId === idea.id && (
                              <div className="absolute top-full end-0 mt-1 z-20 w-44 rounded-xl border border-line bg-paper shadow-modal p-1">
                                <button className="w-full text-start rounded-lg px-3 py-2 text-sm hover:bg-paperDark" onClick={() => openEdit(idea)}>{t("ideas.edit")}</button>
                                <button className="w-full text-start rounded-lg px-3 py-2 text-sm hover:bg-paperDark" onClick={() => convert(idea)}>{t("ideas.convert")}</button>
                                <button
                                  className="w-full text-start rounded-lg px-3 py-2 text-sm hover:bg-paperDark"
                                  onClick={async () => {
                                    await updateIdea(idea.id, { status: idea.status === "archived" ? "planned" : "archived" });
                                    await refresh();
                                    setMenuId(null);
                                  }}
                                >
                                  {idea.status === "archived" ? t("ideas.unarchive") : t("ideas.archive")}
                                </button>
                                <button
                                  className="w-full text-start rounded-lg px-3 py-2 text-sm text-[#EF4444] hover:bg-paperDark"
                                  onClick={async () => {
                                    await deleteIdea(idea.id, idea.attachments);
                                    if (selectedId === idea.id) selectIdea(null);
                                    await refresh();
                                    setMenuId(null);
                                  }}
                                >
                                  {t("common.delete")}
                                </button>
                              </div>
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-inkSoft line-clamp-2">{idea.description || t("ideas.noDescription")}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                          {idea.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-md bg-paperDark px-1.5 py-0.5 text-inkSoft">#{tag}</span>
                          ))}
                          {projectName(idea.projectId) && (
                            <span className="inline-flex items-center gap-1 text-inkFaint">
                              <FolderKanban size={11} />
                              {projectName(idea.projectId)}
                            </span>
                          )}
                          <span className={`rounded-md px-1.5 py-0.5 ${statusTone(idea.status)}`}>{t(`ideas.status.${idea.status}`)}</span>
                          <span className="ms-auto text-inkFaint">{formatDate(idea.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-inkFaint">
              <p>
                {t("ideas.pagination")
                  .replace("{from}", String((safePage - 1) * PAGE_SIZE + 1))
                  .replace("{to}", String(Math.min(safePage * PAGE_SIZE, filtered.length)))
                  .replace("{total}", String(filtered.length))}
              </p>
              <div className="flex items-center gap-1">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`h-8 min-w-8 rounded-lg px-2 ${n === safePage ? "bg-[#6C5CE7] text-white" : "hover:bg-paperDark text-inkSoft"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selected && (
          <aside className="rounded-xl border border-line bg-surface p-5 xl:sticky xl:top-20 self-start">
            <div className="flex items-start gap-3 mb-4">
              <span className="h-11 w-11 rounded-xl shrink-0 inline-flex items-center justify-center" style={{ backgroundColor: `${selected.color}22`, color: selected.color }}>
                <IdeaIcon id={selected.icon} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h2 className="font-semibold text-ink leading-snug flex-1">{selected.title}</h2>
                  <button
                    onClick={async () => {
                      await updateIdea(selected.id, { favorite: !selected.favorite });
                      await refresh();
                    }}
                    className={selected.favorite ? "text-amber" : "text-inkFaint hover:text-amber"}
                  >
                    <Star size={16} fill={selected.favorite ? "currentColor" : "none"} />
                  </button>
                </div>
                <div className="mt-2">
                  <select
                    value={selected.status}
                    onChange={async (e) => {
                      const next = e.target.value as IdeaStatus;
                      await updateIdea(selected.id, {
                        status: next,
                        progress: next === "implemented" ? 100 : selected.progress,
                      });
                      await refresh();
                    }}
                    className={`!rounded-lg border-0 px-2 py-1 text-xs ${statusTone(selected.status)}`}
                  >
                    {(["planned", "in_progress", "implemented", "archived"] as IdeaStatus[]).map((item) => (
                      <option key={item} value={item}>{t(`ideas.status.${item}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={() => selectIdea(null)} className="text-inkFaint hover:text-ink">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto border-b border-line mb-4">
              {(
                [
                  ["overview", t("ideas.detail.overview")],
                  ["notes", `${t("ideas.detail.notes")} (${selected.notes.length})`],
                  ["activity", t("ideas.detail.activity")],
                  ["files", `${t("ideas.detail.files")} (${selected.attachments.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setDetailTab(id)}
                  className={`relative shrink-0 px-2.5 py-2 text-xs font-medium ${detailTab === id ? "text-ink" : "text-inkFaint"}`}
                >
                  {label}
                  {detailTab === id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[#6C5CE7]" />}
                </button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-inkFaint uppercase mb-1.5">{t("ideas.detail.description")}</h4>
                  <p className="text-sm text-inkSoft leading-relaxed">{selected.description || t("ideas.noDescription")}</p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-inkFaint uppercase mb-2">{t("ideas.detail.details")}</h4>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-[11px] text-inkFaint mb-1">{t("ideas.category")}</dt>
                      <dd className={`inline-flex rounded-md px-1.5 py-0.5 text-xs ${categoryTone(selected.category)}`}>{selected.category}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-inkFaint mb-1">{t("ideas.createdBy")}</dt>
                      <dd className="flex items-center gap-1.5">
                        <ClickableAvatar userId={selected.userId} name={selected.userId === currentUserId ? currentUserName : t("common.user")} src={selected.userId === currentUserId ? currentUserAvatar : null} size="xs" />
                        <span className="truncate text-ink">{selected.userId === currentUserId ? currentUserName || t("common.you") : t("common.user")}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-inkFaint mb-1">{t("ideas.project")}</dt>
                      <dd className="text-ink inline-flex items-center gap-1">
                        <FolderKanban size={12} className="text-inkFaint" />
                        {projectName(selected.projectId) || t("ideas.noProject")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-inkFaint mb-1">{t("ideas.createdOn")}</dt>
                      <dd className="text-ink text-xs">{formatDate(selected.createdAt, true)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-inkFaint mb-1">{t("ideas.priority")}</dt>
                      <dd className={`inline-flex rounded-md px-1.5 py-0.5 text-xs ${priorityTone(selected.priority)}`}>{t(`list.priority.${selected.priority}`)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-inkFaint mb-1">{t("ideas.tags")}</dt>
                      <dd className="flex flex-wrap gap-1">
                        {selected.tags.length === 0 && <span className="text-inkFaint text-xs">{t("ideas.noTags")}</span>}
                        {selected.tags.map((tag) => (
                          <span key={tag} className="rounded-md bg-paperDark px-1.5 py-0.5 text-[11px] text-inkSoft">#{tag}</span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-inkFaint uppercase">{t("ideas.progress")}</span>
                    <span className="text-inkSoft tabular-nums">{selected.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-paperDark overflow-hidden">
                    <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${selected.progress}%` }} />
                  </div>
                </div>
                {selected.attachments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-inkFaint uppercase mb-2">{t("ideas.detail.attachments")}</h4>
                    <ul className="space-y-2">
                      {selected.attachments.slice(0, 3).map((file) => (
                        <li key={file.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                          <FileText size={14} className="text-inkFaint" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-ink truncate">{file.name}</p>
                            <p className="text-[10px] text-inkFaint">{formatBytes(file.size)}</p>
                          </div>
                          {file.dataUrl && (
                            <a href={file.dataUrl} download={file.name} className="text-inkFaint hover:text-ink">
                              <Download size={14} />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selected.notes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-inkFaint uppercase">{t("ideas.detail.notes")}</h4>
                      <button className="text-[11px] text-[#A78BFA]" onClick={() => setDetailTab("notes")}>{t("ideas.viewAll")}</button>
                    </div>
                    <div className="flex items-start gap-2">
                      <ClickableAvatar userId={selected.notes[selected.notes.length - 1].userId} name={selected.notes[selected.notes.length - 1].authorName} size="xs" />
                      <div>
                        <p className="text-xs text-ink">{selected.notes[selected.notes.length - 1].authorName} <span className="text-inkFaint">{timeAgo(selected.notes[selected.notes.length - 1].createdAt, t)}</span></p>
                        <p className="text-xs text-inkSoft mt-0.5">{selected.notes[selected.notes.length - 1].message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {detailTab === "notes" && (
              <div>
                <ul className="space-y-3 mb-3 max-h-64 overflow-y-auto thin-scroll">
                  {selected.notes.length === 0 && <p className="text-sm text-inkFaint">{t("ideas.noNotes")}</p>}
                  {selected.notes.map((note) => (
                    <li key={note.id} className="flex items-start gap-2">
                      <ClickableAvatar userId={note.userId} name={note.authorName || currentUserName} src={note.avatarUrl} size="xs" />
                      <div>
                        <p className="text-xs text-ink">{note.authorName || currentUserName} <span className="text-inkFaint">{timeAgo(note.createdAt, t)}</span></p>
                        <p className="text-sm text-inkSoft mt-0.5">{note.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={t("ideas.notePlaceholder")} />
                <Button
                  className="mt-2"
                  disabled={!noteDraft.trim()}
                  onClick={async () => {
                    await addIdeaNote(selected.id, currentUserId, noteDraft);
                    setNoteDraft("");
                    await refresh();
                  }}
                >
                  {t("ideas.addNote")}
                </Button>
              </div>
            )}

            {detailTab === "activity" && (
              <ul className="space-y-2.5">
                {selected.activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-inkSoft">{t(`ideas.activity.${item.message}`)}</span>
                    <span className="text-[11px] text-inkFaint whitespace-nowrap">{timeAgo(item.createdAt, t)}</span>
                  </li>
                ))}
              </ul>
            )}

            {detailTab === "files" && (
              <div>
                <ul className="space-y-2 mb-3">
                  {selected.attachments.length === 0 && <p className="text-sm text-inkFaint">{t("ideas.noFiles")}</p>}
                  {selected.attachments.map((file) => (
                    <li key={file.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                      <FileText size={14} className="text-inkFaint" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink truncate">{file.name}</p>
                        <p className="text-[10px] text-inkFaint">{formatBytes(file.size)}</p>
                      </div>
                      {file.dataUrl && (
                        <a href={file.dataUrl} download={file.name} className="text-inkFaint hover:text-ink">
                          <Download size={14} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <input
                  ref={detailFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const { files } = await filesFromList(e.target.files);
                    if (files.length) {
                      await uploadIdeaAttachments(selected.id, currentUserId, files);
                      await refresh();
                    }
                    e.target.value = "";
                  }}
                />
                <Button onClick={() => detailFileRef.current?.click()}>
                  <Paperclip size={14} />
                  {t("ideas.addFiles")}
                </Button>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  await updateIdea(selected.id, { status: selected.status === "archived" ? "planned" : "archived" });
                  await refresh();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-inkSoft hover:text-ink"
              >
                <Archive size={14} />
                {selected.status === "archived" ? t("ideas.unarchive") : t("ideas.archive")}
              </button>
              <Button onClick={() => openEdit(selected)}>
                <Pencil size={14} />
                {t("ideas.edit")}
              </Button>
              <Button variant="primary" loading={converting} onClick={() => convert(selected)}>
                <FolderPlus size={14} />
                {selected.convertedProjectId ? t("ideas.openProject") : t("ideas.convert")}
              </Button>
            </div>
          </aside>
        )}
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editing ? t("ideas.editTitle") : t("ideas.newTitle")} maxWidth="max-w-lg">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.form.title")}</label>
              <Input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("ideas.form.titlePlaceholder")} />
            </div>
            <div>
              <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.form.description")}</label>
              <Textarea className={fieldClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("ideas.form.descriptionPlaceholder")} rows={4} />
            </div>
            <div>
              <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.form.icon")}</label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map(({ id, icon: Item }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIcon(id)}
                    className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${icon === id ? "ring-2 ring-[#6C5CE7]" : "bg-paperDark text-inkSoft"}`}
                    style={icon === id ? { backgroundColor: `${color}22`, color } : undefined}
                  >
                    <Item size={16} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.form.color")}</label>
              <div className="flex flex-wrap gap-2">
                {IDEA_COLORS.map((item) => (
                  <button key={item} type="button" onClick={() => setColor(item)} className="h-6 w-6 rounded-full" style={{ backgroundColor: item }}>
                    {color === item && <Check size={12} className="text-white mx-auto" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.category")}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
                  {IDEA_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.priority")}</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as IdeaPriority)} className={fieldClass}>
                  <option value="high">{t("list.priority.high")}</option>
                  <option value="medium">{t("list.priority.medium")}</option>
                  <option value="low">{t("list.priority.low")}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.statusLabel")}</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as IdeaStatus)} className={fieldClass}>
                  {(["planned", "in_progress", "implemented"] as IdeaStatus[]).map((item) => (
                    <option key={item} value={item}>{t(`ideas.status.${item}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.project")}</label>
                <select value={linkedProject} onChange={(e) => setLinkedProject(e.target.value)} className={fieldClass}>
                  <option value="">{t("ideas.noProject")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.tags")}</label>
              <Input className={fieldClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("ideas.tagsPlaceholder")} />
            </div>
            <div>
              <label className="block text-xs text-inkSoft mb-1.5">{t("ideas.detail.files")}</label>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const { files } = await filesFromList(e.target.files);
                  setFormFiles((prev) => [...prev, ...files]);
                  e.target.value = "";
                }}
              />
              <Button type="button" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} />
                {t("ideas.addFiles")}
              </Button>
              <ul className="mt-2 space-y-1">
                {formFiles.map((file) => (
                  <li key={file.id} className="text-xs text-inkSoft">{file.name}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
              <Button variant="primary" onClick={saveForm}>{t("common.save")}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
