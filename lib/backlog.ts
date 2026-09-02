import type { TaskAttachment } from "./taskExtras";

export type BacklogItem = {
  id: string;
  userId: string;
  title: string;
  description: string;
  projectId: string | null;
  columnId: string | null;
  color: string | null;
  dueDate: string | null;
  assigneeId: string;
  tags: string;
  estimate: string;
  recurrence: string;
  subtasks: string[];
  attachments: TaskAttachment[];
  createdAt: string;
};

const KEY = "viora-backlog";

function normalizeItem(raw: Partial<BacklogItem> & { id: string; userId: string; title: string; createdAt: string }): BacklogItem {
  return {
    id: raw.id,
    userId: raw.userId,
    title: raw.title,
    description: raw.description || "",
    projectId: raw.projectId || null,
    columnId: raw.columnId || null,
    color: raw.color || null,
    dueDate: raw.dueDate || null,
    assigneeId: raw.assigneeId || "",
    tags: raw.tags || "",
    estimate: raw.estimate || "",
    recurrence: raw.recurrence || "none",
    subtasks: Array.isArray(raw.subtasks) ? raw.subtasks : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    createdAt: raw.createdAt,
  };
}

function readAll(): BacklogItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Partial<BacklogItem>[]) : [];
    return list
      .filter((item): item is Partial<BacklogItem> & { id: string; userId: string; title: string; createdAt: string } =>
        Boolean(item && item.id && item.userId && item.title && item.createdAt)
      )
      .map(normalizeItem);
  } catch {
    return [];
  }
}

function writeAll(items: BacklogItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadBacklog(userId: string): BacklogItem[] {
  return readAll()
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addBacklogItem(input: Omit<BacklogItem, "id" | "createdAt">): BacklogItem {
  const item = normalizeItem({
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  writeAll([item, ...readAll()]);
  return item;
}

export function updateBacklogItem(id: string, patch: Partial<BacklogItem>) {
  writeAll(
    readAll().map((item) =>
      item.id === id
        ? normalizeItem({
            ...item,
            ...patch,
            id: item.id,
            userId: item.userId,
            title: patch.title != null ? patch.title.trim() : item.title,
            createdAt: item.createdAt,
          })
        : item
    )
  );
}

export function deleteBacklogItem(id: string) {
  writeAll(readAll().filter((item) => item.id !== id));
}
