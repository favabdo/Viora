"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  FileText,
  Filter,
  Folder,
  History,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase, ActivityEntry, Project, ProjectMember, Task } from "@/lib/supabase";
import { displayName, renderActivity } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ClickableName from "./ClickableName";
import Avatar from "./ui/Avatar";
import Button from "./ui/Button";
import { Input } from "./ui/Input";

const PAGE = 25;
const ACCENT = "#6C5CE7";

type HistoryTab = "all" | "tasks" | "comments" | "files" | "members" | "invitations" | "settings" | "audit";
type DateRange = "7" | "30" | "90" | "all";

const TASK_ACTIONS = [
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
];
const COMMENT_ACTIONS = ["comment_added", "comment_deleted"];
const MEMBER_ACTIONS = ["member_joined"];
const INVITE_ACTIONS = ["member_invited"];
const SETTINGS_ACTIONS = ["project_renamed"];

type ProfileBit = { username: string; full_name: string; avatar_url?: string | null };

function param(entry: ActivityEntry, key: string): string {
  const value = entry.action_params?.[key];
  if (value == null) return "";
  return String(value);
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startFromRange(range: DateRange): string | null {
  if (range === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Number(range));
  return d.toISOString();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return ymd(d);
}

function inferAction(entry: ActivityEntry): string {
  if (entry.action) return entry.action;
  const msg = entry.message || "";
  if (msg.includes("أضاف مهمة") || msg.toLowerCase().includes("added")) return "task_created";
  if (msg.includes("أكمل") || msg.includes("خلّص") || msg.toLowerCase().includes("completed")) return "task_completed";
  if (msg.includes("أعاد فتح") || msg.includes("رجّع") || msg.toLowerCase().includes("reopened")) return "task_reopened";
  if (msg.includes("عنوان")) return "task_title_changed";
  if (msg.includes("حذف مهمة") || msg.toLowerCase().includes("deleted")) return "task_deleted";
  if (msg.includes("انضم")) return "member_joined";
  return "unknown";
}

function tabActions(tab: HistoryTab): string[] | null {
  if (tab === "all" || tab === "audit") return null;
  if (tab === "tasks") return TASK_ACTIONS;
  if (tab === "comments") return COMMENT_ACTIONS;
  if (tab === "files") return ["file_uploaded"];
  if (tab === "members") return MEMBER_ACTIONS;
  if (tab === "invitations") return INVITE_ACTIONS;
  if (tab === "settings") return SETTINGS_ACTIONS;
  return null;
}

function matchesTab(entry: ActivityEntry, tab: HistoryTab): boolean {
  const allowed = tabActions(tab);
  if (!allowed) return true;
  return allowed.includes(inferAction(entry));
}

function iconFor(action: string): { bg: string; Icon: typeof Check } {
  if (action === "task_completed") return { bg: "#22C55E", Icon: Check };
  if (action === "task_reopened" || action === "task_status_changed") return { bg: "#F59E0B", Icon: RefreshCw };
  if (action === "task_created") return { bg: ACCENT, Icon: Plus };
  if (action === "comment_added" || action === "comment_deleted") return { bg: "#3B82F6", Icon: MessageSquare };
  if (action === "member_joined") return { bg: "#22C55E", Icon: UserPlus };
  if (action === "member_invited") return { bg: ACCENT, Icon: Mail };
  if (action === "project_renamed") return { bg: "#64748B", Icon: Settings };
  if (action === "task_deleted") return { bg: "#EF4444", Icon: History };
  return { bg: "#3B82F6", Icon: Check };
}

function verbKey(action: string): string {
  const map: Record<string, string> = {
    task_created: "history.verb.created",
    task_completed: "history.verb.completed",
    task_reopened: "history.verb.reopened",
    task_title_changed: "history.verb.title",
    task_deleted: "history.verb.deleted",
    task_status_changed: "history.verb.updated",
    task_due_changed: "history.verb.due",
    task_due_cleared: "history.verb.dueCleared",
    task_start_changed: "history.verb.start",
    task_priority_changed: "history.verb.priority",
    task_assignee_changed: "history.verb.assigned",
    task_unassigned: "history.verb.unassigned",
    comment_added: "history.verb.commented",
    comment_deleted: "history.verb.commentDeleted",
    member_joined: "history.verb.joined",
    member_invited: "history.verb.invited",
    project_renamed: "history.verb.renamed",
  };
  return map[action] || "";
}

function priorityMeta(color: string, t: (k: string) => string): { label: string; className: string } | null {
  if (!color) return null;
  if (color === "#ef4444") return { label: t("list.priority.high"), className: "bg-[#EF4444]/15 text-[#EF4444]" };
  if (color === "#f97316" || color === "#eab308") return { label: t("list.priority.medium"), className: "bg-[#F59E0B]/15 text-[#D97706]" };
  return { label: t("list.priority.low"), className: "bg-[#22C55E]/15 text-[#16A34A]" };
}

function formatStamp(iso: string, locale: string, t: (k: string) => string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86400000);
  if (diffDays === 0) return time;
  if (diffDays === 1) return `${t("history.yesterday")}, ${time}`;
  return `${new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(date)}, ${time}`;
}

function groupLabel(iso: string, locale: string, t: (k: string) => string): string {
  const date = new Date(iso);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86400000);
  if (diffDays === 0) return t("history.today");
  if (diffDays === 1) return t("history.yesterday");
  if (diffDays < 7) return t("history.daysAgo").replace("{n}", String(diffDays));
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 88;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - 3 - (v / max) * (h - 6);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}

export default function ProjectHistoryView({
  project,
  members,
  tasks,
  currentUserId,
}: {
  project: Project;
  members: ProjectMember[];
  tasks: Task[];
  currentUserId: string;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileBit>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState<HistoryTab>("all");
  const [query, setQuery] = useState("");
  const [draftRange, setDraftRange] = useState<DateRange>("30");
  const [draftType, setDraftType] = useState<HistoryTab>("all");
  const [draftMember, setDraftMember] = useState("all");
  const [appliedRange, setAppliedRange] = useState<DateRange>("30");
  const [appliedType, setAppliedType] = useState<HistoryTab>("all");
  const [appliedMember, setAppliedMember] = useState("all");

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) map.set(task.id, task.title);
    return map;
  }, [tasks]);

  const loadProfiles = useCallback(async (rows: ActivityEntry[]) => {
    const ids = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
    if (ids.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", ids);
    if (!data) return;
    setProfiles((prev) => {
      const next = { ...prev };
      for (const row of data as (ProfileBit & { id: string })[]) {
        next[row.id] = { username: row.username, full_name: row.full_name, avatar_url: row.avatar_url };
      }
      return next;
    });
  }, []);

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      let q = supabase
        .from("activity_log")
        .select("id, project_id, task_id, actor_id, actor_name, message, action, action_params, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });
      const from = startFromRange(appliedRange);
      if (from) q = q.gte("created_at", from);
      if (appliedMember !== "all") q = q.eq("actor_id", appliedMember);
      const typeFilter = tabActions(appliedType);
      if (typeFilter) q = q.in("action", typeFilter);
      const { data, error } = await q.range(offset, offset + PAGE - 1);
      if (error || !data) return [];
      const rows = data as ActivityEntry[];
      await loadProfiles(rows);
      setHasMore(rows.length === PAGE);
      setEntries((prev) => (replace ? rows : [...prev, ...rows]));
      return rows;
    },
    [project.id, appliedRange, appliedMember, appliedType, loadProfiles]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPage(0, true).then(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchPage]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-history-${project.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `project_id=eq.${project.id}` },
        (payload) => {
          const row = payload.new as ActivityEntry;
          setEntries((prev) => [row, ...prev]);
          void loadProfiles([row]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id, loadProfiles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!matchesTab(entry, tab)) return false;
      if (!q) return true;
      const title = param(entry, "title") || (entry.task_id ? taskTitleById.get(entry.task_id) || "" : "");
      const blob = `${entry.actor_name} ${entry.message} ${title} ${param(entry, "snippet")} ${param(entry, "status")}`.toLowerCase();
      return blob.includes(q);
    });
  }, [entries, tab, query, taskTitleById]);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const entry of visible) {
      const key = dayKey(entry.created_at);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visible]);

  const stats = useMemo(() => {
    const all = entries.length;
    const taskN = entries.filter((e) => TASK_ACTIONS.includes(inferAction(e))).length;
    const commentN = entries.filter((e) => COMMENT_ACTIONS.includes(inferAction(e))).length;
    const memberN = entries.filter((e) => MEMBER_ACTIONS.includes(inferAction(e))).length;
    const inviteN = entries.filter((e) => INVITE_ACTIONS.includes(inferAction(e))).length;
    return [
      { key: "all", label: t("history.stat.all"), count: all, color: "bg-[#6C5CE7]/12 text-[#6C5CE7]", Icon: History },
      { key: "tasks", label: t("history.stat.tasks"), count: taskN, color: "bg-[#22C55E]/12 text-[#16A34A]", Icon: Check },
      { key: "comments", label: t("history.stat.comments"), count: commentN, color: "bg-[#3B82F6]/12 text-[#2563EB]", Icon: MessageSquare },
      { key: "files", label: t("history.stat.files"), count: 0, color: "bg-[#F59E0B]/12 text-[#D97706]", Icon: FileText },
      { key: "members", label: t("history.stat.members"), count: memberN, color: "bg-[#EC4899]/12 text-[#DB2777]", Icon: Users },
      { key: "invitations", label: t("history.stat.invites"), count: inviteN, color: "bg-[#14B8A6]/12 text-[#0F766E]", Icon: Mail },
    ];
  }, [entries, t]);

  const topMembers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const id = entry.actor_id || entry.actor_name;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const member = members.find((m) => m.user_id === id);
        const profile = profiles[id] || member?.profiles || null;
        const fallback = entries.find((e) => e.actor_id === id)?.actor_name || (member ? "" : id);
        const name = displayName(
          member?.user_id || (profiles[id] ? id : ""),
          profile,
          currentUserId,
          t("common.you")
        );
        const shown = profile || member ? name : fallback || t("common.someone");
        return { id, name: shown, count, max, src: profile?.avatar_url };
      });
  }, [entries, members, profiles, currentUserId, t]);

  const sparkValues = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts = Array.from({ length: days }, () => 0);
    for (const entry of entries) {
      const d = new Date(entry.created_at);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
      if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
    }
    return counts;
  }, [entries]);

  function applyFilters() {
    setAppliedRange(draftRange);
    setAppliedType(draftType);
    setAppliedMember(draftMember);
    setTab(draftType === "all" ? "all" : draftType);
  }

  function resetFilters() {
    setDraftRange("30");
    setDraftType("all");
    setDraftMember("all");
    setAppliedRange("30");
    setAppliedType("all");
    setAppliedMember("all");
    setTab("all");
    setQuery("");
  }

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(entries.length, false);
    setLoadingMore(false);
  }

  function exportCsv() {
    const header = ["time", "actor", "action", "task", "message"];
    const rows = visible.map((entry) => {
      const action = inferAction(entry);
      const title = param(entry, "title") || (entry.task_id ? taskTitleById.get(entry.task_id) || "" : "");
      return [entry.created_at, entry.actor_name, action, title, entry.message].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: HistoryTab; label: string }[] = [
    { id: "all", label: t("history.tab.all") },
    { id: "tasks", label: t("history.tab.tasks") },
    { id: "comments", label: t("history.tab.comments") },
    { id: "files", label: t("history.tab.files") },
    { id: "members", label: t("history.tab.members") },
    { id: "invitations", label: t("history.tab.invites") },
    { id: "settings", label: t("history.tab.settings") },
    { id: "audit", label: t("history.tab.audit") },
  ];

  const selectClass =
    "w-full rounded-xl border-0 bg-surfaceSunken px-3 py-2 text-xs text-ink outline-none focus:outline-none focus:ring-0";

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">{t("history.title")}</h2>
            <p className="text-sm text-inkFaint mt-0.5">{t("history.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("history.search")} className="ps-8 py-2 text-xs" />
            </div>
            <Button size="sm" onClick={exportCsv}>
              <Download size={14} />
              {t("history.export")}
            </Button>
            <button className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line text-inkFaint hover:text-ink">
              <SlidersHorizontal size={14} />
            </button>
          </div>
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

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-line skeleton" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
            <History size={22} className="mx-auto text-inkFaint mb-2" />
            <p className="text-sm text-inkSoft">{t("history.empty")}</p>
            <p className="text-xs text-inkFaint mt-1">{t("history.emptyHint")}</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute top-3 bottom-3 w-px bg-line" style={{ insetInlineStart: 15 }} />
            {groups.map(([key, list]) => (
              <div key={key} className="mb-5">
                <p className="relative z-[1] mb-3 text-xs font-medium text-inkFaint">{groupLabel(list[0].created_at, locale, t)}</p>
                <ul className="space-y-3">
                  {list.map((entry) => {
                    const action = inferAction(entry);
                    const { bg, Icon } = iconFor(action);
                    const profile = (entry.actor_id && profiles[entry.actor_id]) || null;
                    const actorName = displayName(entry.actor_id, profile, currentUserId, t("common.you")) || entry.actor_name;
                    const title =
                      param(entry, "title") ||
                      (entry.task_id ? taskTitleById.get(entry.task_id) || "" : "") ||
                      param(entry, "name");
                    const verb = verbKey(action) ? t(verbKey(action)) : renderActivity(entry, t, currentUserId, true).rest.trim();
                    const status = param(entry, "status");
                    const statusColor = param(entry, "status_color") || "#22C55E";
                    const due = param(entry, "due");
                    const color = param(entry, "color");
                    const prio = priorityMeta(color, t);
                    const snippet = param(entry, "snippet");
                    const assigneeName = param(entry, "assignee");

                    return (
                      <li key={entry.id} className="relative flex gap-3">
                        <span
                          className="relative z-[1] mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                          style={{ backgroundColor: bg }}
                        >
                          <Icon size={13} strokeWidth={2.4} />
                        </span>
                        <div className="flex-1 min-w-0 rounded-xl border border-line bg-surface px-3.5 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-ink leading-6">
                                <span className="inline-flex items-center gap-1.5 align-middle me-1">
                                  <Avatar name={actorName} src={profile?.avatar_url} size="xs" />
                                  <ClickableName userId={entry.actor_id} className="font-semibold text-ink">
                                    {actorName}
                                  </ClickableName>
                                </span>
                                <span className="text-inkSoft"> {verb} </span>
                                {title && action !== "project_renamed" && action !== "member_joined" && action !== "member_invited" && (
                                  <span className="font-medium text-[#6C5CE7]">{title}</span>
                                )}
                                {action === "member_invited" && param(entry, "member") && (
                                  <span className="font-medium text-[#6C5CE7]">{param(entry, "member")}</span>
                                )}
                                {action === "project_renamed" && <span className="font-medium text-[#6C5CE7]">{param(entry, "name")}</span>}
                              </p>
                              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-inkFaint">
                                <Folder size={11} />
                                {t("history.inProject")} {project.name}
                              </p>

                              {(action === "task_completed" || action === "task_reopened" || action === "task_status_changed") && status && (
                                <p className="mt-2 text-[12px] text-inkSoft">
                                  {t("history.statusChanged")}{" "}
                                  <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                    style={{ backgroundColor: `${statusColor}22`, color: statusColor }}
                                  >
                                    {status}
                                  </span>
                                </p>
                              )}

                              {action === "task_created" && (prio || due || assigneeName) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                  {prio && (
                                    <span>
                                      {t("history.priority")}{" "}
                                      <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${prio.className}`}>{prio.label}</span>
                                    </span>
                                  )}
                                  {due && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-surfaceSunken px-2 py-0.5 text-inkSoft">
                                      {t("history.due")} {due}
                                    </span>
                                  )}
                                </div>
                              )}

                              {action === "task_due_changed" && due && (
                                <p className="mt-2 text-[12px] text-inkSoft">
                                  {t("history.due")} <span className="rounded-full bg-surfaceSunken px-2 py-0.5">{due}</span>
                                </p>
                              )}

                              {action === "task_priority_changed" && prio && (
                                <p className="mt-2 text-[12px] text-inkSoft">
                                  {t("history.priority")}{" "}
                                  <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${prio.className}`}>{prio.label}</span>
                                </p>
                              )}

                              {action === "task_assignee_changed" && assigneeName && (
                                <p className="mt-2 text-[12px] text-inkSoft">
                                  {t("history.assignedTo")} <span className="font-medium text-ink">{assigneeName}</span>
                                </p>
                              )}

                              {snippet && (
                                <p className="mt-2 rounded-lg bg-surfaceSunken px-2.5 py-1.5 text-[12px] text-inkSoft">“{snippet}”</p>
                              )}
                            </div>
                            <div className="flex items-start gap-1 shrink-0">
                              <span className="text-[11px] text-inkFaint whitespace-nowrap pt-0.5">
                                {formatStamp(entry.created_at, locale, t)}
                              </span>
                              <button className="text-inkFaint hover:text-ink" aria-label={t("workspace.more")}>
                                <MoreHorizontal size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {hasMore && (
              <div className="ps-11">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full rounded-xl border border-line bg-surface py-2.5 text-sm text-inkSoft hover:text-ink"
                >
                  {loadingMore ? t("common.loading") : t("history.loadMore")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="w-full xl:w-[280px] shrink-0 space-y-4">
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-1 inline-flex items-center gap-1.5">
            <Filter size={12} />
            {t("list.filter")}
          </h3>
          <label className="block text-[11px] text-inkFaint">{t("history.filter.range")}</label>
          <select value={draftRange} onChange={(e) => setDraftRange(e.target.value as DateRange)} className={selectClass}>
            <option value="7">{t("history.range.7")}</option>
            <option value="30">{t("history.range.30")}</option>
            <option value="90">{t("history.range.90")}</option>
            <option value="all">{t("history.range.all")}</option>
          </select>
          <label className="block text-[11px] text-inkFaint pt-1">{t("history.filter.type")}</label>
          <select value={draftType} onChange={(e) => setDraftType(e.target.value as HistoryTab)} className={selectClass}>
            <option value="all">{t("history.tab.all")}</option>
            <option value="tasks">{t("history.tab.tasks")}</option>
            <option value="comments">{t("history.tab.comments")}</option>
            <option value="members">{t("history.tab.members")}</option>
            <option value="invitations">{t("history.tab.invites")}</option>
            <option value="settings">{t("history.tab.settings")}</option>
          </select>
          <label className="block text-[11px] text-inkFaint pt-1">{t("history.filter.member")}</label>
          <select value={draftMember} onChange={(e) => setDraftMember(e.target.value)} className={selectClass}>
            <option value="all">{t("calendar.allAssignees")}</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {displayName(member.user_id, member.profiles, currentUserId, t("common.you"))}
              </option>
            ))}
          </select>
          <Button variant="primary" size="sm" fullWidth className="mt-1" onClick={applyFilters}>
            {t("history.apply")}
          </Button>
          <button onClick={resetFilters} className="w-full text-center text-xs text-inkFaint hover:text-[#6C5CE7]">
            {t("history.reset")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {stats.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as HistoryTab)}
              className={`rounded-xl px-2.5 py-2.5 text-start ${item.color}`}
            >
              <item.Icon size={14} className="mb-1 opacity-80" />
              <p className="text-lg font-semibold leading-none">{item.count}</p>
              <p className="text-[10px] mt-1 opacity-80">{item.label}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("history.topMembers")}</h3>
          {topMembers.length === 0 ? (
            <p className="text-xs text-inkFaint">{t("workspace.noActivity")}</p>
          ) : (
            <ul className="space-y-2.5">
              {topMembers.map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <Avatar name={member.name} src={member.src} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink truncate">{member.name}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-surfaceSunken overflow-hidden">
                      <div className="h-full rounded-full bg-[#6C5CE7]" style={{ width: `${(member.count / member.max) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] text-inkFaint">{member.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <h3 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("history.recentActivity")}</h3>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{project.name}</p>
              <p className="text-[11px] text-inkFaint">{t("history.activityCount").replace("{n}", String(entries.length))}</p>
            </div>
            <Sparkline values={sparkValues} color={ACCENT} />
          </div>
        </div>
      </aside>
    </div>
  );
}
