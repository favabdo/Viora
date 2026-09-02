"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Music,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { supabase, type Project, type Task } from "@/lib/supabase";
import {
  addLibraryFiles,
  createFolder,
  getFileMeta,
  isFolder,
  libraryPreviewFile,
  listLibraryFiles,
  patchFileMeta,
  STORAGE_CAP_BYTES,
  updateLibraryFile,
  type LibraryFile,
} from "@/lib/libraryFiles";
import { fileKind, previewUrl } from "@/lib/taskAttachments";
import { projectPath } from "@/lib/appRoutes";
import { timeAgo } from "@/lib/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";
import { Textarea } from "./ui/Input";
import FilePreview, { formatFileBytes } from "./FilePreview";
import Avatar from "./ui/Avatar";

type Scope = "free" | "project" | "task";
type QuickFilter = "all" | "recent" | "shared" | "favorites" | "trash";
type ViewMode = "list" | "grid";
type KindFilter = "all" | "folder" | "image" | "doc" | "video" | "audio" | "other";

const PROJECT_COLORS = ["#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6"];
const selectClass =
  "h-9 rounded-xl border border-line bg-surface px-3 text-xs text-ink outline-none";

function projectColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function kindOf(file: LibraryFile): KindFilter {
  if (isFolder(file)) return "folder";
  const kind = fileKind(libraryPreviewFile(file));
  if (kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  if (kind === "pdf" || kind === "text") return "doc";
  const name = file.name.toLowerCase();
  if (/\.(docx?|xlsx?|pptx?|zip|rar)$/i.test(name)) return "doc";
  return "other";
}

function FileGlyph({ file }: { file: LibraryFile }) {
  if (isFolder(file)) return <Folder size={16} className="text-[#F59E0B]" />;
  const kind = fileKind(libraryPreviewFile(file));
  const name = file.name.toLowerCase();
  if (kind === "image") return <ImageIcon size={16} className="text-[#38BDF8]" />;
  if (kind === "video") return <Film size={16} className="text-[#A78BFA]" />;
  if (kind === "audio") return <Music size={16} className="text-[#F472B6]" />;
  if (name.endsWith(".pdf")) return <FileText size={16} className="text-[#EF4444]" />;
  if (/\.xlsx?$/.test(name)) return <FileSpreadsheet size={16} className="text-[#22C55E]" />;
  return <FileText size={16} className="text-inkSoft" />;
}

export default function FilesSection({
  currentUserId,
  lockedProjectId,
  projects: givenProjects,
  tasks: givenTasks,
  userName,
  avatarUrl,
}: {
  currentUserId: string;
  lockedProjectId?: string;
  projects?: Project[];
  tasks?: Task[];
  userName?: string;
  avatarUrl?: string | null;
}) {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [projects, setProjects] = useState<Project[]>(givenProjects || []);
  const [tasks, setTasks] = useState<{ id: string; title: string; project_id: string }[]>(
    (givenTasks || []).map((task) => ({ id: task.id, title: task.title, project_id: task.project_id }))
  );
  const [profile, setProfile] = useState({ name: userName || "", avatar: avatarUrl || "" });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<LibraryFile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<Scope>(lockedProjectId ? "project" : "free");
  const [addProjectId, setAddProjectId] = useState(lockedProjectId || "");
  const [addTaskId, setAddTaskId] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editTaskId, setEditTaskId] = useState("");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [projectFilter, setProjectFilter] = useState(lockedProjectId || "");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const [metaTick, setMetaTick] = useState(0);

  const selected = files.find((file) => file.id === selectedId) || null;
  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const locale = lang === "ar" ? "ar" : "en";

  async function refresh() {
    setLoading(true);
    const list = await listLibraryFiles(currentUserId, lockedProjectId || null);
    setFiles(list);
    setLoading(false);
    setMetaTick((n) => n + 1);
    if (selectedId && !list.some((file) => file.id === selectedId)) setSelectedId(null);
  }

  useEffect(() => {
    void refresh();
  }, [currentUserId, lockedProjectId]);

  useEffect(() => {
    if (userName) setProfile({ name: userName, avatar: avatarUrl || "" });
    else {
      supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", currentUserId)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile({
              name: (data.full_name && data.full_name.trim()) || data.username || "",
              avatar: data.avatar_url || "",
            });
          }
        });
    }
  }, [currentUserId, userName, avatarUrl]);

  useEffect(() => {
    if (givenProjects) {
      setProjects(givenProjects);
      return;
    }
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects((data as Project[]) || []));
  }, [givenProjects]);

  useEffect(() => {
    if (givenTasks) {
      setTasks(givenTasks.map((task) => ({ id: task.id, title: task.title, project_id: task.project_id })));
      return;
    }
    const projectId = addOpen ? addProjectId : editProjectId || lockedProjectId;
    if (!projectId) {
      setTasks([]);
      return;
    }
    supabase
      .from("tasks")
      .select("id, title, project_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .then(({ data }) =>
        setTasks((data || []).map((row) => ({ id: row.id, title: row.title, project_id: row.project_id })))
      );
  }, [givenTasks, addOpen, addProjectId, editProjectId, lockedProjectId]);

  useEffect(() => {
    if (!selected) return;
    setEditDescription(selected.description);
    setEditProjectId(selected.projectId || lockedProjectId || "");
    setEditTaskId(selected.taskId || "");
  }, [selectedId]);

  const addTasks = tasks.filter((task) => !addProjectId || task.project_id === addProjectId);
  const editTasks = tasks.filter((task) => !editProjectId || task.project_id === editProjectId);

  const decorated = useMemo(() => {
    return files.map((file) => ({ file, meta: getFileMeta(file.id) }));
  }, [files, metaTick]);

  const filtered = useMemo(() => {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return decorated.filter(({ file, meta }) => {
      const trashed = Boolean(meta.trash);
      if (quick === "trash") {
        if (!trashed) return false;
      } else if (trashed) return false;
      if (quick === "favorites" && !meta.favorite) return false;
      if (quick === "recent" && new Date(file.createdAt).getTime() < week) return false;
      if (quick === "shared" && !file.projectId) return false;
      if (kindFilter !== "all" && kindOf(file) !== kindFilter) return false;
      if (projectFilter && file.projectId !== projectFilter) return false;
      if (query.trim() && !file.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [decorated, quick, kindFilter, projectFilter, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, pages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, kindFilter, projectFilter, quick, pageSize]);

  const visible = decorated.filter(({ meta }) => !meta.trash);
  const totalSize = visible.reduce((sum, row) => sum + row.file.size, 0);
  const folderCount = visible.filter(({ file }) => isFolder(file)).length;
  const sharedCount = visible.filter(({ file }) => Boolean(file.projectId)).length;
  const buckets = {
    image: visible.filter(({ file }) => kindOf(file) === "image").reduce((s, r) => s + r.file.size, 0),
    doc: visible.filter(({ file }) => kindOf(file) === "doc").reduce((s, r) => s + r.file.size, 0),
    video: visible.filter(({ file }) => kindOf(file) === "video").reduce((s, r) => s + r.file.size, 0),
  };
  const others = Math.max(0, totalSize - buckets.image - buckets.doc - buckets.video);
  const usedPct = Math.min(100, Math.round((totalSize / STORAGE_CAP_BYTES) * 100));

  async function submitAdd() {
    if (pendingFiles.length === 0) return;
    if (scope === "project" && !addProjectId) return;
    if (scope === "task" && (!addProjectId || !addTaskId)) return;
    setSaving(true);
    await addLibraryFiles({
      userId: currentUserId,
      files: pendingFiles,
      description: addDescription,
      projectId: scope === "free" ? null : addProjectId,
      taskId: scope === "task" ? addTaskId : null,
    });
    setSaving(false);
    setAddOpen(false);
    setPendingFiles([]);
    setAddDescription("");
    setAddTaskId("");
    setScope(lockedProjectId ? "project" : "free");
    await refresh();
  }

  async function saveDetails() {
    if (!selected) return;
    setSaving(true);
    await updateLibraryFile(selected, {
      description: editDescription,
      projectId: lockedProjectId || editProjectId || null,
      taskId: editTaskId || null,
    });
    setSaving(false);
    await refresh();
  }

  function modifiedLabel(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
    if (d.toDateString() === today.toDateString()) return `${t("files.today")}, ${time}`;
    return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  }

  function toggleMeta(id: string, patch: { favorite?: boolean; trash?: boolean }) {
    patchFileMeta(id, patch);
    setMetaTick((n) => n + 1);
    setMenuId(null);
  }

  const donut = [
    { key: "files.images", value: buckets.image, color: "#38BDF8" },
    { key: "files.documents", value: buckets.doc, color: "#8B5CF6" },
    { key: "files.videos", value: buckets.video, color: "#F59E0B" },
    { key: "files.others", value: others, color: "#64748B" },
  ];
  const donutTotal = donut.reduce((s, item) => s + item.value, 0) || 1;
  let donutOffset = 0;

  function ProjectBadge({ id }: { id: string | null }) {
    const label = id ? names.get(id) || t("files.linkedProject") : t("files.personal");
    const color = id ? projectColor(id) : "#22C55E";
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${color}22`, color }}>
        {label}
      </span>
    );
  }

  const uploader = profile.name || t("files.you");

  return (
    <div className="fade-in">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {!lockedProjectId && (
            <>
              <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("files.title")}</h1>
              <p className="mt-1 text-sm text-inkSoft">{t("files.subtitle")}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddOpen(true)}>
            <Upload size={15} />
            {t("files.upload")}
          </Button>
          <Button variant="primary" onClick={() => setFolderOpen(true)}>
            <Plus size={15} />
            {t("files.newFolder")}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { title: t("files.totalFiles"), value: String(visible.length), Icon: FileText, color: "#8B5CF6" },
          { title: t("files.totalSize"), value: formatFileBytes(totalSize), Icon: Cloud, color: "#38BDF8" },
          { title: t("files.folders"), value: String(folderCount), Icon: Folder, color: "#F59E0B" },
          { title: t("files.sharedFiles"), value: String(sharedCount), Icon: Users, color: "#22C55E" },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-line bg-surface p-3.5 viora-lift">
            <div className="flex items-start justify-between">
              <span className="h-8 w-8 rounded-full inline-flex items-center justify-center" style={{ backgroundColor: `${card.color}22`, color: card.color }}>
                <card.Icon size={15} />
              </span>
            </div>
            <p className="mt-3 text-[11px] text-inkFaint">{card.title}</p>
            <p className="mt-0.5 text-xl font-semibold text-ink tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <div className="min-w-0 rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="flex flex-col gap-2 p-3 border-b border-line lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2 flex-1">
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as KindFilter)} className={selectClass}>
                <option value="all">{t("files.allTypes")}</option>
                <option value="folder">{t("files.type.folder")}</option>
                <option value="image">{t("files.type.image")}</option>
                <option value="doc">{t("files.type.doc")}</option>
                <option value="video">{t("files.type.video")}</option>
                <option value="audio">{t("files.type.audio")}</option>
              </select>
              {!lockedProjectId && (
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectClass}>
                  <option value="">{t("files.allProjects")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="relative flex-1 min-w-[180px]">
                <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("files.search")}
                  className="h-9 w-full rounded-xl border border-line bg-surfaceSunken ps-8 pe-3 text-xs text-ink outline-none"
                />
              </label>
              <div className="inline-flex rounded-xl border border-line p-0.5">
                <button
                  type="button"
                  aria-label={t("files.viewList")}
                  onClick={() => setView("list")}
                  className={`h-8 w-8 inline-flex items-center justify-center rounded-lg ${view === "list" ? "bg-[#7C3AED] text-white" : "text-inkSoft"}`}
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  aria-label={t("files.viewGrid")}
                  onClick={() => setView("grid")}
                  className={`h-8 w-8 inline-flex items-center justify-center rounded-lg ${view === "grid" ? "bg-[#7C3AED] text-white" : "text-inkSoft"}`}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="px-4 py-10 text-sm text-inkFaint">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={FileText} title={t("files.empty")} hint={t("files.emptyHint")} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3">
              {paged.map(({ file, meta }) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedId(file.id)}
                  className={`rounded-xl border p-3 text-start ${selectedId === file.id ? "border-[#7C3AED]" : "border-line hover:border-lineStrong"}`}
                >
                  <span className="h-10 w-10 rounded-xl bg-paperDark inline-flex items-center justify-center">
                    <FileGlyph file={file} />
                  </span>
                  <p className="mt-2 text-sm font-medium text-ink truncate">{file.name}</p>
                  <p className="mt-1 text-[11px] text-inkFaint">{isFolder(file) ? t("files.type.folder") : formatFileBytes(file.size)}</p>
                  {meta.favorite && <Star size={12} className="mt-1 text-amber" fill="currentColor" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-inkFaint border-b border-line">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="accent-[#7C3AED]"
                        checked={paged.length > 0 && paged.every(({ file }) => checked.has(file.id))}
                        onChange={(e) => {
                          const next = new Set(checked);
                          for (const row of paged) {
                            if (e.target.checked) next.add(row.file.id);
                            else next.delete(row.file.id);
                          }
                          setChecked(next);
                        }}
                      />
                    </th>
                    <th className="text-start px-2 py-2.5 font-medium">{t("files.col.name")}</th>
                    <th className="text-start px-2 py-2.5 font-medium">{t("files.col.project")}</th>
                    <th className="text-start px-2 py-2.5 font-medium">{t("files.col.uploader")}</th>
                    <th className="text-start px-2 py-2.5 font-medium">{t("files.col.size")}</th>
                    <th className="text-start px-2 py-2.5 font-medium">{t("files.col.modified")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {paged.map(({ file, meta }) => (
                    <tr
                      key={file.id}
                      onClick={() => setSelectedId(file.id)}
                      className={`border-b border-line last:border-b-0 cursor-pointer ${
                        selectedId === file.id ? "bg-[#7C3AED]/10" : "hover:bg-paperDark/50"
                      }`}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="accent-[#7C3AED]"
                          checked={checked.has(file.id)}
                          onChange={(e) => {
                            const next = new Set(checked);
                            if (e.target.checked) next.add(file.id);
                            else next.delete(file.id);
                            setChecked(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="h-8 w-8 rounded-lg bg-paperDark inline-flex items-center justify-center shrink-0">
                            <FileGlyph file={file} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-ink truncate">{file.name}</span>
                            {meta.favorite && <Star size={11} className="text-amber" fill="currentColor" />}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <ProjectBadge id={file.projectId} />
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={uploader} src={profile.avatar || null} size="xs" />
                          <span className="text-inkSoft">{uploader}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-inkSoft tabular-nums">{isFolder(file) ? "—" : formatFileBytes(file.size)}</td>
                      <td className="px-2 py-2.5 text-inkFaint whitespace-nowrap">{modifiedLabel(file.createdAt)}</td>
                      <td className="px-2 py-2.5 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={t("files.more")}
                          onClick={() => setMenuId(menuId === file.id ? null : file.id)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {menuId === file.id && (
                          <div className="absolute end-2 top-10 z-20 min-w-[140px] rounded-xl border border-line bg-surface shadow-modal p-1">
                            {!isFolder(file) && (
                              <button
                                className="w-full text-start rounded-lg px-2.5 py-1.5 text-sm text-inkSoft hover:bg-paperDark"
                                onClick={() => {
                                  setPreview(file);
                                  setMenuId(null);
                                }}
                              >
                                {t("files.preview")}
                              </button>
                            )}
                            <button
                              className="w-full text-start rounded-lg px-2.5 py-1.5 text-sm text-inkSoft hover:bg-paperDark"
                              onClick={() => toggleMeta(file.id, { favorite: !meta.favorite })}
                            >
                              {t("files.favorite")}
                            </button>
                            <button
                              className="w-full text-start rounded-lg px-2.5 py-1.5 text-sm text-inkSoft hover:bg-paperDark"
                              onClick={() => toggleMeta(file.id, { trash: !meta.trash })}
                            >
                              {meta.trash ? t("files.restore") : t("common.delete")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between px-3 py-3 border-t border-line text-xs text-inkFaint">
              <p>
                {t("files.showing")
                  .replace("{from}", String((pageSafe - 1) * pageSize + 1))
                  .replace("{to}", String(Math.min(pageSafe * pageSize, filtered.length)))
                  .replace("{total}", String(filtered.length))}
              </p>
              <div className="flex items-center gap-1">
                {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 7).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`h-7 min-w-7 px-1 rounded-lg ${n === pageSafe ? "bg-[#7C3AED] text-white" : "hover:bg-paperDark text-inkSoft"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className={selectClass}>
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {t("files.perPage").replace("{n}", String(n))}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4">
          {selected ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-ink">{t("files.details")}</p>
                <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-inkFaint hover:text-ink">
                  {t("common.close")}
                </button>
              </div>
              {!isFolder(selected) && (
                <button
                  type="button"
                  onClick={() => setPreview(selected)}
                  className="w-full rounded-xl border border-line bg-paperDark/50 p-3 text-start hover:border-[#7C3AED] mb-3"
                >
                  <p className="text-[11px] uppercase tracking-wide text-inkFaint mb-1">{t("files.preview")}</p>
                  <p className="text-sm font-medium text-ink truncate">{selected.name}</p>
                </button>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("files.description")}</p>
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                </div>
                {!lockedProjectId && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("files.project")}</p>
                    <select
                      value={editProjectId}
                      onChange={(e) => {
                        setEditProjectId(e.target.value);
                        setEditTaskId("");
                      }}
                      className="w-full rounded-xl border-0 bg-surfaceSunken px-3 py-2.5 text-sm text-ink outline-none"
                    >
                      <option value="">{t("files.noProject")}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-inkFaint mb-1.5">{t("files.task")}</p>
                  <select
                    value={editTaskId}
                    onChange={(e) => setEditTaskId(e.target.value)}
                    className="w-full rounded-xl border-0 bg-surfaceSunken px-3 py-2.5 text-sm text-ink outline-none"
                    disabled={!editProjectId && !lockedProjectId}
                  >
                    <option value="">{t("files.noTask")}</option>
                    {editTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-inkFaint">{t("files.addedOn")}: {modifiedLabel(selected.createdAt)}</p>
                <p className="text-[11px] text-inkFaint">{t("files.type")}: {selected.type || t("files.unknownType")}</p>
                <div className="flex gap-2">
                  <Button variant="primary" loading={saving} onClick={() => void saveDetails()}>
                    {t("common.save")}
                  </Button>
                  {selected.projectId && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(
                          selected.taskId
                            ? `${projectPath(selected.projectId!, "board")}?task=${selected.taskId}`
                            : projectPath(selected.projectId!, "files")
                        )
                      }
                    >
                      {t("files.openPlace")}
                    </Button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleMeta(selected.id, { trash: true })}
                  className="inline-flex items-center gap-1.5 text-xs text-inkFaint hover:text-clay"
                >
                  <Trash2 size={13} />
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-semibold text-ink mb-3">{t("files.storage")}</p>
                <div className="relative mx-auto h-36 w-36">
                  <svg viewBox="0 0 36 36" className="-rotate-90 h-full w-full">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgb(var(--color-line))" strokeWidth="4" />
                    {donut.map((slice) => {
                      const len = (slice.value / donutTotal) * 88;
                      const dash = `${len} ${88 - len}`;
                      const el = (
                        <circle
                          key={slice.key}
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke={slice.color}
                          strokeWidth="4"
                          strokeDasharray={dash}
                          strokeDashoffset={-donutOffset}
                        />
                      );
                      donutOffset += len;
                      return el;
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-sm font-semibold text-ink">{formatFileBytes(totalSize)}</p>
                    <p className="text-[10px] text-inkFaint">{t("files.totalUsed")}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-[11px]">
                  {donut.map((slice) => (
                    <li key={slice.key} className="flex items-center justify-between text-inkSoft">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                        {t(slice.key)}
                      </span>
                      <span className="tabular-nums">{formatFileBytes(slice.value)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 h-1.5 rounded-full bg-paperDark overflow-hidden">
                  <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${usedPct}%` }} />
                </div>
                <p className="mt-1.5 text-[11px] text-inkFaint">
                  {t("files.usedOf").replace("{pct}", String(usedPct)).replace("{cap}", "30 GB")}
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-3">
                <p className="px-1 pb-2 text-sm font-semibold text-ink">{t("files.quick")}</p>
                {(["recent", "shared", "favorites", "trash"] as QuickFilter[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setQuick(quick === id ? "all" : id)}
                    className={`w-full flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm ${
                      quick === id ? "bg-[#7C3AED]/15 text-ink" : "text-inkSoft hover:bg-paperDark"
                    }`}
                  >
                    {id === "favorites" ? <Star size={14} /> : id === "trash" ? <Trash2 size={14} /> : <FileText size={14} />}
                    {t(id === "recent" ? "files.recent" : id === "shared" ? "files.sharedWithMe" : id === "favorites" ? "files.favorites" : "files.trash")}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-semibold text-ink mb-3">{t("files.activity")}</p>
                <ul className="space-y-3">
                  {visible.slice(0, 5).map(({ file }) => (
                    <li key={file.id} className="flex gap-2.5">
                      <Avatar name={uploader} src={profile.avatar || null} size="xs" />
                      <div className="min-w-0">
                        <p className="text-xs text-ink leading-snug">
                          {uploader} {t("files.uploaded")} <span className="font-medium">{file.name}</span>
                        </p>
                        <p className="text-[11px] text-inkFaint">{timeAgo(file.createdAt, t)}</p>
                      </div>
                    </li>
                  ))}
                  {visible.length === 0 && <p className="text-xs text-inkFaint">{t("files.empty")}</p>}
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)} title={t("files.upload")} maxWidth="max-w-md">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("files.chooseFiles")}</span>
              <input type="file" multiple onChange={(e) => setPendingFiles(Array.from(e.target.files || []))} className="w-full text-sm text-ink" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("files.description")}</span>
              <Textarea value={addDescription} onChange={(e) => setAddDescription(e.target.value)} rows={3} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["free", "project", "task"] as Scope[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setScope(id);
                    if (id === "free") {
                      setAddProjectId(lockedProjectId || "");
                      setAddTaskId("");
                    }
                    if (id === "project") setAddTaskId("");
                    if (lockedProjectId) setAddProjectId(lockedProjectId);
                  }}
                  className={`rounded-xl border px-2 py-2 text-xs ${scope === id ? "border-[#6C5CE7] text-ink" : "border-line text-inkSoft"}`}
                >
                  {t(`files.scope.${id}`)}
                </button>
              ))}
            </div>
            {scope !== "free" && !lockedProjectId && (
              <select
                value={addProjectId}
                onChange={(e) => {
                  setAddProjectId(e.target.value);
                  setAddTaskId("");
                }}
                className="w-full rounded-xl border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
              >
                <option value="">{t("files.pickProject")}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
            {scope === "task" && (
              <select
                value={addTaskId}
                onChange={(e) => setAddTaskId(e.target.value)}
                className="w-full rounded-xl border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
              >
                <option value="">{t("files.pickTask")}</option>
                {addTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                loading={saving}
                disabled={
                  pendingFiles.length === 0 ||
                  (scope === "project" && !addProjectId) ||
                  (scope === "task" && (!addProjectId || !addTaskId))
                }
                onClick={() => void submitAdd()}
              >
                {t("files.upload")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {folderOpen && (
        <Modal onClose={() => setFolderOpen(false)} title={t("files.newFolder")} maxWidth="max-w-sm">
          <div className="space-y-3">
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={t("files.folderPlaceholder")}
              className="w-full rounded-xl border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFolderOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                disabled={!folderName.trim()}
                onClick={() => {
                  createFolder(currentUserId, folderName, lockedProjectId || null);
                  setFolderName("");
                  setFolderOpen(false);
                  void refresh();
                }}
              >
                {t("files.create")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {preview && <FilePreview file={libraryPreviewFile(preview)} onClose={() => setPreview(null)} />}
    </div>
  );
}
