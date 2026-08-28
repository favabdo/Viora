"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, LinkItem, Project } from "@/lib/supabase";
import ItemHistory from "./ItemHistory";
import Button from "./ui/Button";
import { Input, Textarea } from "./ui/Input";
import EmptyState from "./ui/EmptyState";
import { SkeletonCards } from "./ui/Skeleton";
import Modal from "./ui/Modal";
import Avatar from "./ui/Avatar";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const PAGE_SIZE = 7;
const META_KEY = "viora-link-meta";
const TAG_COLORS = ["#6C5CE7", "#3B82F6", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6", "#EF4444"];

type TabId = "all" | "favorites" | "project" | "tag";
type SortId = "recent" | "oldest" | "title";
type ViewMode = "list" | "grid";
type LinkMeta = { favorite?: boolean; tags?: string[]; projectId?: string | null };

const BRAND_ICONS: Record<string, string> = {
  "tiktok.com": "https://cdn.simpleicons.org/tiktok/000000",
  "instagram.com": "https://cdn.simpleicons.org/instagram/E4405F",
  "facebook.com": "https://cdn.simpleicons.org/facebook/1877F2",
  "x.com": "https://cdn.simpleicons.org/x/000000",
  "twitter.com": "https://cdn.simpleicons.org/x/000000",
  "youtube.com": "https://cdn.simpleicons.org/youtube/FF0000",
  "linkedin.com": "https://cdn.simpleicons.org/linkedin/0A66C2",
  "pinterest.com": "https://cdn.simpleicons.org/pinterest/E60023",
  "snapchat.com": "https://cdn.simpleicons.org/snapchat/FFFC00",
  "whatsapp.com": "https://cdn.simpleicons.org/whatsapp/25D366",
  "telegram.org": "https://cdn.simpleicons.org/telegram/26A5E4",
  "t.me": "https://cdn.simpleicons.org/telegram/26A5E4",
  "github.com": "https://cdn.simpleicons.org/github/181717",
  "reddit.com": "https://cdn.simpleicons.org/reddit/FF4500",
  "figma.com": "https://cdn.simpleicons.org/figma/F24E1E",
  "notion.so": "https://cdn.simpleicons.org/notion/000000",
  "medium.com": "https://cdn.simpleicons.org/medium/000000",
};

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function faviconFor(url: string) {
  const domain = getDomain(url);
  const matchedKey = Object.keys(BRAND_ICONS).find((key) => domain === key || domain.endsWith(`.${key}`));
  if (matchedKey) return BRAND_ICONS[matchedKey];
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function readMeta(): Record<string, LinkMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LinkMeta>) : {};
  } catch {
    return {};
  }
}

function writeMeta(all: Record<string, LinkMeta>) {
  localStorage.setItem(META_KEY, JSON.stringify(all));
}

function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function linkTitle(link: LinkItem) {
  const text = (link.description || "").trim();
  if (!text) return getDomain(link.url);
  return text.split("\n")[0];
}

function formatAdded(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatStamp(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function LinksSection({
  currentUserId,
  userName,
  avatarUrl,
}: {
  currentUserId: string;
  userName: string;
  avatarUrl?: string | null;
}) {
  const { t, lang } = useTranslation();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meta, setMeta] = useState<Record<string, LinkMeta>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("all");
  const [sort, setSort] = useState<SortId>("recent");
  const [view, setView] = useState<ViewMode>("list");
  const [projectFilter, setProjectFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    setMeta(readMeta());
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [linksRes, projectsRes] = await Promise.all([
      supabase.from("links").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("*").order("created_at", { ascending: true }),
    ]);
    if (!linksRes.error && linksRes.data) setLinks(linksRes.data as LinkItem[]);
    if (!projectsRes.error && projectsRes.data) setProjects(projectsRes.data as Project[]);
    setLoading(false);
  }

  function patchMeta(id: string, patch: LinkMeta) {
    setMeta((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      writeMeta(next);
      return next;
    });
  }

  function projectName(id?: string | null) {
    if (!id) return "";
    return projects.find((p) => p.id === id)?.name || "";
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...links];
    if (q) {
      list = list.filter((item) => {
        const extra = meta[item.id];
        const hay = `${item.url} ${item.description} ${(extra?.tags || []).join(" ")} ${projectName(extra?.projectId)}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (tab === "favorites") list = list.filter((item) => meta[item.id]?.favorite);
    if (projectFilter !== "all") list = list.filter((item) => meta[item.id]?.projectId === projectFilter);
    if (tab === "tag") {
      list = list.filter((item) => (meta[item.id]?.tags || []).length > 0);
    }
    list.sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "title") return linkTitle(a).localeCompare(linkTitle(b), locale);
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [links, meta, query, tab, sort, projectFilter, projects, locale]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = links.find((item) => item.id === selectedId) || null;
  const selectedMeta = selected ? meta[selected.id] || {} : {};

  useEffect(() => {
    setPage(1);
  }, [query, tab, sort, projectFilter]);

  useEffect(() => {
    if (selectedId && !links.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [links, selectedId]);

  function grouped(list: LinkItem[]) {
    if (tab !== "project" && tab !== "tag") return [{ key: "all", label: "", items: list }];
    const map = new Map<string, LinkItem[]>();
    for (const item of list) {
      const extra = meta[item.id];
      const key = tab === "project" ? extra?.projectId || "none" : extra?.tags?.[0] || "none";
      const bucket = map.get(key) || [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      label: tab === "project" ? projectName(key === "none" ? null : key) || t("links.noProject") : key === "none" ? t("links.untagged") : key,
      items,
    }));
  }

  async function addLink() {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) return;
    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    try {
      new URL(normalizedUrl);
    } catch {
      setError(t("links.err.invalidUrl"));
      return;
    }
    setError("");
    setCreating(true);
    const { data, error: insertError } = await supabase
      .from("links")
      .insert({ url: normalizedUrl, description: newTitle.trim() })
      .select()
      .single();
    setCreating(false);
    if (insertError || !data) return;
    const created = data as LinkItem;
    const tags = newTags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    patchMeta(created.id, { tags, projectId: newProjectId || null, favorite: false });
    setLinks((prev) => [created, ...prev]);
    setNewUrl("");
    setNewTitle("");
    setNewTags("");
    setNewProjectId("");
    setShowCreate(false);
    setSelectedId(created.id);
  }

  async function saveEdit() {
    if (!selected) return;
    const description = editTitle.trim();
    const tags = editTags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setLinks((prev) => prev.map((item) => (item.id === selected.id ? { ...item, description } : item)));
    patchMeta(selected.id, { tags, projectId: editProjectId || null });
    setEditing(false);
    await supabase.from("links").update({ description }).eq("id", selected.id);
  }

  async function deleteLink(id: string) {
    setLinks((prev) => prev.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    setMenuId(null);
    await supabase.from("links").delete().eq("id", id);
  }

  async function toggleDone(link: LinkItem) {
    setLinks((prev) => prev.map((item) => (item.id === link.id ? { ...item, is_done: !item.is_done } : item)));
    await supabase.from("links").update({ is_done: !link.is_done }).eq("id", link.id);
  }

  function addTagToSelected() {
    if (!selected) return;
    const value = tagDraft.trim();
    if (!value) return;
    const tags = [...new Set([...(selectedMeta.tags || []), value])];
    patchMeta(selected.id, { tags });
    setTagDraft("");
  }

  function removeTag(tag: string) {
    if (!selected) return;
    patchMeta(selected.id, { tags: (selectedMeta.tags || []).filter((item) => item !== tag) });
  }

  function startEdit() {
    if (!selected) return;
    setEditTitle(selected.description || "");
    setEditTags((selectedMeta.tags || []).join(", "));
    setEditProjectId(selectedMeta.projectId || "");
    setEditing(true);
    setMenuId(null);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "all", label: t("links.tab.all") },
    { id: "favorites", label: t("links.tab.favorites") },
    { id: "project", label: t("links.tab.byProject") },
    { id: "tag", label: t("links.tab.byTag") },
  ];

  const from = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-semibold tracking-tight text-ink">
            <Paperclip size={22} className="text-[#6C5CE7]" />
            {t("links.pageTitle")}
          </h1>
          <p className="mt-1 text-sm text-inkSoft">{t("links.pageSubtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] sm:w-64">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-inkFaint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("links.searchPlaceholder")}
              className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken ps-9 pe-14 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none"
            />
            <span className="absolute top-1/2 -translate-y-1/2 end-3 text-[10px] text-inkFaint">Ctrl K</span>
          </div>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            <button
              aria-label={t("links.listView")}
              onClick={() => setView("list")}
              className={`rounded-md p-1.5 ${view === "list" ? "bg-[#6C5CE7] text-white" : "text-inkFaint hover:text-ink"}`}
            >
              <List size={15} />
            </button>
            <button
              aria-label={t("links.gridView")}
              onClick={() => setView("grid")}
              className={`rounded-md p-1.5 ${view === "grid" ? "bg-[#6C5CE7] text-white" : "text-inkFaint hover:text-ink"}`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} strokeWidth={2.25} />
            {t("links.addLink")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-line mb-4">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`relative shrink-0 px-3 py-2.5 text-sm font-medium ${active ? "text-ink" : "text-inkFaint hover:text-inkSoft"}`}
            >
              {item.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#6C5CE7]" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none"
        >
          <option value="all">{t("links.allProjects")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <button className="inline-flex items-center gap-1.5 rounded-[1.75rem] bg-surfaceSunken px-3 py-2 text-xs text-inkSoft">
          <Filter size={13} />
          {t("links.filters")}
        </button>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
          className="ms-auto rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-xs text-ink outline-none"
        >
          <option value="recent">{t("links.sortBy")}: {t("links.sort.recent")}</option>
          <option value="oldest">{t("links.sortBy")}: {t("links.sort.oldest")}</option>
          <option value="title">{t("links.sortBy")}: {t("links.sort.title")}</option>
        </select>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="min-w-0 flex-1 w-full">
          {loading ? (
            <SkeletonCards count={4} />
          ) : links.length === 0 ? (
            <EmptyState
              icon={Link2}
              title={t("links.emptyTitle")}
              hint={t("links.emptyHint")}
              action={
                <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus size={14} />
                  {t("links.addFirst")}
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Search} title={t("links.noResultsTitle")} hint={t("links.noResultsHint").replace("{q}", query)} />
          ) : (
            <>
              {grouped(paged).map((group) => (
                <div key={group.key} className="mb-3">
                  {group.label && <p className="text-xs font-medium text-inkFaint mb-2 px-1">{group.label}</p>}
                  <ul className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-2"}>
                    {group.items.map((link) => {
                      const extra = meta[link.id] || {};
                      const active = selectedId === link.id;
                      return (
                        <li key={link.id} className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(link.id);
                              setEditing(false);
                            }}
                            className={`w-full text-start rounded-xl border bg-surface p-3.5 transition-colors ${
                              active ? "border-[#6C5CE7]" : "border-line hover:border-lineStrong"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={faviconFor(link.url)}
                                alt=""
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-lg bg-paperDark object-contain p-1.5 shrink-0"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-ink truncate">{linkTitle(link)}</p>
                                  {extra.favorite && <Star size={13} className="text-amber shrink-0" fill="currentColor" />}
                                </div>
                                <p dir="ltr" className="text-xs text-inkFaint truncate text-start mt-0.5">
                                  {link.url}
                                </p>
                                {(extra.tags || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {extra.tags!.map((tag) => (
                                      <span
                                        key={tag}
                                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                                        style={{ backgroundColor: `${tagColor(tag)}22`, color: tagColor(tag) }}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-[11px] text-inkFaint">
                                {extra.projectId && (
                                  <span className="inline-flex items-center gap-1 text-inkSoft">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#6C5CE7]" />
                                    {projectName(extra.projectId)}
                                  </span>
                                )}
                                <span>{formatAdded(link.created_at, locale)}</span>
                                <span className="inline-flex items-center gap-1">
                                  <Bookmark
                                    size={14}
                                    className={link.is_done ? "text-[#6C5CE7]" : ""}
                                    fill={link.is_done ? "currentColor" : "none"}
                                  />
                                </span>
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="absolute end-2.5 top-2.5 h-7 w-7 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId(menuId === link.id ? null : link.id);
                            }}
                            aria-label={t("workspace.more")}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {menuId === link.id && (
                            <div className="absolute end-2.5 top-10 z-20 min-w-[140px] rounded-xl border border-line bg-surface shadow-modal p-1">
                              <button
                                className="w-full text-start rounded-lg px-2.5 py-1.5 text-sm text-inkSoft hover:bg-paperDark"
                                onClick={() => {
                                  setSelectedId(link.id);
                                  setEditTitle(link.description || "");
                                  setEditTags((meta[link.id]?.tags || []).join(", "));
                                  setEditProjectId(meta[link.id]?.projectId || "");
                                  setEditing(true);
                                  setMenuId(null);
                                }}
                              >
                                {t("links.edit")}
                              </button>
                              <button
                                className="w-full text-start rounded-lg px-2.5 py-1.5 text-sm text-inkSoft hover:bg-paperDark"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(link.url);
                                  setMenuId(null);
                                }}
                              >
                                {t("links.copyUrl")}
                              </button>
                              <button
                                className="w-full text-start rounded-lg px-2.5 py-1.5 text-sm text-clay hover:bg-claySoft"
                                onClick={() => deleteLink(link.id)}
                              >
                                {t("links.deleteLink")}
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs text-inkFaint">
                <span>
                  {t("links.showing")
                    .replace("{from}", String(from))
                    .replace("{to}", String(to))
                    .replace("{total}", String(filtered.length))}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(0, 7)
                    .map((n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`h-8 min-w-8 px-2 rounded-lg text-xs ${
                          n === currentPage ? "bg-[#6C5CE7] text-white" : "border border-line text-inkSoft"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className={`w-full xl:w-[320px] shrink-0 ${selected ? "" : "hidden xl:block"}`}>
          {selected ? (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconFor(selected.url)}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl bg-paperDark object-contain p-2"
                />
                <button
                  type="button"
                  onClick={() => patchMeta(selected.id, { favorite: !selectedMeta.favorite })}
                  aria-label={t("links.favorite")}
                  className={selectedMeta.favorite ? "text-amber" : "text-inkFaint hover:text-amber"}
                >
                  <Star size={18} fill={selectedMeta.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              {editing ? (
                <div className="space-y-3">
                  <Textarea value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder={t("links.tagsPlaceholder")} />
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
                  >
                    <option value="">{t("links.noProject")}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditing(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button variant="primary" onClick={() => void saveEdit()}>
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-ink leading-snug">{linkTitle(selected)}</h2>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-[#6C5CE7] break-all"
                    dir="ltr"
                  >
                    {selected.url}
                    <ExternalLink size={12} />
                  </a>
                  <div className="flex items-center gap-2 mt-4">
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6C5CE7] hover:bg-[#5b4bd6] text-white text-sm font-medium py-2"
                    >
                      {t("links.openLink")}
                    </a>
                    <Button onClick={startEdit}>
                      <Pencil size={14} />
                      {t("links.edit")}
                    </Button>
                  </div>
                  <div className="mt-5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("links.description")}</p>
                    <p className="text-sm text-inkSoft leading-relaxed">
                      {selected.description || t("links.noDescription")}
                    </p>
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("links.tags")}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={addTagToSelected}
                        className="rounded-md border border-dashed border-line px-2 py-0.5 text-[11px] text-inkSoft"
                      >
                        + {t("links.addTag")}
                      </button>
                      {(selectedMeta.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
                          style={{ backgroundColor: `${tagColor(tag)}22`, color: tagColor(tag) }}
                        >
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} aria-label={t("common.delete")}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <Input
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTagToSelected())}
                      placeholder={t("links.tagsPlaceholder")}
                      className="mt-2 text-xs py-2"
                    />
                  </div>
                  <div className="mt-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("links.project")}</p>
                    <select
                      value={selectedMeta.projectId || ""}
                      onChange={(e) => patchMeta(selected.id, { projectId: e.target.value || null })}
                      className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
                    >
                      <option value="">{t("links.noProject")}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("links.addedBy")}</p>
                      <div className="flex items-center gap-2">
                        <Avatar name={userName || t("common.you")} src={avatarUrl} size="sm" />
                        <div>
                          <p className="text-sm text-ink">{userName || t("common.you")}</p>
                          <p className="text-[11px] text-inkFaint">{formatStamp(selected.created_at, locale)}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("links.lastUpdated")}</p>
                      <p className="text-xs text-inkSoft">{formatStamp(selected.created_at, locale)}</p>
                    </div>
                    <ItemHistory table="link_activity_log" column="link_id" id={selected.id} currentUserId={currentUserId} />
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleDone(selected)}
                      className="inline-flex items-center gap-1.5 text-xs text-inkSoft hover:text-ink"
                    >
                      <Bookmark size={14} fill={selected.is_done ? "currentColor" : "none"} />
                      {t("links.markDone")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLink(selected.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-clay hover:text-[#E85D4C]"
                    >
                      <Trash2 size={13} />
                      {t("links.deleteLink")}
                    </button>
                  </div>
                </>
              )}
              <button type="button" className="xl:hidden mt-4 text-xs text-inkFaint" onClick={() => setSelectedId(null)}>
                {t("common.close")}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line bg-surface/60 p-6 text-center text-sm text-inkFaint">
              {t("links.selectHint")}
            </div>
          )}
        </aside>
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title={t("links.addLink")} titleAlign="center" maxWidth="max-w-md">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("links.pasteHere")}</span>
              <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} dir="ltr" className="text-end" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("links.titleLabel")}</span>
              <Textarea value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("links.titlePlaceholder")} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("links.tags")}</span>
              <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder={t("links.tagsPlaceholder")} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("links.project")}</span>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
              >
                <option value="">{t("links.noProject")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="text-xs text-clay">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" loading={creating} disabled={!newUrl.trim()} onClick={() => void addLink()}>
                {t("links.saveLink")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
