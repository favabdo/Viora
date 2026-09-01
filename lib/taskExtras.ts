export type TaskSubtask = {
  text: string;
  done: boolean;
  due?: string | null;
  assigneeId?: string | null;
};

export type TaskAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  path?: string;
  url?: string;
};

export type TaskExtras = {
  description?: string;
  tags?: string;
  labels?: string;
  category?: string;
  estimate?: string;
  timeSpent?: string;
  recurrence?: string;
  subtasks?: TaskSubtask[];
  attachments?: TaskAttachment[];
  pinned?: boolean;
  watching?: boolean;
  archived?: boolean;
};

const TASK_META_KEY = "viora-task-meta";

function readAll(): Record<string, TaskExtras> {
  try {
    const raw = localStorage.getItem(TASK_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, TaskExtras> = {};
    for (const [id, value] of Object.entries(parsed)) {
      out[id] = normalizeExtras(value);
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, TaskExtras>) {
  localStorage.setItem(TASK_META_KEY, JSON.stringify(all));
}

function normalizeSubtasks(value: unknown): TaskSubtask[] {
  if (!Array.isArray(value)) return [];
  const list: TaskSubtask[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) list.push({ text, done: false, due: null, assigneeId: null });
      continue;
    }
    if (item && typeof item === "object" && "text" in item) {
      const row = item as TaskSubtask;
      const text = String(row.text || "").trim();
      if (!text) continue;
      list.push({
        text,
        done: Boolean(row.done),
        due: typeof row.due === "string" && row.due ? row.due : null,
        assigneeId: typeof row.assigneeId === "string" && row.assigneeId ? row.assigneeId : null,
      });
    }
  }
  return list;
}

export function normalizeExtras(value: unknown): TaskExtras {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const attachments = Array.isArray(row.attachments)
    ? (row.attachments as TaskAttachment[]).filter((item) => item && typeof item.name === "string")
    : [];
  return {
    description: typeof row.description === "string" ? row.description : "",
    tags: typeof row.tags === "string" ? row.tags : "",
    labels: typeof row.labels === "string" ? row.labels : "",
    category: typeof row.category === "string" ? row.category : "",
    estimate: typeof row.estimate === "string" ? row.estimate : "",
    timeSpent: typeof row.timeSpent === "string" ? row.timeSpent : "",
    recurrence: typeof row.recurrence === "string" ? row.recurrence : "none",
    subtasks: normalizeSubtasks(row.subtasks),
    attachments,
    pinned: Boolean(row.pinned),
    watching: Boolean(row.watching),
    archived: Boolean(row.archived),
  };
}

export function readTaskExtras(taskId: string): TaskExtras {
  return readAll()[taskId] || {};
}

export function writeTaskMeta(
  taskId: string,
  extras: {
    description: string;
    tags: string;
    estimate: string;
    recurrence: string;
    subtasks: string[];
  }
) {
  patchTaskExtras(taskId, {
    description: extras.description,
    tags: extras.tags,
    estimate: extras.estimate,
    recurrence: extras.recurrence,
    subtasks: extras.subtasks.map((text) => ({ text, done: false })),
  });
}

export function patchTaskExtras(taskId: string, patch: Partial<TaskExtras>): TaskExtras {
  try {
    const all = readAll();
    const next = { ...normalizeExtras(all[taskId]), ...patch };
    all[taskId] = next;
    writeAll(all);
    return next;
  } catch {
    return normalizeExtras(patch);
  }
}

export function copyTaskExtras(fromId: string, toId: string) {
  const extras = readTaskExtras(fromId);
  if (!extras || Object.keys(extras).length === 0) return;
  const localOnly = (extras.attachments || []).filter((file) => file.dataUrl && !file.path);
  patchTaskExtras(toId, {
    ...extras,
    attachments: localOnly,
    pinned: false,
    watching: false,
    archived: false,
  });
}

export function subtaskProgress(extras: TaskExtras): { done: number; total: number } {
  const list = extras.subtasks || [];
  return { done: list.filter((item) => item.done).length, total: list.length };
}
