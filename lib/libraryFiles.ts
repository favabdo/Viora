import { supabase } from "./supabase";
import {
  copyRemoteFilesToTask,
  deleteTaskAttachment,
  listProjectTaskAttachments,
  MAX_TASK_FILE_BYTES,
  signedTaskFileUrl,
  TASK_FILES_BUCKET,
  uploadTaskFiles,
} from "./taskAttachments";
import { patchTaskExtras, readTaskExtras, type TaskAttachment } from "./taskExtras";

export const LIBRARY_FILES_BUCKET = "library-files";
const LOCAL_KEY = "viora-library-files";
const META_KEY = "viora-file-meta";

export type LibraryFile = {
  id: string;
  userId: string;
  name: string;
  size: number;
  type: string;
  description: string;
  projectId: string | null;
  taskId: string | null;
  storagePath?: string;
  url?: string;
  dataUrl?: string;
  createdAt: string;
  source: "library" | "task";
};

type FileMeta = { description?: string; favorite?: boolean; trash?: boolean };

export const FOLDER_MIME = "application/x-viora-folder";
export const STORAGE_CAP_BYTES = 30 * 1024 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

function loadLocal(): LibraryFile[] {
  return loadJson<LibraryFile[]>(LOCAL_KEY, []);
}

function saveLocal(items: LibraryFile[]) {
  saveJson(LOCAL_KEY, items);
}

function loadMeta(): Record<string, FileMeta> {
  return loadJson<Record<string, FileMeta>>(META_KEY, {});
}

function saveMeta(all: Record<string, FileMeta>) {
  saveJson(META_KEY, all);
}

function tableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205" || /library_files/i.test(error.message || "");
}

async function signedLibraryUrl(path: string) {
  const { data } = await supabase.storage.from(LIBRARY_FILES_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || undefined;
}

function asAttachment(file: LibraryFile): TaskAttachment {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.type,
    path: file.storagePath,
    url: file.url,
    dataUrl: file.dataUrl,
  };
}

export function libraryPreviewFile(file: LibraryFile): TaskAttachment {
  return asAttachment(file);
}

export function isFolder(file: LibraryFile) {
  return file.type === FOLDER_MIME;
}

export function getFileMeta(id: string): FileMeta {
  return loadMeta()[id] || {};
}

export function patchFileMeta(id: string, patch: FileMeta) {
  const all = loadMeta();
  all[id] = { ...all[id], ...patch };
  saveMeta(all);
}

export function createFolder(userId: string, name: string, projectId?: string | null): LibraryFile {
  const item: LibraryFile = {
    id: crypto.randomUUID(),
    userId,
    name: name.trim() || "Untitled folder",
    size: 0,
    type: FOLDER_MIME,
    description: "",
    projectId: projectId || null,
    taskId: null,
    createdAt: new Date().toISOString(),
    source: "library",
  };
  saveLocal([item, ...loadLocal()]);
  return item;
}

async function projectIdsForUser(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    supabase.from("projects").select("id").eq("user_id", userId),
    supabase.from("project_members").select("project_id").eq("user_id", userId).eq("status", "accepted"),
  ]);
  const ids = new Set<string>();
  for (const row of owned.data || []) ids.add(row.id);
  for (const row of member.data || []) ids.add(row.project_id);
  return Array.from(ids);
}

export async function listLibraryFiles(userId: string, projectId?: string | null): Promise<LibraryFile[]> {
  const meta = loadMeta();
  const local = loadLocal().filter((item) => item.userId === userId);
  const items: LibraryFile[] = [];
  const seen = new Set<string>();

  const push = (file: LibraryFile) => {
    if (seen.has(file.id)) return;
    if (file.storagePath && seen.has(file.storagePath)) return;
    const taskKey = file.taskId ? `task:${file.taskId}:${file.name}` : "";
    if (taskKey && seen.has(taskKey)) return;
    if (projectId && file.projectId !== projectId) return;
    seen.add(file.id);
    if (file.storagePath) seen.add(file.storagePath);
    if (taskKey) seen.add(taskKey);
    const extra = meta[file.id];
    items.push({
      ...file,
      description: extra?.description != null && extra.description !== "" ? extra.description : file.description,
    });
  };

  const remote = await supabase
    .from("library_files")
    .select("id, user_id, project_id, task_id, name, size, mime_type, storage_path, description, created_at")
    .order("created_at", { ascending: false });

  if (!remote.error && remote.data) {
    for (const row of remote.data) {
      if (row.user_id !== userId && !row.project_id) continue;
      push({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        size: row.size,
        type: row.mime_type,
        description: row.description || "",
        projectId: row.project_id,
        taskId: row.task_id,
        storagePath: row.storage_path,
        url: await signedLibraryUrl(row.storage_path),
        createdAt: row.created_at,
        source: "library",
      });
    }
  }

  const projectIds = projectId ? [projectId] : await projectIdsForUser(userId);
  for (const pid of projectIds) {
    const grouped = await listProjectTaskAttachments(pid);
    for (const [taskId, files] of Object.entries(grouped)) {
      for (const file of files) {
        push({
          id: file.id,
          userId,
          name: file.name,
          size: file.size,
          type: file.type,
          description: meta[file.id]?.description || "",
          projectId: pid,
          taskId,
          storagePath: file.path,
          url: file.url || (file.path ? await signedTaskFileUrl(file.path) : undefined),
          dataUrl: file.dataUrl,
          createdAt: new Date().toISOString(),
          source: "task",
        });
      }
    }
  }

  for (const item of local) push(item);

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}

async function persistRemote(row: {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  name: string;
  size: number;
  mimeType: string;
  storagePath: string;
  description: string;
}): Promise<boolean> {
  const { error } = await supabase.from("library_files").insert({
    id: row.id,
    user_id: row.userId,
    project_id: row.projectId,
    task_id: row.taskId,
    name: row.name,
    size: row.size,
    mime_type: row.mimeType,
    storage_path: row.storagePath,
    description: row.description,
  });
  return !error && !tableMissing(error);
}

export async function addLibraryFiles(input: {
  userId: string;
  files: File[];
  description?: string;
  projectId?: string | null;
  taskId?: string | null;
}): Promise<{ added: LibraryFile[]; skipped: number; error?: string }> {
  const added: LibraryFile[] = [];
  let skipped = 0;
  const description = (input.description || "").trim();
  const projectId = input.projectId || null;
  const taskId = input.taskId || null;

  if (taskId && projectId) {
    const result = await uploadTaskFiles(taskId, projectId, input.userId, input.files);
    const now = new Date().toISOString();
    const extras = readTaskExtras(taskId);
    if (result.uploaded.length) {
      patchTaskExtras(taskId, { attachments: [...(extras.attachments || []), ...result.uploaded] });
    }
    for (const file of result.uploaded) {
      const item: LibraryFile = {
        id: file.id,
        userId: input.userId,
        name: file.name,
        size: file.size,
        type: file.type,
        description,
        projectId,
        taskId,
        storagePath: file.path,
        url: file.url,
        createdAt: now,
        source: "task",
      };
      if (description) {
        const meta = loadMeta();
        meta[file.id] = { description };
        saveMeta(meta);
      }
      added.push(item);
    }
    return { added, skipped: result.skipped + skipped, error: result.error };
  }

  for (const file of input.files) {
    if (file.size > MAX_TASK_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    const id = crypto.randomUUID();
    const path = `${input.userId}/${id}-${safeName(file.name)}`;
    const { error: storageError } = await supabase.storage.from(LIBRARY_FILES_BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    let storagePath = path;
    let url: string | undefined;
    let dataUrl: string | undefined;

    if (storageError) {
      dataUrl = await fileToDataUrl(file);
      storagePath = "";
    } else {
      url = await signedLibraryUrl(path);
    }

    const item: LibraryFile = {
      id,
      userId: input.userId,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      description,
      projectId,
      taskId,
      storagePath: storagePath || undefined,
      url,
      dataUrl,
      createdAt: new Date().toISOString(),
      source: "library",
    };

    const saved = storagePath
      ? await persistRemote({
          id,
          userId: input.userId,
          projectId,
          taskId,
          name: file.name,
          size: file.size,
          mimeType: item.type,
          storagePath,
          description,
        })
      : false;

    if (!saved) {
      saveLocal([item, ...loadLocal()]);
    }
    added.push(item);
  }

  return { added, skipped };
}

export async function updateLibraryFile(
  file: LibraryFile,
  patch: { description?: string; projectId?: string | null; taskId?: string | null }
): Promise<LibraryFile> {
  const next: LibraryFile = {
    ...file,
    description: patch.description != null ? patch.description : file.description,
    projectId: patch.projectId !== undefined ? patch.projectId : file.projectId,
    taskId: patch.taskId !== undefined ? patch.taskId : file.taskId,
  };

  if (patch.description != null) {
    const meta = loadMeta();
    meta[file.id] = { ...meta[file.id], description: patch.description };
    saveMeta(meta);
  }

  if (file.source === "library") {
    const { error } = await supabase
      .from("library_files")
      .update({
        description: next.description,
        project_id: next.projectId,
        task_id: next.taskId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", file.id);
    if (error || tableMissing(error)) {
      saveLocal(loadLocal().map((item) => (item.id === file.id ? next : item)));
    }
  }

  if (next.taskId && next.projectId && next.taskId !== file.taskId) {
    await copyRemoteFilesToTask(next.taskId, next.projectId, file.userId, [asAttachment(next)]);
  }

  return next;
}

export async function deleteLibraryFile(file: LibraryFile) {
  if (file.source === "task") {
    await deleteTaskAttachment(asAttachment(file));
  } else {
    if (file.storagePath) {
      await supabase.storage.from(LIBRARY_FILES_BUCKET).remove([file.storagePath]);
      const { error } = await supabase.from("library_files").delete().eq("id", file.id);
      if (error || tableMissing(error)) {
        saveLocal(loadLocal().filter((item) => item.id !== file.id));
      }
    } else {
      saveLocal(loadLocal().filter((item) => item.id !== file.id));
    }
  }
  const meta = loadMeta();
  delete meta[file.id];
  saveMeta(meta);
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function filesToAttachments(files: File[]): Promise<{ attachments: TaskAttachment[]; skipped: number }> {
  const attachments: TaskAttachment[] = [];
  let skipped = 0;
  for (const file of files) {
    if (file.size > MAX_TASK_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    attachments.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      dataUrl: await fileToDataUrl(file),
    });
  }
  return { attachments, skipped };
}

export { MAX_TASK_FILE_BYTES, TASK_FILES_BUCKET };
