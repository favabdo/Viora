import type { TaskAttachment } from "./taskExtras";

const STORAGE_KEY = "viora-ideas";

export type IdeaStatus = "planned" | "in_progress" | "implemented" | "archived";
export type IdeaPriority = "low" | "medium" | "high";

export type IdeaNote = {
  id: string;
  userId: string;
  authorName: string;
  message: string;
  createdAt: string;
};

export type IdeaEvent = {
  id: string;
  message: string;
  createdAt: string;
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
  attachments: TaskAttachment[];
  notes: IdeaNote[];
  activity: IdeaEvent[];
  createdAt: string;
  updatedAt: string;
};

export const IDEA_CATEGORIES = ["AI", "Product", "Mobile", "Design", "Integration", "Growth", "Ops"] as const;

export const IDEA_COLORS = ["#6C5CE7", "#3B82F6", "#14B8A6", "#F59E0B", "#EC4899", "#22C55E", "#EAB308", "#6B7280"];

function nowIso() {
  return new Date().toISOString();
}

function event(message: string): IdeaEvent {
  return { id: crypto.randomUUID(), message, createdAt: nowIso() };
}

export function readIdeas(): Idea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Idea[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIdeas(list: Idea[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function upsertIdea(idea: Idea) {
  const list = readIdeas();
  const index = list.findIndex((item) => item.id === idea.id);
  if (index >= 0) list[index] = idea;
  else list.unshift(idea);
  writeIdeas(list);
}

export function patchIdea(id: string, patch: Partial<Idea>): Idea | null {
  const list = readIdeas();
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = { ...list[index], ...patch, updatedAt: nowIso() };
  list[index] = next;
  writeIdeas(list);
  return next;
}

export function deleteIdea(id: string) {
  writeIdeas(readIdeas().filter((item) => item.id !== id));
}

export function createIdea(input: {
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
}): Idea {
  const createdAt = nowIso();
  const idea: Idea = {
    id: crypto.randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    description: input.description.trim(),
    icon: input.icon,
    color: input.color,
    category: input.category,
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    status: input.status,
    priority: input.priority,
    projectId: input.projectId,
    convertedProjectId: null,
    favorite: false,
    progress: input.status === "implemented" ? 100 : input.status === "in_progress" ? 40 : 10,
    attachments: input.attachments || [],
    notes: [],
    activity: [event("created")],
    createdAt,
    updatedAt: createdAt,
  };
  upsertIdea(idea);
  return idea;
}

export function addIdeaNote(idea: Idea, userId: string, authorName: string, message: string): Idea {
  const note: IdeaNote = {
    id: crypto.randomUUID(),
    userId,
    authorName,
    message: message.trim(),
    createdAt: nowIso(),
  };
  return (
    patchIdea(idea.id, {
      notes: [...idea.notes, note],
      activity: [event("note"), ...idea.activity].slice(0, 40),
    }) || idea
  );
}

export function addIdeaFiles(idea: Idea, files: TaskAttachment[]): Idea {
  return (
    patchIdea(idea.id, {
      attachments: [...idea.attachments, ...files],
      activity: [event("file"), ...idea.activity].slice(0, 40),
    }) || idea
  );
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
