import { supabase } from "./supabase";
import { patchTaskExtras, type TaskAttachment } from "./taskExtras";

export const TASK_FILES_BUCKET = "task-files";
export const MAX_TASK_FILE_BYTES = 40 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

export async function signedTaskFileUrl(path: string, expiresIn = 60 * 60) {
  const { data } = await supabase.storage.from(TASK_FILES_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl || undefined;
}

type AttachmentRow = {
  id: string;
  task_id: string;
  name: string;
  size: number;
  mime_type: string;
  storage_path: string;
};

async function mapRows(rows: AttachmentRow[]): Promise<TaskAttachment[]> {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      size: row.size,
      type: row.mime_type,
      path: row.storage_path,
      url: await signedTaskFileUrl(row.storage_path),
    }))
  );
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, task_id, name, size, mime_type, storage_path")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return mapRows(data as AttachmentRow[]);
}

export async function listProjectTaskAttachments(projectId: string): Promise<Record<string, TaskAttachment[]>> {
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id, task_id, name, size, mime_type, storage_path")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error || !data) return {};
  const grouped: Record<string, AttachmentRow[]> = {};
  for (const row of data as AttachmentRow[]) {
    if (!grouped[row.task_id]) grouped[row.task_id] = [];
    grouped[row.task_id].push(row);
  }
  const out: Record<string, TaskAttachment[]> = {};
  await Promise.all(
    Object.entries(grouped).map(async ([taskId, rows]) => {
      out[taskId] = await mapRows(rows);
    })
  );
  return out;
}

export async function uploadTaskFiles(
  taskId: string,
  projectId: string,
  userId: string,
  files: File[]
): Promise<{ uploaded: TaskAttachment[]; skipped: number; error?: string }> {
  const uploaded: TaskAttachment[] = [];
  let skipped = 0;
  for (const file of files) {
    if (file.size > MAX_TASK_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    const id = crypto.randomUUID();
    const path = `${projectId}/${taskId}/${id}-${safeName(file.name)}`;
    const { error: storageError } = await supabase.storage.from(TASK_FILES_BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (storageError) {
      return { uploaded, skipped, error: storageError.message };
    }
    const { data, error } = await supabase
      .from("task_attachments")
      .insert({
        id,
        task_id: taskId,
        project_id: projectId,
        user_id: userId,
        name: file.name,
        size: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: path,
      })
      .select("id, task_id, name, size, mime_type, storage_path")
      .single();
    if (error || !data) {
      await supabase.storage.from(TASK_FILES_BUCKET).remove([path]);
      return { uploaded, skipped, error: error?.message || "Could not save attachment" };
    }
    const mapped = (await mapRows([data as AttachmentRow]))[0];
    uploaded.push(mapped);
  }
  if (uploaded.length) {
    void supabase.from("activity_log").insert({
      project_id: projectId,
      task_id: taskId,
      actor_id: userId,
      actor_name: "",
      action: "file_uploaded",
      action_params: { title: uploaded[0].name, count: uploaded.length },
      message: uploaded.length === 1 ? uploaded[0].name : String(uploaded.length),
    });
  }
  return { uploaded, skipped };
}

export async function uploadTaskBlobs(
  taskId: string,
  projectId: string,
  userId: string,
  files: { name: string; type: string; blob: Blob }[]
): Promise<{ uploaded: TaskAttachment[]; error?: string }> {
  const asFiles = files.map((file) => new File([file.blob], file.name, { type: file.type || file.blob.type }));
  const result = await uploadTaskFiles(taskId, projectId, userId, asFiles);
  return { uploaded: result.uploaded, error: result.error };
}

export async function copyTaskAttachments(
  fromTaskId: string,
  toTaskId: string,
  projectId: string,
  userId: string
) {
  const files = await listTaskAttachments(fromTaskId);
  const blobs: { name: string; type: string; blob: Blob }[] = [];
  for (const file of files) {
    const src = previewUrl(file);
    if (!src) continue;
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      blobs.push({ name: file.name, type: file.type, blob: await res.blob() });
    } catch {
      /* skip */
    }
  }
  if (blobs.length === 0) return;
  await uploadTaskBlobs(toTaskId, projectId, userId, blobs);
}

export async function copyRemoteFilesToTask(
  taskId: string,
  projectId: string,
  userId: string,
  files: { name: string; type: string; url?: string; dataUrl?: string }[]
) {
  const blobs: { name: string; type: string; blob: Blob }[] = [];
  for (const file of files) {
    const src = file.url || file.dataUrl;
    if (!src) continue;
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      blobs.push({ name: file.name, type: file.type, blob: await res.blob() });
    } catch {
      /* skip */
    }
  }
  if (blobs.length === 0) return;
  await uploadTaskBlobs(taskId, projectId, userId, blobs);
}

export async function deleteTaskAttachment(file: TaskAttachment) {
  if (file.path) {
    await supabase.storage.from(TASK_FILES_BUCKET).remove([file.path]);
    await supabase.from("task_attachments").delete().eq("id", file.id);
    return;
  }
  // legacy local-only
}

export async function migrateLocalTaskAttachments(
  taskId: string,
  projectId: string,
  userId: string,
  localFiles: TaskAttachment[]
): Promise<TaskAttachment[] | null> {
  const pending = localFiles.filter((file) => file.dataUrl && !file.path && file.dataUrl.startsWith("data:"));
  if (pending.length === 0) return null;
  const blobs: { name: string; type: string; blob: Blob }[] = [];
  for (const file of pending) {
    try {
      const res = await fetch(file.dataUrl as string);
      blobs.push({ name: file.name, type: file.type, blob: await res.blob() });
    } catch {
      /* skip broken local file */
    }
  }
  if (blobs.length === 0) return null;
  const { uploaded, error } = await uploadTaskBlobs(taskId, projectId, userId, blobs);
  if (error || uploaded.length === 0) return null;
  const remaining = localFiles.filter((file) => !pending.some((item) => item.id === file.id));
  patchTaskExtras(taskId, { attachments: remaining });
  return listTaskAttachments(taskId);
}

export function fileKind(file: TaskAttachment): "image" | "video" | "audio" | "pdf" | "text" | "other" {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) return "image";
  if (type.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(name)) return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name)) return "audio";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("text/") || /\.(txt|md|csv|json|log)$/i.test(name)) return "text";
  return "other";
}

export function previewUrl(file: TaskAttachment) {
  return file.url || file.dataUrl || "";
}
