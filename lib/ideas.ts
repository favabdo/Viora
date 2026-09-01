import { supabase } from "./supabase";
import type { TaskAttachment } from "./taskExtras";

const LEGACY_KEY = "viora-ideas";
const BUCKET = "idea-files";

export type IdeaStatus = "planned" | "in_progress" | "implemented" | "archived";
export type IdeaPriority = "low" | "medium" | "high";

export type IdeaNote = {
  id: string;
  userId: string;
  authorName: string;
  avatarUrl?: string | null;
  message: string;
  createdAt: string;
};

export type IdeaEvent = {
  id: string;
  message: string;
  createdAt: string;
};

export type IdeaFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  dataUrl?: string;
};

export type Idea = {
  id: string;
  userId: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tags: string[];
  status: IdeaStatus;
  priority: IdeaPriority;
  projectId: string | null;
  convertedProjectId: string | null;
  favorite: boolean;
  progress: number;
  attachments: IdeaFile[];
  notes: IdeaNote[];
  activity: IdeaEvent[];
  createdAt: string;
  updatedAt: string;
};

export const IDEA_CATEGORIES = ["AI", "Product", "Mobile", "Design", "Integration", "Growth", "Ops"] as const;
export const IDEA_COLORS = ["#6C5CE7", "#3B82F6", "#14B8A6", "#F59E0B", "#EC4899", "#22C55E", "#EAB308", "#6B7280"];

type IdeaRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tags: string[] | null;
  status: IdeaStatus;
  priority: IdeaPriority;
  project_id: string | null;
  converted_project_id: string | null;
  favorite: boolean;
  progress: number;
  created_at: string;
  updated_at: string;
  idea_notes?: {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    profiles?: { username: string; full_name: string; avatar_url?: string | null } | null;
  }[];
  idea_attachments?: {
    id: string;
    name: string;
    size: number;
    mime_type: string;
    storage_path: string;
    created_at: string;
  }[];
  idea_activity?: { id: string; action: string; created_at: string }[];
};

function defaultProgress(status: IdeaStatus) {
  if (status === "implemented") return 100;
  if (status === "in_progress") return 40;
  return 10;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

async function signedUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || undefined;
}

function mapNotes(rows: IdeaRow["idea_notes"]): IdeaNote[] {
  return (rows || [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      authorName: (row.profiles?.full_name && row.profiles.full_name.trim()) || row.profiles?.username || "",
      avatarUrl: row.profiles?.avatar_url,
      message: row.message,
      createdAt: row.created_at,
    }));
}

async function mapAttachments(rows: IdeaRow["idea_attachments"]): Promise<IdeaFile[]> {
  const list = rows || [];
  return Promise.all(
    list.map(async (row) => ({
      id: row.id,
      name: row.name,
      size: row.size,
      type: row.mime_type,
      path: row.storage_path,
      dataUrl: await signedUrl(row.storage_path),
    }))
  );
}

async function mapRow(row: IdeaRow): Promise<Idea> {
  const activity = (row.idea_activity || [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((item) => ({ id: item.id, message: item.action, createdAt: item.created_at }));
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    color: row.color,
    category: row.category,
    tags: row.tags || [],
    status: row.status,
    priority: row.priority,
    projectId: row.project_id,
    convertedProjectId: row.converted_project_id,
    favorite: row.favorite,
    progress: row.progress,
    attachments: await mapAttachments(row.idea_attachments),
    notes: mapNotes(row.idea_notes),
    activity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const IDEA_SELECT = `
  *,
  idea_notes(*, profiles!idea_notes_user_id_fkey(username, full_name, avatar_url)),
  idea_attachments(*),
  idea_activity(*)
`;

export async function loadIdeas(): Promise<Idea[]> {
  const first = await supabase.from("ideas").select(IDEA_SELECT).order("updated_at", { ascending: false });
  const res = first.error
    ? await supabase
        .from("ideas")
        .select("*, idea_notes(*), idea_attachments(*), idea_activity(*)")
        .order("updated_at", { ascending: false })
    : first;
  if (res.error || !res.data) return [];
  return Promise.all((res.data as IdeaRow[]).map(mapRow));
}

export async function logIdeaActivity(ideaId: string, action: string, userId?: string) {
  await supabase.from("idea_activity").insert({
    idea_id: ideaId,
    action,
    user_id: userId ?? null,
  });
}

export async function createIdea(input: {
  userId: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tags: string[];
  status: IdeaStatus;
  priority: IdeaPriority;
  projectId: string | null;
  attachments?: TaskAttachment[];
}): Promise<Idea | null> {
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      user_id: input.userId,
      title: input.title.trim(),
      description: input.description.trim(),
      icon: input.icon,
      color: input.color,
      category: input.category,
      tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
      status: input.status,
      priority: input.priority,
      project_id: input.projectId,
      progress: defaultProgress(input.status),
    })
    .select(IDEA_SELECT)
    .single();
  if (error || !data) return null;
  await logIdeaActivity(data.id, "created", input.userId);
  if (input.attachments?.length) {
    await uploadIdeaAttachments(data.id, input.userId, input.attachments);
  }
  const list = await loadIdeas();
  return list.find((item) => item.id === data.id) || mapRow(data as IdeaRow);
}

export async function updateIdea(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    icon: string;
    color: string;
    category: string;
    tags: string[];
    status: IdeaStatus;
    priority: IdeaPriority;
    projectId: string | null;
    convertedProjectId: string | null;
    favorite: boolean;
    progress: number;
  }>,
  activity?: string
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title != null) row.title = patch.title;
  if (patch.description != null) row.description = patch.description;
  if (patch.icon != null) row.icon = patch.icon;
  if (patch.color != null) row.color = patch.color;
  if (patch.category != null) row.category = patch.category;
  if (patch.tags != null) row.tags = patch.tags;
  if (patch.status != null) row.status = patch.status;
  if (patch.priority != null) row.priority = patch.priority;
  if (patch.projectId !== undefined) row.project_id = patch.projectId;
  if (patch.convertedProjectId !== undefined) row.converted_project_id = patch.convertedProjectId;
  if (patch.favorite != null) row.favorite = patch.favorite;
  if (patch.progress != null) row.progress = patch.progress;
  if (Object.keys(row).length) {
    await supabase.from("ideas").update(row).eq("id", id);
  }
  if (activity) await logIdeaActivity(id, activity);
}

export async function deleteIdea(id: string, attachments: IdeaFile[]) {
  const paths = attachments.map((file) => file.path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  await supabase.from("ideas").delete().eq("id", id);
}

export async function addIdeaNote(ideaId: string, userId: string, message: string) {
  await supabase.from("idea_notes").insert({
    idea_id: ideaId,
    user_id: userId,
    message: message.trim(),
  });
  await logIdeaActivity(ideaId, "note", userId);
}

export async function uploadIdeaAttachments(ideaId: string, userId: string, files: TaskAttachment[]) {
  let uploaded = 0;
  for (const file of files) {
    if (!file.dataUrl || file.dataUrl.startsWith("http")) continue;
    const res = await fetch(file.dataUrl);
    const blob = await res.blob();
    const path = `${userId}/${ideaId}/${file.id}-${safeName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: file.type || blob.type || "application/octet-stream",
      upsert: false,
    });
    if (error) continue;
    await supabase.from("idea_attachments").insert({
      idea_id: ideaId,
      user_id: userId,
      name: file.name,
      size: file.size,
      mime_type: file.type || blob.type || "",
      storage_path: path,
    });
    uploaded += 1;
  }
  if (uploaded) await logIdeaActivity(ideaId, "file", userId);
}

type LegacyIdea = Idea;

export async function migrateLocalIdeas(userId: string) {
  if (typeof window === "undefined") return;
  let local: LegacyIdea[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    local = raw ? (JSON.parse(raw) as LegacyIdea[]) : [];
  } catch {
    return;
  }
  if (!Array.isArray(local) || local.length === 0) return;

  for (const idea of local.filter((item) => item.userId === userId || !item.userId)) {
    const created = await createIdea({
      userId,
      title: idea.title,
      description: idea.description,
      icon: idea.icon,
      color: idea.color,
      category: idea.category,
      tags: idea.tags || [],
      status: idea.status,
      priority: idea.priority,
      projectId: idea.projectId,
      attachments: idea.attachments,
    });
    if (!created) continue;
    if (idea.convertedProjectId || idea.favorite || idea.progress) {
      await updateIdea(created.id, {
        convertedProjectId: idea.convertedProjectId,
        favorite: idea.favorite,
        progress: idea.progress,
        projectId: idea.projectId,
      });
    }
    for (const note of idea.notes || []) {
      if (note.message?.trim()) await addIdeaNote(created.id, userId, note.message);
    }
  }

  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // تجاهل
  }
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
