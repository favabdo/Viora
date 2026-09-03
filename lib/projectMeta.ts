"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const META_KEY = "viora-project-meta";
export const PROJECT_IMAGES_BUCKET = "project-images";

export const PROJECT_COLORS = [
  "#6C5CE7",
  "#3B82F6",
  "#14B8A6",
  "#F59E0B",
  "#EC4899",
  "#A855F7",
  "#EAB308",
  "#6B7280",
];

export type ProjectVisibility = "private" | "public";
export type ProjectDefaultView = "board" | "list" | "calendar" | "timeline";
export type TaskCompletionAction = "move_done" | "archive" | "none";

export type ProjectMeta = {
  description: string;
  icon: string;
  color: string;
  key?: string;
  visibility?: ProjectVisibility;
  guestAccess?: boolean;
  defaultView?: ProjectDefaultView;
  defaultStatus?: string;
  completionAction?: TaskCompletionAction;
  allowClosedColumns?: boolean;
  allowInvite?: boolean;
  allowCreateTasks?: boolean;
  allowAttachments?: boolean;
  allowComments?: boolean;
  archived?: boolean;
  tags?: string[];
  category?: string;
  sourceIdeaId?: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  imageScale?: number;
  imageScaleX?: number;
  imageScaleY?: number;
  imagePosX?: number;
  imagePosY?: number;
};

type SettingsRow = {
  project_id: string;
  payload: Record<string, unknown> | null;
  image_path: string | null;
};

const memory = new Map<string, ProjectMeta>();
const listeners = new Set<() => void>();
let tableAvailable: boolean | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeProjectMeta(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useProjectMetaTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeProjectMeta(() => setTick((n) => n + 1)), []);
  return tick;
}

export function defaultProjectColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

export function defaultProjectKey(name: string): string {
  const letters = name.replace(/[^A-Za-z\u0600-\u06FF]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3).toUpperCase();
  const compact = name.replace(/\s+/g, "").slice(0, 3);
  return (compact || "PRJ").toUpperCase();
}

function normalizeMeta(value: Partial<ProjectMeta> | undefined): ProjectMeta {
  return {
    description: value?.description ?? "",
    icon: value?.icon ?? "folder",
    color: value?.color ?? PROJECT_COLORS[0],
    key: value?.key,
    visibility: value?.visibility,
    guestAccess: value?.guestAccess,
    defaultView: value?.defaultView,
    defaultStatus: value?.defaultStatus,
    completionAction: value?.completionAction,
    allowClosedColumns: value?.allowClosedColumns,
    allowInvite: value?.allowInvite,
    allowCreateTasks: value?.allowCreateTasks,
    allowAttachments: value?.allowAttachments,
    allowComments: value?.allowComments,
    archived: value?.archived,
    tags: value?.tags,
    category: value?.category,
    sourceIdeaId: value?.sourceIdeaId,
    imageUrl: value?.imageUrl ?? null,
    imagePath: value?.imagePath ?? null,
    imageScale: value?.imageScale,
    imageScaleX: value?.imageScaleX,
    imageScaleY: value?.imageScaleY,
    imagePosX: value?.imagePosX,
    imagePosY: value?.imagePosY,
  };
}

function forLocalStorage(meta: ProjectMeta): ProjectMeta {
  const next = { ...meta };
  if (next.imageUrl?.startsWith("data:") && next.imagePath) delete next.imageUrl;
  if (next.imageUrl?.includes("/storage/v1/object/sign/")) delete next.imageUrl;
  return next;
}

export function readProjectMeta(): Record<string, ProjectMeta> {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProjectMeta>) : {};
  } catch {
    return {};
  }
}

function writeLocal(id: string, meta: ProjectMeta) {
  const all = readProjectMeta();
  all[id] = forLocalStorage(meta);
  try {
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch {
    const withoutImage = { ...all[id] };
    delete withoutImage.imageUrl;
    all[id] = withoutImage;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(all));
    } catch {
      // quota
    }
  }
}

function remember(id: string, meta: ProjectMeta) {
  memory.set(id, meta);
  writeLocal(id, meta);
}

export function getProjectMeta(id: string): ProjectMeta | undefined {
  const cached = memory.get(id);
  if (cached) return cached;
  const local = readProjectMeta()[id];
  if (local) {
    memory.set(id, normalizeMeta(local));
    return memory.get(id);
  }
  return undefined;
}

function tableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST205" || /project_settings/i.test(error.message || "");
}

async function signedImageUrl(path: string) {
  const { data } = await supabase.storage.from(PROJECT_IMAGES_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl || undefined;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: match[1] || "image/jpeg" });
  } catch {
    return null;
  }
}

function payloadOf(meta: ProjectMeta): Record<string, unknown> {
  const {
    imageUrl: _imageUrl,
    imagePath: _imagePath,
    ...rest
  } = meta;
  return rest;
}

function fromRow(row: SettingsRow, signedUrl?: string | null): ProjectMeta {
  const payload = (row.payload || {}) as Partial<ProjectMeta>;
  return normalizeMeta({
    ...payload,
    imagePath: row.image_path,
    imageUrl: signedUrl || null,
  });
}

async function uploadProjectImage(projectId: string, imageUrl: string, previousPath?: string | null) {
  const blob = dataUrlToBlob(imageUrl);
  if (!blob) return previousPath || null;
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PROJECT_IMAGES_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) return previousPath || null;
  if (previousPath && previousPath !== path) {
    void supabase.storage.from(PROJECT_IMAGES_BUCKET).remove([previousPath]);
  }
  return path;
}

export async function writeProjectMeta(id: string, patch: Partial<ProjectMeta>) {
  const merged = normalizeMeta({ ...getProjectMeta(id), ...patch });
  remember(id, merged);
  notify();
  await persistProjectMeta(id, merged);
}

async function persistProjectMeta(id: string, meta: ProjectMeta) {
  if (tableAvailable === false) return;

  let imagePath = meta.imagePath || null;
  if (meta.imageUrl === null) {
    if (imagePath) void supabase.storage.from(PROJECT_IMAGES_BUCKET).remove([imagePath]);
    imagePath = null;
  } else if (meta.imageUrl?.startsWith("data:")) {
    imagePath = await uploadProjectImage(id, meta.imageUrl, imagePath);
  }

  const { error } = await supabase.from("project_settings").upsert({
    project_id: id,
    payload: payloadOf(meta),
    image_path: imagePath,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (tableMissing(error)) tableAvailable = false;
    return;
  }
  tableAvailable = true;

  const displayUrl = imagePath
    ? (await signedImageUrl(imagePath)) || (meta.imageUrl?.startsWith("data:") ? meta.imageUrl : null)
    : null;
  const next = normalizeMeta({ ...meta, imagePath, imageUrl: displayUrl });
  remember(id, next);
  notify();
}

export async function hydrateProjectMetas(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  unique.forEach((id) => {
    if (!memory.has(id)) {
      const local = readProjectMeta()[id];
      if (local) memory.set(id, normalizeMeta(local));
    }
  });

  if (tableAvailable === false) {
    notify();
    return;
  }

  const { data, error } = await supabase
    .from("project_settings")
    .select("project_id, payload, image_path")
    .in("project_id", unique);

  if (error) {
    if (tableMissing(error)) tableAvailable = false;
    notify();
    return;
  }
  tableAvailable = true;

  const rows = (data || []) as SettingsRow[];
  const byId = new Map(rows.map((row) => [row.project_id, row]));
  const pendingLocal: string[] = [];

  await Promise.all(
    unique.map(async (id) => {
      const row = byId.get(id);
      if (!row) {
        const local = getProjectMeta(id);
        if (local && (local.icon || local.imageUrl || local.description || local.color)) pendingLocal.push(id);
        return;
      }
      const signed = row.image_path ? (await signedImageUrl(row.image_path)) || null : null;
      remember(id, fromRow(row, signed));
    })
  );

  notify();

  for (const id of pendingLocal) {
    const local = getProjectMeta(id);
    if (local) void persistProjectMeta(id, local);
  }
}

export async function hydrateAllProjectMetas() {
  const { data, error } = await supabase.from("projects").select("id");
  if (error || !data) return;
  await hydrateProjectMetas((data as { id: string }[]).map((row) => row.id));
}
