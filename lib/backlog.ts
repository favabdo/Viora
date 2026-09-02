export type BacklogItem = {
  id: string;
  userId: string;
  title: string;
  description: string;
  projectId: string | null;
  createdAt: string;
};

const KEY = "viora-backlog";

function readAll(): BacklogItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BacklogItem[]) : [];
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

export function addBacklogItem(input: {
  userId: string;
  title: string;
  description?: string;
  projectId?: string | null;
}): BacklogItem {
  const item: BacklogItem = {
    id: crypto.randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    description: (input.description || "").trim(),
    projectId: input.projectId || null,
    createdAt: new Date().toISOString(),
  };
  writeAll([item, ...readAll()]);
  return item;
}

export function updateBacklogItem(id: string, patch: Partial<Pick<BacklogItem, "title" | "description" | "projectId">>) {
  writeAll(
    readAll().map((item) =>
      item.id === id
        ? {
            ...item,
            ...patch,
            title: patch.title != null ? patch.title.trim() : item.title,
            description: patch.description != null ? patch.description.trim() : item.description,
          }
        : item
    )
  );
}

export function deleteBacklogItem(id: string) {
  writeAll(readAll().filter((item) => item.id !== id));
}
