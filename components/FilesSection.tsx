"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, FolderKanban, ListTodo, Paperclip, Plus, Trash2 } from "lucide-react";
import { supabase, type Project, type Task } from "@/lib/supabase";
import {
  addLibraryFiles,
  deleteLibraryFile,
  libraryPreviewFile,
  listLibraryFiles,
  updateLibraryFile,
  type LibraryFile,
} from "@/lib/libraryFiles";
import { fileKind, previewUrl } from "@/lib/taskAttachments";
import { projectPath } from "@/lib/appRoutes";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";
import { Textarea } from "./ui/Input";
import FilePreview, { formatFileBytes } from "./FilePreview";

type Scope = "free" | "project" | "task";

export default function FilesSection({
  currentUserId,
  lockedProjectId,
  projects: givenProjects,
  tasks: givenTasks,
}: {
  currentUserId: string;
  lockedProjectId?: string;
  projects?: Project[];
  tasks?: Task[];
}) {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [projects, setProjects] = useState<Project[]>(givenProjects || []);
  const [tasks, setTasks] = useState<{ id: string; title: string; project_id: string }[]>(
    (givenTasks || []).map((task) => ({ id: task.id, title: task.title, project_id: task.project_id }))
  );
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<LibraryFile | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<Scope>(lockedProjectId ? "project" : "free");
  const [addProjectId, setAddProjectId] = useState(lockedProjectId || "");
  const [addTaskId, setAddTaskId] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [editDescription, setEditDescription] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editTaskId, setEditTaskId] = useState("");

  const selected = files.find((file) => file.id === selectedId) || null;
  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const taskNames = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);

  async function refresh() {
    setLoading(true);
    const list = await listLibraryFiles(currentUserId, lockedProjectId || null);
    setFiles(list);
    setLoading(false);
    if (selectedId && !list.some((file) => file.id === selectedId)) setSelectedId(list[0]?.id ?? null);
  }

  useEffect(() => {
    void refresh();
  }, [currentUserId, lockedProjectId]);

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
    setEditProjectId(selected.projectId || "");
    setEditTaskId(selected.taskId || "");
  }, [selectedId]);

  const addTasks = tasks.filter((task) => !addProjectId || task.project_id === addProjectId);
  const editTasks = tasks.filter((task) => !editProjectId || task.project_id === editProjectId);

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

  function stamp(iso: string) {
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="fade-in">
      {!lockedProjectId && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("files.title")}</h1>
            <p className="mt-1 text-sm text-inkSoft">{t("files.subtitle")}</p>
          </div>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
            {t("files.add")}
          </Button>
        </div>
      )}
      {lockedProjectId && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
            {t("files.add")}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-inkFaint">{t("common.loading")}</p>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={FileText} title={t("files.empty")} hint={t("files.emptyHint")} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          <ul className="space-y-2">
            {files.map((file) => {
              const active = selectedId === file.id;
              const thumb = fileKind(libraryPreviewFile(file)) === "image" ? previewUrl(libraryPreviewFile(file)) : "";
              return (
                <li key={file.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(file.id)}
                    className={`w-full text-start rounded-xl border bg-surface p-3.5 transition-colors ${
                      active ? "border-[#6C5CE7]" : "border-line hover:border-lineStrong"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-11 w-11 rounded-lg object-cover bg-paperDark" />
                      ) : (
                        <span className="h-11 w-11 rounded-lg bg-paperDark inline-flex items-center justify-center text-inkSoft">
                          <FileText size={18} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink truncate">{file.name}</p>
                        <p className="mt-0.5 text-[11px] text-inkFaint">
                          {formatFileBytes(file.size)}
                          {file.projectId && (
                            <span className="ms-2 inline-flex items-center gap-1">
                              <FolderKanban size={11} />
                              {names.get(file.projectId) || t("files.linkedProject")}
                            </span>
                          )}
                          {file.taskId && (
                            <span className="ms-2 inline-flex items-center gap-1">
                              <ListTodo size={11} />
                              {taskNames.get(file.taskId) || t("files.linkedTask")}
                            </span>
                          )}
                          {!file.projectId && !file.taskId && <span className="ms-2">{t("files.free")}</span>}
                        </p>
                      </div>
                      <Paperclip size={14} className="text-inkFaint shrink-0 mt-1" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <aside className="rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-4">
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => setPreview(selected)}
                  className="w-full rounded-xl border border-line bg-paperDark/50 p-3 text-start hover:border-[#6C5CE7]"
                >
                  <p className="text-[11px] uppercase tracking-wide text-inkFaint mb-1">{t("files.preview")}</p>
                  <p className="text-sm font-medium text-ink truncate">{selected.name}</p>
                  <p className="text-[11px] text-inkFaint mt-0.5">{t("files.openPreview")}</p>
                </button>
                <div className="mt-4 space-y-3">
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
                        className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
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
                      className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
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
                  <p className="text-[11px] text-inkFaint">{t("files.addedOn")}: {stamp(selected.createdAt)}</p>
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
                    onClick={async () => {
                      await deleteLibraryFile(selected);
                      setSelectedId(null);
                      await refresh();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-inkFaint hover:text-clay"
                  >
                    <Trash2 size={13} />
                    {t("common.delete")}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-inkFaint">{t("files.pickOne")}</p>
            )}
          </aside>
        </div>
      )}

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)} title={t("files.add")} maxWidth="max-w-md">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("files.chooseFiles")}</span>
              <input
                type="file"
                multiple
                onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
                className="w-full text-sm text-ink"
              />
              {pendingFiles.length > 0 && (
                <p className="mt-1 text-[11px] text-inkFaint">{pendingFiles.map((file) => file.name).join(", ")}</p>
              )}
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
                  className={`rounded-xl border px-2 py-2 text-xs ${
                    scope === id ? "border-[#6C5CE7] text-ink" : "border-line text-inkSoft"
                  }`}
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
                className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
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
                className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
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

      {preview && <FilePreview file={libraryPreviewFile(preview)} onClose={() => setPreview(null)} />}
    </div>
  );
}
