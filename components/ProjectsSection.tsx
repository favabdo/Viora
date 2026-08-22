"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Users,
  Clock,
  Filter,
  LayoutGrid,
  List,
  Search,
  FolderKanban,
  Plus,
} from "lucide-react";
import { supabase, Project } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";
import { Input } from "./ui/Input";

type ProjectStatus = "active" | "completed" | "archived" | "on_hold";
type StatusFilter = "all" | "active" | "completed" | "archived";
type ViewMode = "grid" | "list";

type ProjectCard = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  taskCount: number;
  memberCount: number;
  dueLabel: string | null;
  accent: Accent;
};

type Accent = {
  bar: string;
  iconBg: string;
  iconText: string;
};

const ACCENTS: Accent[] = [
  { bar: "bg-[#6C5CE7]", iconBg: "bg-[#6C5CE7]/18", iconText: "text-[#6C5CE7]" },
  { bar: "bg-[#22C55E]", iconBg: "bg-[#22C55E]/18", iconText: "text-[#22C55E]" },
  { bar: "bg-[#3B82F6]", iconBg: "bg-[#3B82F6]/18", iconText: "text-[#3B82F6]" },
  { bar: "bg-[#F59E0B]", iconBg: "bg-[#F59E0B]/18", iconText: "text-[#F59E0B]" },
  { bar: "bg-[#EF4444]", iconBg: "bg-[#EF4444]/18", iconText: "text-[#EF4444]" },
  { bar: "bg-[#EC4899]", iconBg: "bg-[#EC4899]/18", iconText: "text-[#EC4899]" },
  { bar: "bg-[#14B8A6]", iconBg: "bg-[#14B8A6]/18", iconText: "text-[#14B8A6]" },
  { bar: "bg-[#EAB308]", iconBg: "bg-[#EAB308]/18", iconText: "text-[#EAB308]" },
];

function accentFor(id: string): Accent {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

function daysFromNow(iso: string): number {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function ProjectsSection({
  currentUserId,
  openCreateSignal,
  onOpenProject,
}: {
  currentUserId: string;
  openCreateSignal?: number;
  onOpenProject?: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cards, setCards] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (openCreateSignal && openCreateSignal > 0) setShowCreate(true);
  }, [openCreateSignal]);

  useEffect(() => {
    load();
  }, [currentUserId]);

  async function load() {
    setLoading(true);
    const { data: projectRows, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !projectRows) {
      setProjects([]);
      setCards([]);
      setLoading(false);
      return;
    }

    const list = projectRows as Project[];
    setProjects(list);
    const ids = list.map((p) => p.id);

    if (ids.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const [tasksRes, membersRes] = await Promise.all([
      supabase.from("tasks").select("id, project_id, is_done, due_date").in("project_id", ids),
      supabase.from("project_members").select("project_id, status").in("project_id", ids),
    ]);

    const tasks = (tasksRes.data || []) as {
      id: string;
      project_id: string;
      is_done: boolean;
      due_date?: string | null;
    }[];
    const members = (membersRes.data || []) as { project_id: string; status: string }[];

    const next: ProjectCard[] = list.map((project) => {
      const projectTasks = tasks.filter((task) => task.project_id === project.id);
      const done = projectTasks.filter((task) => task.is_done).length;
      const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;
      const memberCount = Math.max(
        1,
        members.filter((m) => m.project_id === project.id && m.status === "accepted").length
      );
      const upcoming = projectTasks
        .filter((task) => !task.is_done && task.due_date)
        .map((task) => task.due_date as string)
        .sort()[0];

      let status: ProjectStatus = "active";
      if (projectTasks.length > 0 && done === projectTasks.length) status = "completed";

      let dueLabel: string | null = null;
      if (status === "completed") {
        dueLabel = t("projects.completed");
      } else if (upcoming) {
        const days = daysFromNow(upcoming);
        if (days === 0) dueLabel = t("projects.dueToday");
        else if (days === 1) dueLabel = t("projects.dueIn1");
        else if (days > 1) dueLabel = t("projects.dueInN").replace("{n}", String(days));
        else if (days === -1) dueLabel = t("projects.overdue1");
        else dueLabel = t("projects.overdueN").replace("{n}", String(Math.abs(days)));
      }

      return {
        id: project.id,
        name: project.name,
        description: t("projects.defaultDescription"),
        status,
        progress,
        taskCount: projectTasks.length,
        memberCount,
        dueLabel,
        accent: accentFor(project.id),
      };
    });

    setCards(next);
    setLoading(false);
  }

  async function createProject() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const { data, error } = await supabase.from("projects").insert({ name }).select().single();
    setCreating(false);
    if (!error && data) {
      setNewName("");
      setShowCreate(false);
      await load();
      onOpenProject?.(data.id);
    }
  }

  const counts = useMemo(() => {
    return {
      all: cards.length,
      active: cards.filter((c) => c.status === "active").length,
      completed: cards.filter((c) => c.status === "completed").length,
      archived: cards.filter((c) => c.status === "archived").length,
    };
  }, [cards]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (filter !== "all" && card.status !== filter) return false;
      if (q && !card.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, filter, query]);

  const filters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: t("projects.filter.all"), count: counts.all },
    { id: "active", label: t("projects.filter.active"), count: counts.active },
    { id: "completed", label: t("projects.filter.completed"), count: counts.completed },
    { id: "archived", label: t("projects.filter.archived"), count: counts.archived },
  ];

  return (
    <div className="fade-in">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("projects.title")}</h1>
          <p className="mt-1 text-sm text-inkSoft">{t("projects.subtitle")}</p>
        </div>
        <Button variant="primary" className="sm:hidden" onClick={() => setShowCreate(true)}>
          <Plus size={15} strokeWidth={2} />
          {t("projects.new")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#6C5CE7] text-white"
                    : "bg-surface text-inkSoft hover:text-ink border border-line"
                }`}
              >
                {item.label} ({item.count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 xl:w-56">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-inkFaint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("projects.search")}
              className="w-full rounded-lg border border-line bg-surface ps-9 pe-3 py-2 text-sm text-ink placeholder:text-inkFaint focus:outline-none focus:ring-1 focus:ring-[#6C5CE7]"
            />
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-inkSoft hover:text-ink">
            <Filter size={14} strokeWidth={1.75} />
            {t("projects.filterBtn")}
          </button>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            <button
              onClick={() => setView("grid")}
              aria-label={t("projects.gridView")}
              className={`rounded-md p-1.5 ${view === "grid" ? "bg-[#6C5CE7] text-white" : "text-inkFaint hover:text-ink"}`}
            >
              <LayoutGrid size={15} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setView("list")}
              aria-label={t("projects.listView")}
              className={`rounded-md p-1.5 ${view === "list" ? "bg-[#6C5CE7] text-white" : "text-inkFaint hover:text-ink"}`}
            >
              <List size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[188px] rounded-xl border border-line bg-surface skeleton" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={FolderKanban}
            title={projects.length === 0 ? t("projects.empty") : t("projects.emptyFilter")}
            hint={projects.length === 0 ? t("projects.emptyHint") : undefined}
            action={
              projects.length === 0 ? (
                <Button variant="primary" onClick={() => setShowCreate(true)}>
                  <Plus size={15} />
                  {t("projects.new")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {visible.map((card) => (
            <ProjectCardView key={card.id} card={card} t={t} onClick={() => onOpenProject?.(card.id)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
          {visible.map((card) => (
            <button
              key={card.id}
              onClick={() => onOpenProject?.(card.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 text-start hover:bg-paperDark/60 transition-colors"
            >
              <div className={`h-10 w-10 rounded-lg ${card.accent.iconBg} ${card.accent.iconText} flex items-center justify-center font-semibold shrink-0`}>
                {card.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink truncate">{card.name}</p>
                  <StatusBadge status={card.status} t={t} />
                </div>
                <p className="text-xs text-inkFaint mt-0.5 truncate">{card.description}</p>
              </div>
              <div className="hidden sm:flex items-center gap-3 w-36 shrink-0">
                <div className="h-1.5 flex-1 rounded-full bg-paperDark overflow-hidden">
                  <div className={`h-full rounded-full ${card.accent.bar}`} style={{ width: `${card.progress}%` }} />
                </div>
                <span className="text-xs text-inkSoft tabular-nums w-8">{card.progress}%</span>
              </div>
              <span className="hidden md:block text-xs text-inkFaint w-20 shrink-0">
                {card.taskCount} {t("projects.tasks")}
              </span>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title={t("projects.newTitle")}>
          <p className="text-sm text-inkSoft mb-4">{t("projects.newHint")}</p>
          <label className="block text-xs font-medium text-inkFaint mb-1.5">{t("projects.namePlaceholder")}</label>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("projects.namePlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") createProject();
            }}
          />
          <div className="flex justify-end gap-2 mt-5">
            <Button onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" loading={creating} onClick={createProject}>
              {t("projects.create")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: ProjectStatus; t: (key: string) => string }) {
  const styles: Record<ProjectStatus, string> = {
    active: "bg-[#3B82F6]/15 text-[#60A5FA]",
    on_hold: "bg-[#F59E0B]/15 text-[#FBBF24]",
    completed: "bg-[#22C55E]/15 text-[#4ADE80]",
    archived: "bg-white/8 text-inkSoft",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}>
      {t(`projects.status.${status}`)}
    </span>
  );
}

function ProjectCardView({
  card,
  t,
  onClick,
}: {
  card: ProjectCard;
  t: (key: string) => string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-start rounded-xl border border-line bg-surface p-4 hover:border-lineStrong hover:bg-surface/80 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className={`h-10 w-10 rounded-lg ${card.accent.iconBg} ${card.accent.iconText} flex items-center justify-center font-semibold`}
        >
          {card.name.charAt(0).toUpperCase()}
        </div>
        <StatusBadge status={card.status} t={t} />
      </div>
      <h3 className="font-semibold text-ink leading-snug">{card.name}</h3>
      <p className="mt-1 text-xs text-inkSoft line-clamp-2 min-h-[32px]">{card.description}</p>
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-inkFaint">{t("projects.progress")}</span>
          <span className="text-xs font-medium text-inkSoft tabular-nums">{card.progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-paperDark overflow-hidden">
          <div className={`h-full rounded-full ${card.accent.bar}`} style={{ width: `${card.progress}%` }} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-inkFaint">
        <span className="inline-flex items-center gap-1">
          <CheckSquare size={12} strokeWidth={1.75} />
          {card.taskCount} {t("projects.tasks")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={12} strokeWidth={1.75} />
          {card.memberCount} {t("projects.members")}
        </span>
        <span className="inline-flex items-center gap-1 min-w-0 truncate">
          <Clock size={12} strokeWidth={1.75} />
          <span className="truncate">{card.dueLabel || t("projects.noDue")}</span>
        </span>
      </div>
    </button>
  );
}
