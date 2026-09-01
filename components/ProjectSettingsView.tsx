"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Briefcase,
  Check,
  ChevronDown,
  Code2,
  Download,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe,
  Info,
  LayoutGrid,
  Lock,
  MessageCircle,
  Monitor,
  Palette,
  Pencil,
  Settings,
  ShieldAlert,
  Smartphone,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase, ActivityEntry, BoardColumn, Profile, Project, ProjectMember, Task } from "@/lib/supabase";
import {
  defaultProjectColor,
  defaultProjectKey,
  getProjectMeta,
  PROJECT_COLORS,
  writeProjectMeta,
  type ProjectDefaultView,
  type ProjectMeta,
  type TaskCompletionAction,
} from "@/lib/projectMeta";
import { displayName, renderActivity } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ClickableAvatar from "./ClickableAvatar";
import ClickableName from "./ClickableName";
import ConfirmPasswordModal from "./ConfirmPasswordModal";
import ComingSoon from "./ComingSoon";
import Button from "./ui/Button";
import { Input } from "./ui/Input";

const DESC_MAX = 500;

const PROJECT_ICONS: { id: string; icon: LucideIcon }[] = [
  { id: "monitor", icon: Monitor },
  { id: "folder", icon: FolderKanban },
  { id: "chat", icon: MessageCircle },
  { id: "globe", icon: Globe },
  { id: "code", icon: Code2 },
  { id: "palette", icon: Palette },
  { id: "chart", icon: BarChart3 },
  { id: "phone", icon: Smartphone },
  { id: "briefcase", icon: Briefcase },
];

type SettingsTab =
  | "general"
  | "members"
  | "roles"
  | "notifications"
  | "integrations"
  | "fields"
  | "automation"
  | "advanced";

type Draft = {
  name: string;
  key: string;
  description: string;
  icon: string;
  color: string;
  visibility: "private" | "public";
  guestAccess: boolean;
  defaultView: ProjectDefaultView;
  defaultStatus: string;
  completionAction: TaskCompletionAction;
  allowClosedColumns: boolean;
  allowInvite: boolean;
  allowCreateTasks: boolean;
  allowAttachments: boolean;
  allowComments: boolean;
  archived: boolean;
};

const inputClass =
  "w-full !rounded-xl border border-line bg-paperDark/80 px-3.5 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none focus:!rounded-xl";

function metaToDraft(project: Project, meta: ProjectMeta | undefined, columns: BoardColumn[]): Draft {
  const todo = columns.find((c) => !c.is_done_column) || columns[0];
  return {
    name: project.name,
    key: meta?.key || defaultProjectKey(project.name),
    description: meta?.description || "",
    icon: meta?.icon || "monitor",
    color: meta?.color || defaultProjectColor(project.id),
    visibility: meta?.visibility || "private",
    guestAccess: meta?.guestAccess ?? false,
    defaultView: meta?.defaultView || "board",
    defaultStatus: meta?.defaultStatus || todo?.id || "",
    completionAction: meta?.completionAction || "move_done",
    allowClosedColumns: meta?.allowClosedColumns ?? true,
    allowInvite: meta?.allowInvite ?? true,
    allowCreateTasks: meta?.allowCreateTasks ?? true,
    allowAttachments: meta?.allowAttachments ?? true,
    allowComments: meta?.allowComments ?? true,
    archived: meta?.archived ?? false,
  };
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 rounded-full transition-colors shrink-0 p-0.5 flex ${
        checked ? "bg-[#6C5CE7] justify-end" : "bg-paperDark justify-start"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

function CardTitle({ icon: Icon, title, tone = "default" }: { icon: LucideIcon; title: string; tone?: "default" | "danger" }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center ${
          tone === "danger" ? "bg-[#EF4444]/15 text-[#EF4444]" : "bg-[#6C5CE7]/15 text-[#6C5CE7]"
        }`}
      >
        <Icon size={15} strokeWidth={1.75} />
      </div>
      <h2 className={`text-sm font-semibold ${tone === "danger" ? "text-[#EF4444]" : "text-ink"}`}>{title}</h2>
    </div>
  );
}

function FieldSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pe-9`}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-3 text-inkFaint" />
    </div>
  );
}

export default function ProjectSettingsView({
  project,
  members,
  tasks,
  columns,
  currentUserId,
  currentUserEmail,
  onBack,
  onViewProject,
  onOpenHistory,
  onOpenMembers,
  onProjectUpdated,
  onDeleted,
}: {
  project: Project;
  members: ProjectMember[];
  tasks: Task[];
  columns: BoardColumn[];
  currentUserId: string;
  currentUserEmail: string;
  onBack: () => void;
  onViewProject: () => void;
  onOpenHistory: () => void;
  onOpenMembers: () => void;
  onProjectUpdated: (project: Project) => void;
  onDeleted: () => void;
}) {
  const { t, lang } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [importNotice, setImportNotice] = useState(false);

  const saved = useMemo(() => metaToDraft(project, getProjectMeta(project.id), columns), [project, columns]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [committed, setCommitted] = useState<Draft>(saved);

  useEffect(() => {
    const next = metaToDraft(project, getProjectMeta(project.id), columns);
    setDraft(next);
    setCommitted(next);
  }, [project.id, project.name, columns]);

  useEffect(() => {
    const fromMembers = members.find((m) => m.user_id === project.user_id)?.profiles;
    if (fromMembers) {
      setOwnerProfile({
        id: project.user_id,
        username: fromMembers.username,
        full_name: fromMembers.full_name,
        email: null,
        avatar_url: fromMembers.avatar_url || null,
        created_at: project.created_at,
      });
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", project.user_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOwnerProfile(data as Profile);
      });
  }, [members, project.user_id, project.created_at]);

  useEffect(() => {
    supabase
      .from("activity_log")
      .select("id, project_id, task_id, actor_id, actor_name, message, action, action_params, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error && data) setActivity(data as ActivityEntry[]);
      });
  }, [project.id]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(committed);
  const ownerName = displayName(project.user_id, ownerProfile, currentUserId, t("common.you"));
  const createdOn = new Date(project.created_at).toLocaleDateString(lang === "ar" ? "ar" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const Icon = PROJECT_ICONS.find((item) => item.id === draft.icon)?.icon || Monitor;
  const memberCount = Math.max(1, members.length);
  const isOwner = currentUserId === project.user_id;

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: t("projectSettings.tab.general") },
    { id: "members", label: t("projectSettings.tab.members") },
    { id: "roles", label: t("projectSettings.tab.roles") },
    { id: "notifications", label: t("projectSettings.tab.notifications") },
    { id: "integrations", label: t("projectSettings.tab.integrations") },
    { id: "fields", label: t("projectSettings.tab.fields") },
    { id: "automation", label: t("projectSettings.tab.automation") },
    { id: "advanced", label: t("projectSettings.tab.advanced") },
  ];

  function patch(next: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function reset() {
    setDraft(committed);
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) return;
    setSaving(true);
    if (name !== project.name) {
      const { error } = await supabase.from("projects").update({ name }).eq("id", project.id);
      if (!error) onProjectUpdated({ ...project, name });
    }
    writeProjectMeta(project.id, {
      description: draft.description.trim(),
      icon: draft.icon,
      color: draft.color,
      key: draft.key.trim().toUpperCase() || defaultProjectKey(name),
      visibility: draft.visibility,
      guestAccess: draft.guestAccess,
      defaultView: draft.defaultView,
      defaultStatus: draft.defaultStatus,
      completionAction: draft.completionAction,
      allowClosedColumns: draft.allowClosedColumns,
      allowInvite: draft.allowInvite,
      allowCreateTasks: draft.allowCreateTasks,
      allowAttachments: draft.allowAttachments,
      allowComments: draft.allowComments,
      archived: draft.archived,
    });
    const nextDraft = metaToDraft({ ...project, name }, getProjectMeta(project.id), columns);
    setDraft(nextDraft);
    setCommitted(nextDraft);
    setSaving(false);
  }

  function archiveNow() {
    const next = !draft.archived;
    patch({ archived: next });
    setCommitted((prev) => ({ ...prev, archived: next }));
    writeProjectMeta(project.id, { archived: next });
  }

  function exportProject() {
    const payload = {
      name: project.name,
      exportedAt: new Date().toISOString(),
      settings: getProjectMeta(project.id) || {},
      columns: columns.map((c) => ({ name: c.name, color: c.color, position: c.position })),
      tasks: tasks.map((task) => ({
        title: task.title,
        is_done: task.is_done,
        due_date: task.due_date,
        start_date: task.start_date,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.key || "project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function performDelete() {
    const { error } = await supabase.rpc("delete_project", { p_project_id: project.id });
    setShowDelete(false);
    if (!error) onDeleted();
    else alert(error.message || t("tasks.err.deleteProject"));
  }

  return (
    <div className="fade-in -mb-8">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-inkFaint hover:text-ink">
        <ArrowRight size={14} className="rtl:rotate-0 ltr:rotate-180" />
        {t("projectSettings.backToProject")}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("workspace.projectSettings")}</h1>
          <p className="mt-1 text-sm text-inkSoft">{t("projectSettings.subtitle")}</p>
        </div>
        <Button onClick={onViewProject}>
          <ExternalLink size={14} strokeWidth={1.75} />
          {t("projectSettings.viewProject")}
        </Button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-line mb-5">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "text-ink" : "text-inkFaint hover:text-inkSoft"
              }`}
            >
              {item.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#6C5CE7]" />}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 pb-24">
        <div className="min-w-0 space-y-4">
          {tab === "general" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2">
              <Card>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="relative shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => setShowIcons((v) => !v)}
                      className="h-16 w-16 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: draft.color }}
                      aria-label={t("projects.iconLabel")}
                    >
                      <Icon size={28} strokeWidth={1.75} />
                    </button>
                    <span className="absolute -bottom-1 -end-1 h-6 w-6 rounded-full bg-surface border border-line text-ink flex items-center justify-center pointer-events-none">
                      <Pencil size={11} />
                    </span>
                    {showIcons && (
                      <div className="absolute top-full start-0 mt-2 z-20 w-52 rounded-xl border border-line bg-paper shadow-modal p-2 grid grid-cols-5 gap-1">
                        {PROJECT_ICONS.map(({ id, icon: ItemIcon }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              patch({ icon: id });
                              setShowIcons(false);
                            }}
                            className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${
                              draft.icon === id ? "bg-[#6C5CE7]/20 text-[#6C5CE7]" : "text-inkSoft hover:bg-paperDark"
                            }`}
                          >
                            <ItemIcon size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-0">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-inkSoft mb-1.5">
                        {t("projects.nameLabel")} <span className="text-[#EF4444]">*</span>
                      </label>
                      <Input className={inputClass} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-inkSoft mb-1.5 inline-flex items-center gap-1">
                        {t("projectSettings.projectKey")}
                        <Info size={12} className="text-inkFaint" />
                      </label>
                      <Input
                        className={inputClass}
                        value={draft.key}
                        maxLength={6}
                        onChange={(e) => patch({ key: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                </div>

                <label className="block text-xs font-medium text-inkSoft mb-1.5">{t("projects.descLabel")}</label>
                <div className="relative mb-4">
                  <textarea
                    value={draft.description}
                    maxLength={DESC_MAX}
                    rows={3}
                    onChange={(e) => patch({ description: e.target.value.slice(0, DESC_MAX) })}
                    className={`${inputClass} resize-none min-h-[88px] leading-relaxed`}
                    placeholder={t("projects.descPlaceholder")}
                  />
                  <span className="absolute bottom-2 end-3 text-[11px] text-inkFaint tabular-nums">
                    {draft.description.length} / {DESC_MAX}
                  </span>
                </div>

                <label className="block text-xs font-medium text-inkSoft mb-2">{t("projects.colorLabel")}</label>
                <div className="flex flex-wrap items-center gap-2.5 mb-4">
                  {PROJECT_COLORS.map((color) => {
                    const active = draft.color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => patch({ color })}
                        className="h-7 w-7 rounded-full inline-flex items-center justify-center"
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      >
                        {active && <Check size={13} strokeWidth={3} className="text-white" />}
                      </button>
                    );
                  })}
                </div>

                <label className="block text-xs font-medium text-inkSoft mb-1.5">{t("projectSettings.owner")}</label>
                <div className={`${inputClass} flex items-center gap-2.5`}>
                  <ClickableAvatar
                    userId={project.user_id}
                    name={ownerName}
                    src={ownerProfile?.avatar_url}
                    size="sm"
                  />
                  <span className="text-sm text-ink truncate">
                    {ownerName}
                    {project.user_id === currentUserId ? ` ${t("projectSettings.youOwner")}` : ` · ${t("projectSettings.ownerRole")}`}
                  </span>
                </div>
              </Card>
              </div>

              <div className="space-y-4">
              <Card>
                <CardTitle icon={Lock} title={t("projectSettings.visibility")} />
                <FieldSelect
                  value={draft.visibility}
                  onChange={(v) => patch({ visibility: v as "private" | "public" })}
                >
                  <option value="private">{t("projectSettings.visibility.private")}</option>
                  <option value="public">{t("projectSettings.visibility.public")}</option>
                </FieldSelect>
                <p className="mt-1.5 mb-4 text-xs text-inkFaint">
                  {draft.visibility === "private"
                    ? t("projectSettings.visibility.privateHint")
                    : t("projectSettings.visibility.publicHint")}
                </p>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paperDark/40 px-3.5 py-3">
                  <p className="text-sm text-ink inline-flex items-center gap-1.5">
                    {t("projectSettings.guestAccess")}
                    <Info size={13} className="text-inkFaint" />
                  </p>
                  <Toggle checked={draft.guestAccess} onChange={(v) => patch({ guestAccess: v })} />
                </div>
              </Card>

              <Card>
                <CardTitle icon={Settings} title={t("projectSettings.defaults")} />
                <div className="grid grid-cols-1 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-inkSoft mb-1.5">{t("projectSettings.defaultView")}</label>
                    <FieldSelect
                      value={draft.defaultView}
                      onChange={(v) => patch({ defaultView: v as ProjectDefaultView })}
                    >
                      <option value="board">{t("views.board")}</option>
                      <option value="list">{t("views.list")}</option>
                      <option value="calendar">{t("views.calendar")}</option>
                      <option value="timeline">{t("views.timeline")}</option>
                    </FieldSelect>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-inkSoft mb-1.5">{t("projectSettings.defaultStatus")}</label>
                    <FieldSelect value={draft.defaultStatus} onChange={(v) => patch({ defaultStatus: v })}>
                      {columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </FieldSelect>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-inkSoft mb-1.5">{t("projectSettings.completionAction")}</label>
                    <FieldSelect
                      value={draft.completionAction}
                      onChange={(v) => patch({ completionAction: v as TaskCompletionAction })}
                    >
                      <option value="move_done">{t("projectSettings.completion.moveDone")}</option>
                      <option value="archive">{t("projectSettings.completion.archive")}</option>
                      <option value="none">{t("projectSettings.completion.none")}</option>
                    </FieldSelect>
                  </div>
                </div>
                <label className="flex items-start gap-2.5 text-sm text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    className="task-check mt-0.5"
                    checked={draft.allowClosedColumns}
                    onChange={(e) => patch({ allowClosedColumns: e.target.checked })}
                  />
                  <span>
                    {t("projectSettings.allowClosed")}
                    <span className="block text-xs text-inkFaint mt-0.5">{t("projectSettings.allowClosedHint")}</span>
                  </span>
                </label>
              </Card>
              </div>

              <div className="space-y-4">
              <Card>
                <CardTitle icon={FileText} title={t("workspace.projectSettings")} />
                <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
                  <div>
                    <p className="text-sm font-medium text-ink">{t("projectSettings.archiveTitle")}</p>
                    <p className="text-xs text-inkFaint mt-0.5">{t("projectSettings.archiveHint")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={archiveNow}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#EF4444]/50 text-[#EF4444] px-3 py-1.5 text-sm hover:bg-[#EF4444]/10"
                  >
                    <Archive size={14} />
                    {draft.archived ? t("projectSettings.unarchive") : t("projectSettings.archive")}
                  </button>
                </div>
                {(
                  [
                    ["allowInvite", t("projectSettings.allowInvite")],
                    ["allowCreateTasks", t("projectSettings.allowCreateTasks")],
                    ["allowAttachments", t("projectSettings.allowAttachments")],
                    ["allowComments", t("projectSettings.allowComments")],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-0 last:pb-0">
                    <p className="text-sm text-ink">{label}</p>
                    <Toggle checked={draft[key]} onChange={(v) => patch({ [key]: v })} />
                  </div>
                ))}
              </Card>

              <Card className="border-[#EF4444]/25">
                <CardTitle icon={AlertTriangle} title={t("projectSettings.danger")} tone="danger" />
                <p className="text-sm text-inkSoft mb-4">{t("projectSettings.deleteHint")}</p>
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setShowDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#EF4444]/60 text-[#EF4444] px-3.5 py-2 text-sm hover:bg-[#EF4444]/10 disabled:opacity-40"
                >
                  <ShieldAlert size={14} />
                  {t("projectSettings.delete")}
                </button>
              </Card>
              </div>
            </div>
          )}

          {tab === "members" && (
            <Card>
              <CardTitle icon={Users} title={t("projectSettings.tab.members")} />
              <ul className="space-y-3">
                {members.map((member) => {
                  const name = displayName(member.user_id, member.profiles, currentUserId, t("common.you"));
                  const owner = member.user_id === project.user_id;
                  return (
                    <li key={member.id} className="flex items-center gap-3">
                      <ClickableAvatar userId={member.user_id} name={name} src={member.profiles?.avatar_url} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">{name}</p>
                        <p className="text-xs text-inkFaint">{owner ? t("projectSettings.ownerRole") : t("projectSettings.memberRole")}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Button className="mt-4" onClick={onOpenMembers}>
                {t("workspace.share")}
              </Button>
            </Card>
          )}

          {tab !== "general" && tab !== "members" && <ComingSoon title={tabs.find((item) => item.id === tab)?.label || ""} icon={Settings} />}
        </div>

        <aside className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-ink mb-4">{t("projectSettings.about")}</h3>
            <dl className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-inkFaint">{t("projectSettings.createdBy")}</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <ClickableAvatar userId={project.user_id} name={ownerName} src={ownerProfile?.avatar_url} size="xs" />
                  <span className="truncate text-ink">{ownerName}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-inkFaint">{t("projectSettings.createdOn")}</dt>
                <dd className="text-ink">{createdOn}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-inkFaint">{t("projects.members")}</dt>
                <dd className="text-ink">{t("projectSettings.membersCount").replace("{n}", String(memberCount))}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-inkFaint">{t("projects.tasks")}</dt>
                <dd className="text-ink">{t("projectSettings.tasksCount").replace("{n}", String(tasks.length))}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-inkFaint">{t("projectSettings.status")}</dt>
                <dd className="inline-flex items-center gap-1.5 text-ink">
                  <span className={`h-1.5 w-1.5 rounded-full ${draft.archived ? "bg-inkFaint" : "bg-[#22C55E]"}`} />
                  {draft.archived ? t("projects.status.archived") : t("projects.status.active")}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-semibold text-ink">{t("projectSettings.activity")}</h3>
              <button type="button" onClick={onOpenHistory} className="text-xs text-[#A78BFA] hover:text-[#C4B5FD]">
                {t("projectSettings.viewHistory")}
              </button>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-inkFaint">{t("workspace.noActivity")}</p>
            ) : (
              <ul className="space-y-3.5">
                {activity.map((entry) => {
                  const { label, rest, actorId } = renderActivity(entry, t, currentUserId, true);
                  const member = members.find((m) => m.user_id === actorId);
                  const name = label || displayName(actorId, member?.profiles, currentUserId, t("common.you"));
                  return (
                    <li key={entry.id} className="flex items-start gap-2.5">
                      <ClickableAvatar
                        userId={actorId}
                        name={name}
                        src={member?.profiles?.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug">
                          {label && (
                            <ClickableName userId={actorId} className="text-ink font-medium">
                              {label}
                            </ClickableName>
                          )}
                          <span className="text-[#A78BFA]">{rest}</span>
                        </p>
                        <p className="text-[11px] text-inkFaint mt-0.5">{timeAgo(entry.created_at, t)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={onOpenHistory}
              className="mt-4 w-full rounded-lg border border-line py-2 text-sm text-inkSoft hover:text-ink hover:bg-paperDark"
            >
              {t("projectSettings.viewAllActivity")}
            </button>
          </Card>

          <Card>
            <p className="text-sm font-medium text-ink">{t("projectSettings.exportTitle")}</p>
            <p className="text-xs text-inkFaint mt-1 mb-3">{t("projectSettings.exportHint")}</p>
            <Button onClick={exportProject}>
              <Download size={14} />
              {t("projectSettings.export")}
            </Button>
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-sm font-medium text-ink">{t("projectSettings.importTitle")}</p>
              <p className="text-xs text-inkFaint mt-1 mb-3">{t("projectSettings.importHint")}</p>
              <Button onClick={() => setImportNotice(true)}>
                <Upload size={14} />
                {t("settings.import")}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {tab === "general" && (
        <div className="sticky bottom-0 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-paper/95 backdrop-blur border-t border-line flex items-center justify-end gap-2 z-20">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty}
            className="px-3 py-2 text-sm text-inkFaint hover:text-ink disabled:opacity-40"
          >
            {t("projectSettings.reset")}
          </button>
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={save}>
            <Check size={15} strokeWidth={2.25} />
            {t("projectSettings.save")}
          </Button>
        </div>
      )}

      {showDelete && (
        <ConfirmPasswordModal
          email={currentUserEmail}
          title={t("tasks.deleteProjectTitle")}
          message={t("tasks.deleteProjectMessage").replace("{name}", project.name)}
          confirmLabel={t("common.delete")}
          onCancel={() => setShowDelete(false)}
          onConfirm={performDelete}
        />
      )}

      {importNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setImportNotice(false)}>
          <div className="max-w-sm w-full rounded-xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-2">{t("settings.importData")}</h3>
            <p className="text-sm text-inkSoft mb-4">{t("settings.importNotReady")}</p>
            <Button fullWidth onClick={() => setImportNotice(false)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
