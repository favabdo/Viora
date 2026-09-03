"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Info,
  ListChecks,
  ListTodo,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";
import { supabase, type BoardColumn, type Project, type ProjectMember } from "@/lib/supabase";
import {
  addBacklogItem,
  deleteBacklogItem,
  loadBacklog,
  updateBacklogItem,
  BACKLOG_STAGES,
  BACKLOG_TYPES,
  type BacklogItem,
  type BacklogPriority,
  type BacklogStage,
  type BacklogType,
} from "@/lib/backlog";
import { ensureTodoColumn } from "@/lib/boardColumns";
import { writeTaskMeta } from "@/lib/taskExtras";
import { copyRemoteFilesToTask } from "@/lib/taskAttachments";
import { normalizeProjectMember } from "@/lib/taskShape";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { getProjectMeta, hydrateProjectMetas, useProjectMetaTick } from "@/lib/projectMeta";
import { colorForProject } from "@/lib/projectColor";
import { timeAgo } from "@/lib/timeAgo";
import AddTaskModal, { type NewTaskDraft } from "./AddTaskModal";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import DonutChart from "./ui/DonutChart";
import EmptyState from "./ui/EmptyState";
import IconButton from "./ui/IconButton";
import { fieldClass } from "./ui/Input";
import ProjectMark from "./ProjectMark";

type HealthFocus = "aging" | "ready" | "needs" | "duplicates";

type ProjectLook = {
  color: string;
  icon: string;
  imageUrl: string | null;
  imageScale: number;
  imageScaleX: number;
  imageScaleY: number;
  imagePosX: number;
  imagePosY: number;
};

const STAGE_ORDER: BacklogStage[] = [...BACKLOG_STAGES];

const stageDot: Record<BacklogStage, string> = {
  ideas: "rgb(var(--color-teal))",
  refinement: "rgb(var(--color-amber))",
  ready: "rgb(var(--color-sage))",
  archived: "rgb(var(--color-inkFaint))",
};

const TYPE_ORDER: BacklogType[] = [...BACKLOG_TYPES];

const typeTone: Record<BacklogType, "teal" | "sage" | "amber" | "neutral" | "clay"> = {
  feature: "teal",
  enhancement: "sage",
  integration: "amber",
  development: "neutral",
  bug: "clay",
};

const typeBarColor: Record<BacklogType, string> = {
  feature: "rgb(var(--color-teal))",
  enhancement: "rgb(var(--color-sage))",
  integration: "rgb(var(--color-amber))",
  development: "rgb(var(--color-inkSoft))",
  bug: "rgb(var(--color-clay))",
};

const PRIORITY_ORDER: BacklogPriority[] = ["high", "medium", "low"];

const priorityDot: Record<BacklogPriority, string> = {
  high: "rgb(var(--color-clay))",
  medium: "rgb(var(--color-amber))",
  low: "rgb(var(--color-sage))",
};

const priorityText: Record<BacklogPriority, string> = {
  high: "text-clay",
  medium: "text-amber",
  low: "text-inkFaint",
};

const NEXT_PRIORITY: Record<BacklogPriority, BacklogPriority> = {
  low: "medium",
  medium: "high",
  high: "low",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pctOf(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function lookOf(project: Project): ProjectLook {
  const meta = getProjectMeta(project.id);
  return {
    color: meta?.color || colorForProject(project.id),
    icon: meta?.icon || "folder",
    imageUrl: meta?.imageUrl || null,
    imageScale: meta?.imageScale ?? 100,
    imageScaleX: meta?.imageScaleX ?? meta?.imageScale ?? 100,
    imageScaleY: meta?.imageScaleY ?? meta?.imageScale ?? 100,
    imagePosX: meta?.imagePosX ?? 50,
    imagePosY: meta?.imagePosY ?? 50,
  };
}

function FilterSelect({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="appearance-none rounded-[1.75rem] border-0 bg-surfaceSunken py-2 pe-8 ps-4 text-sm text-ink outline-none"
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-inkFaint"
      />
    </div>
  );
}

function StatBar({ color, value, total }: { color: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paperDark">
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function TypeBadge({ item, onCycle }: { item: BacklogItem; onCycle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onCycle}
      title={t("backlog.typeHint")}
      className="cursor-pointer outline-none"
    >
      <Badge tone={typeTone[item.type]}>{t(`backlog.type.${item.type}`)}</Badge>
    </button>
  );
}

function PriorityChip({ item, onCycle }: { item: BacklogItem; onCycle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onCycle}
      title={t("backlog.priorityHint")}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-2xs outline-none ${priorityText[item.priority]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priorityDot[item.priority] }} />
      {t(`backlog.priority.${item.priority}`)}
    </button>
  );
}

function BacklogCard({
  item,
  look,
  projects,
  sending,
  onSend,
  onDelete,
  onRestore,
  onCyclePriority,
  onCycleType,
  onProjectChange,
}: {
  item: BacklogItem;
  look: ProjectLook | null;
  projects: Project[];
  sending: boolean;
  onSend: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onCyclePriority: () => void;
  onCycleType: () => void;
  onProjectChange: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const archived = item.stage === "archived";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`group relative cursor-grab touch-none select-none rounded-lg border border-line bg-surface p-3 hover:border-lineStrong active:cursor-grabbing ${
        isDragging ? "opacity-40 ring-2 ring-teal" : ""
      }`}
    >
      <div className="absolute end-2 top-2 z-10 flex gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100">
        {archived ? (
          <IconButton
            size="sm"
            aria-label={t("backlog.restore")}
            title={t("backlog.restore")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRestore}
          >
            <RotateCcw size={13} />
          </IconButton>
        ) : (
          item.projectId && (
            <IconButton
              size="sm"
              aria-label={t("backlog.sendTitle")}
              title={t("backlog.sendTitle")}
              disabled={sending}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onSend}
            >
              <ArrowUpRight size={13} />
            </IconButton>
          )
        )}
        <IconButton
          size="sm"
          tone="danger"
          aria-label={t("common.delete")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
        >
          <X size={13} />
        </IconButton>
      </div>

      <p className="break-words pe-14 text-sm font-medium leading-6 text-ink">{item.title}</p>
      {item.description && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-inkSoft">{item.description}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <TypeBadge item={item} onCycle={onCycleType} />
        {item.subtasks.length > 0 && (
          <span className="inline-flex items-center gap-1 text-2xs text-inkFaint">
            <ListChecks size={11} />
            {item.subtasks.length}
          </span>
        )}
        {item.attachments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-2xs text-inkFaint">
            <Paperclip size={11} />
            {item.attachments.length}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm"
            style={
              look
                ? { backgroundColor: `${look.color}22`, color: look.color }
                : { backgroundColor: "rgb(var(--color-paperDark))", color: "rgb(var(--color-inkFaint))" }
            }
          >
            {look ? (
              <ProjectMark icon={look.icon} imageUrl={look.imageUrl} color={look.color} size={14} />
            ) : (
              <ListTodo size={10} />
            )}
          </span>
          <select
            value={item.projectId || ""}
            onChange={(e) => onProjectChange(e.target.value)}
            aria-label={t("backlog.pickProject")}
            className="max-w-[110px] cursor-pointer appearance-none truncate border-0 bg-transparent p-0 text-2xs text-inkSoft outline-none"
          >
            <option value="">{t("backlog.unlinked")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </span>
        <span className="flex-1" />
        {archived ? (
          <Badge tone="sage">
            <Check size={10} className="me-1" />
            {t("backlog.stage.archived")}
          </Badge>
        ) : (
          <PriorityChip item={item} onCycle={onCyclePriority} />
        )}
      </div>
    </div>
  );
}

function BoardColumn({
  stage,
  items,
  projects,
  looks,
  sendingId,
  onAdd,
  onSend,
  onDelete,
  onRestore,
  onCyclePriority,
  onCycleType,
  onProjectChange,
}: {
  stage: BacklogStage;
  items: BacklogItem[];
  projects: Project[];
  looks: Map<string, ProjectLook>;
  sendingId: string | null;
  onAdd: () => void;
  onSend: (item: BacklogItem) => void;
  onDelete: (item: BacklogItem) => void;
  onRestore: (item: BacklogItem) => void;
  onCyclePriority: (item: BacklogItem) => void;
  onCycleType: (item: BacklogItem) => void;
  onProjectChange: (item: BacklogItem, projectId: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      className={`flex min-h-[180px] flex-col rounded-xl border bg-surfaceSunken ${
        isOver ? "border-teal" : "border-line"
      }`}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stageDot[stage] }} />
        <h3 className="text-sm font-medium text-ink">{t(`backlog.stage.${stage}`)}</h3>
        <span className="rounded-full bg-paperDark px-1.5 py-0.5 text-2xs font-mono tabular-nums text-inkSoft">
          {items.length}
        </span>
        <span className="flex-1" />
        <IconButton size="sm" aria-label={t("backlog.column.add")} onClick={onAdd}>
          <Plus size={14} />
        </IconButton>
      </header>

      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
        {items.map((item) => (
          <BacklogCard
            key={item.id}
            item={item}
            look={item.projectId ? looks.get(item.projectId) || null : null}
            projects={projects}
            sending={sendingId === item.id}
            onSend={() => onSend(item)}
            onDelete={() => onDelete(item)}
            onRestore={() => onRestore(item)}
            onCyclePriority={() => onCyclePriority(item)}
            onCycleType={() => onCycleType(item)}
            onProjectChange={(projectId) => onProjectChange(item, projectId)}
          />
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-2xs text-inkFaint">{t("backlog.column.empty")}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center justify-center gap-1 rounded-b-xl border-t border-line py-2 text-2xs text-inkFaint transition-colors hover:text-teal"
      >
        <Plus size={13} />
        {t("backlog.column.add")}
      </button>
    </section>
  );
}

function HealthCard({
  icon: Icon,
  tint,
  title,
  value,
  desc,
  action,
  onClick,
}: {
  icon: typeof Clock;
  tint: string;
  title: string;
  value: number;
  desc: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-teal/50">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${tint}`}>
          <Icon size={14} />
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-2xl font-semibold leading-none tabular-nums text-ink">{value}</span>
        <span className="text-2xs leading-tight text-inkSoft">{desc}</span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 inline-flex items-center gap-1 self-start text-2xs font-medium text-teal transition-colors hover:text-tealDark"
      >
        {action}
        <ArrowUpRight size={12} />
      </button>
    </div>
  );
}

export default function BacklogSection({
  currentUserId,
  onOpenProject,
}: {
  currentUserId: string;
  onOpenProject: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  const metaTick = useProjectMetaTick();
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [open, setOpen] = useState(false);
  const [openStage, setOpenStage] = useState<BacklogStage>("ideas");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [focus, setFocus] = useState<HealthFocus | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function refresh() {
    setItems(loadBacklog(currentUserId));
  }

  useEffect(() => {
    refresh();
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const list = (data as Project[]) || [];
        setProjects(list);
        if (list.length) await hydrateProjectMetas(list.map((p) => p.id));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const looks = useMemo(() => {
    void metaTick;
    return new Map(projects.map((p) => [p.id, lookOf(p)] as const));
  }, [projects, metaTick]);

  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const duplicateIds = useMemo(() => {
    const seen = new Map<string, number>();
    items.forEach((i) => {
      const key = i.title.trim().toLowerCase();
      seen.set(key, (seen.get(key) || 0) + 1);
    });
    return new Set(
      items.filter((i) => (seen.get(i.title.trim().toLowerCase()) || 0) > 1).map((i) => i.id)
    );
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (projectFilter && (item.projectId || "") !== projectFilter) return false;
      if (typeFilter && item.type !== typeFilter) return false;
      if (priorityFilter && item.priority !== priorityFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
      if (focus === "aging" && (item.stage === "archived" || Date.now() - new Date(item.createdAt).getTime() <= 30 * DAY_MS))
        return false;
      if (focus === "ready" && item.stage !== "ready") return false;
      if (focus === "needs" && item.description.trim()) return false;
      if (focus === "duplicates" && !duplicateIds.has(item.id)) return false;
      return true;
    });
  }, [items, search, projectFilter, typeFilter, priorityFilter, focus, duplicateIds]);

  const stats = useMemo(() => {
    const stage = { ideas: 0, refinement: 0, ready: 0, archived: 0 } as Record<BacklogStage, number>;
    const priority = { low: 0, medium: 0, high: 0 } as Record<BacklogPriority, number>;
    const type = { feature: 0, enhancement: 0, integration: 0, development: 0, bug: 0 } as Record<BacklogType, number>;
    const perProject = new Map<string, number>();
    let aging = 0;
    let needs = 0;
    items.forEach((item) => {
      stage[item.stage] += 1;
      priority[item.priority] += 1;
      type[item.type] += 1;
      if (item.projectId) perProject.set(item.projectId, (perProject.get(item.projectId) || 0) + 1);
      if (item.stage !== "archived" && Date.now() - new Date(item.createdAt).getTime() > 30 * DAY_MS) aging += 1;
      if (!item.description.trim()) needs += 1;
    });
    const topProjects = [...perProject.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count, name: names.get(id) || id }));
    return { stage, priority, type, aging, needs, topProjects };
  }, [items, names]);

  const total = items.length;
  const maxProjectCount = stats.topProjects[0]?.count || 0;

  async function loadResources(projectId: string) {
    if (!projectId) {
      setColumns([]);
      setMembers([]);
      return;
    }
    const [{ data: cols }, { data: mems }] = await Promise.all([
      supabase.from("board_columns").select("*").eq("project_id", projectId).order("position"),
      supabase
        .from("project_members")
        .select(
          "id, project_id, user_id, status, invited_by, created_at, profiles!project_members_user_id_fkey(username, full_name, avatar_url)"
        )
        .eq("project_id", projectId)
        .eq("status", "accepted"),
    ]);
    setColumns((cols as BoardColumn[]) || []);
    setMembers((mems || []).map(normalizeProjectMember));
  }

  async function saveDraft(draft: NewTaskDraft) {
    setCreating(true);
    addBacklogItem({
      userId: currentUserId,
      title: draft.title,
      description: draft.extras.description,
      projectId: draft.projectId || null,
      columnId: draft.columnId,
      color: draft.color,
      dueDate: draft.dueDate,
      assigneeId: draft.assigneeId,
      tags: draft.extras.tags,
      estimate: draft.extras.estimate,
      recurrence: draft.extras.recurrence,
      subtasks: draft.extras.subtasks,
      attachments: draft.attachments,
      stage: openStage,
      priority: "medium",
      type: "feature",
    });
    setCreating(false);
    setOpen(false);
    refresh();
  }

  async function sendToProject(item: BacklogItem) {
    const target = item.projectId;
    if (!target) return;
    setSending(item.id);
    const column = item.columnId
      ? (await supabase.from("board_columns").select("id").eq("id", item.columnId).maybeSingle()).data
      : await ensureTodoColumn(target);
    const fallback = column?.id ? column : await ensureTodoColumn(target);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: item.title,
        project_id: target,
        column_id: fallback?.id ?? null,
        position: 1000,
        is_done: false,
        color: item.color,
        due_date: item.dueDate,
        ...(item.assigneeId ? { user_id: item.assigneeId } : { user_id: currentUserId }),
      })
      .select("id")
      .single();
    if (error || !data) {
      setSending(null);
      return;
    }
    writeTaskMeta(data.id, {
      description: item.description,
      tags: item.tags,
      estimate: item.estimate,
      recurrence: item.recurrence,
      subtasks: item.subtasks,
    });
    if (item.attachments.length) {
      await copyRemoteFilesToTask(data.id, target, currentUserId, item.attachments);
    }
    deleteBacklogItem(item.id);
    setSending(null);
    refresh();
    onOpenProject(target);
  }

  function patchItem(item: BacklogItem, patch: Partial<BacklogItem>) {
    updateBacklogItem(item.id, patch);
    refresh();
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const overId = event.over?.id;
    if (!overId) return;
    const item = items.find((i) => i.id === event.active.id);
    const stage = overId as BacklogStage;
    if (!item || !STAGE_ORDER.includes(stage) || item.stage === stage) return;
    patchItem(item, { stage });
  }

  function openAdd(stage: BacklogStage) {
    setOpenStage(stage);
    setOpen(true);
  }

  const healthCards: {
    id: HealthFocus;
    icon: typeof Clock;
    tint: string;
    titleKey: string;
    descKey: string;
    actionKey: string;
    count: number;
  }[] = [
    {
      id: "aging",
      icon: Clock,
      tint: "bg-paperDark text-inkSoft",
      titleKey: "backlog.health.aging",
      descKey: "backlog.health.agingDesc",
      actionKey: "backlog.health.agingAction",
      count: stats.aging,
    },
    {
      id: "ready",
      icon: Star,
      tint: "bg-tealSoft text-teal",
      titleKey: "backlog.health.ready",
      descKey: "backlog.health.readyDesc",
      actionKey: "backlog.health.readyAction",
      count: stats.stage.ready,
    },
    {
      id: "needs",
      icon: Info,
      tint: "bg-amberSoft text-amber",
      titleKey: "backlog.health.needs",
      descKey: "backlog.health.needsDesc",
      actionKey: "backlog.health.needsAction",
      count: stats.needs,
    },
    {
      id: "duplicates",
      icon: Copy,
      tint: "bg-claySoft text-clay",
      titleKey: "backlog.health.dup",
      descKey: "backlog.health.dupDesc",
      actionKey: "backlog.health.dupAction",
      count: duplicateIds.size,
    },
  ];

  return (
    <div className="fade-in">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("backlog.title")}</h1>
          <p className="mt-1 text-sm text-inkSoft">{t("backlog.subtitle")}</p>
        </div>
        <Button variant="primary" onClick={() => openAdd("ideas")}>
          <Plus size={15} />
          {t("backlog.add")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={projectFilter} onChange={setProjectFilter} ariaLabel={t("backlog.filter.project")}>
          <option value="">{t("backlog.filter.project")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={typeFilter} onChange={setTypeFilter} ariaLabel={t("backlog.filter.type")}>
          <option value="">{t("backlog.filter.type")}</option>
          {TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {t(`backlog.type.${type}`)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={priorityFilter} onChange={setPriorityFilter} ariaLabel={t("backlog.filter.priority")}>
          <option value="">{t("backlog.filter.priority")}</option>
          {PRIORITY_ORDER.map((priority) => (
            <option key={priority} value={priority}>
              {t(`backlog.priority.${priority}`)}
            </option>
          ))}
        </FilterSelect>
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search size={14} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-inkFaint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("backlog.search")}
            aria-label={t("backlog.search")}
            className={`${fieldClass} ps-9`}
          />
        </div>
      </div>

      {focus && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-tealSoft px-3 py-1 text-xs text-tealDark">
            {t("backlog.focusPrefix")} {t(healthCards.find((c) => c.id === focus)?.titleKey || "")}
            <button
              type="button"
              onClick={() => setFocus(null)}
              aria-label={t("common.close")}
              className="outline-none transition-colors hover:text-clay"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {total === 0 ? (
        <div className="mt-5 rounded-xl border border-line bg-surface">
          <EmptyState icon={ListTodo} title={t("backlog.empty")} hint={t("backlog.emptyHint")} />
        </div>
      ) : (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
                {STAGE_ORDER.map((stage) => (
                  <BoardColumn
                    key={stage}
                    stage={stage}
                    items={filtered.filter((item) => item.stage === stage)}
                    projects={projects}
                    looks={looks}
                    sendingId={sending}
                    onAdd={() => openAdd(stage)}
                    onSend={(item) => void sendToProject(item)}
                    onDelete={(item) => {
                      deleteBacklogItem(item.id);
                      refresh();
                    }}
                    onRestore={(item) => patchItem(item, { stage: "ideas" })}
                    onCyclePriority={(item) => patchItem(item, { priority: NEXT_PRIORITY[item.priority] })}
                    onCycleType={(item) =>
                      patchItem(item, {
                        type: TYPE_ORDER[(TYPE_ORDER.indexOf(item.type) + 1) % TYPE_ORDER.length],
                      })
                    }
                    onProjectChange={(item, projectId) =>
                      patchItem(item, { projectId: projectId || null })
                    }
                  />
                ))}
              </div>
            </DndContext>

            <section className="mt-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">{t("backlog.health.title")}</h2>
              <p className="mt-0.5 text-xs text-inkSoft">{t("backlog.health.subtitle")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {healthCards.map((card) => (
                  <HealthCard
                    key={card.id}
                    icon={card.icon}
                    tint={card.tint}
                    title={t(card.titleKey)}
                    value={card.count}
                    desc={t(card.descKey)}
                    action={t(card.actionKey)}
                    onClick={() => setFocus((current) => (current === card.id ? null : card.id))}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <Panel title={t("backlog.overview")}>
              <div className="flex items-center gap-4">
                <DonutChart
                  segments={STAGE_ORDER.map((stage) => ({ value: stats.stage[stage], color: stageDot[stage] }))}
                  size={104}
                  strokeWidth={13}
                  centerLabel={String(total)}
                  centerSubLabel={t("backlog.overview.total")}
                />
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {STAGE_ORDER.map((stage) => (
                    <li key={stage} className="flex items-center gap-2 text-2xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stageDot[stage] }} />
                      <span className="min-w-0 flex-1 truncate text-inkSoft">{t(`backlog.stage.${stage}`)}</span>
                      <span className="shrink-0 font-mono tabular-nums text-inkFaint">
                        {stats.stage[stage]} ({pctOf(stats.stage[stage], total)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <Panel title={t("backlog.byPriority")}>
              <ul className="space-y-2.5">
                {PRIORITY_ORDER.map((priority) => (
                  <li key={priority} className="flex items-center gap-2.5 text-xs">
                    <span className="w-12 shrink-0 text-inkSoft">{t(`backlog.priority.${priority}`)}</span>
                    <div className="min-w-0 flex-1">
                      <StatBar color={priorityDot[priority]} value={stats.priority[priority]} total={total} />
                    </div>
                    <span className="w-14 shrink-0 text-end font-mono text-2xs tabular-nums text-inkFaint">
                      {stats.priority[priority]} ({pctOf(stats.priority[priority], total)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={t("backlog.byType")}>
              <ul className="space-y-2.5">
                {TYPE_ORDER.map((type) => (
                  <li key={type} className="flex items-center gap-2.5 text-xs">
                    <span className="w-16 shrink-0 text-inkSoft">{t(`backlog.type.${type}`)}</span>
                    <div className="min-w-0 flex-1">
                      <StatBar color={typeBarColor[type]} value={stats.type[type]} total={total} />
                    </div>
                    <span className="w-14 shrink-0 text-end font-mono text-2xs tabular-nums text-inkFaint">
                      {stats.type[type]} ({pctOf(stats.type[type], total)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>

            {stats.topProjects.length > 0 && (
              <Panel title={t("backlog.byProject")}>
                <ul className="space-y-2.5">
                  {stats.topProjects.map(({ id, name, count }) => {
                    const look = looks.get(id);
                    return (
                      <li key={id} className="flex items-center gap-2 text-xs">
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md"
                          style={{ backgroundColor: `${look?.color || "rgb(var(--color-inkFaint))"}22`, color: look?.color || "rgb(var(--color-inkFaint))" }}
                        >
                          {look ? <ProjectMark icon={look.icon} imageUrl={look.imageUrl} color={look.color} size={16} /> : <ListTodo size={11} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-inkSoft">{name}</span>
                        <div className="w-14 shrink-0">
                          <StatBar color={look?.color || "rgb(var(--color-teal))"} value={count} total={maxProjectCount} />
                        </div>
                        <span className="w-6 shrink-0 text-end font-mono text-2xs tabular-nums text-inkFaint">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            <Panel title={t("backlog.recent")}>
              {items.length === 0 ? (
                <p className="text-2xs text-inkFaint">{t("backlog.recent.empty")}</p>
              ) : (
                <ul className="space-y-2.5">
                  {items.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tealSoft text-teal">
                        <Plus size={12} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-ink">{item.title}</p>
                        <p className="text-2xs text-inkFaint">{timeAgo(item.createdAt, t)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      )}

      {open && (
        <AddTaskModal
          mode="full"
          heading={t("backlog.add")}
          columns={columns}
          projects={projects}
          members={members}
          currentUserId={currentUserId}
          defaultProjectId=""
          defaultColumnId={columns[0]?.id ?? null}
          creating={creating}
          allowEmptyProject
          hideCreateAnother
          onClose={() => setOpen(false)}
          onExpand={() => undefined}
          onCollapse={() => undefined}
          onProjectChange={(id) => void loadResources(id)}
          onCreate={saveDraft}
        />
      )}
    </div>
  );
}
