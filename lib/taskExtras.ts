import { getProjectMeta } from "./projectMeta";
import { getStoredSettings } from "./useSettings";

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
  trashedAt?: string | null;
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
    trashedAt: typeof row.trashedAt === "string" && row.trashedAt ? row.trashedAt : null,
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
    trashedAt: null,
  });
}

export function isTaskTrashed(taskId: string): boolean {
  return Boolean(readTaskExtras(taskId).trashedAt);
}

/** يستبعد المهام المنقولة إلى سلة المحذوفات من أي قائمة مهام */
export function filterTrashed<T extends { id: string }>(tasks: T[]): T[] {
  const all = readAll();
  return tasks.filter((task) => !all[task.id]?.trashedAt);
}

export function moveTaskToTrash(taskId: string) {
  patchTaskExtras(taskId, { trashedAt: new Date().toISOString() });
}

export function restoreTaskFromTrash(taskId: string) {
  patchTaskExtras(taskId, { trashedAt: null });
}

export function listTrashedTasks(): { taskId: string; trashedAt: string }[] {
  return Object.entries(readAll())
    .filter(([, extras]) => Boolean(extras.trashedAt))
    .map(([taskId, extras]) => ({ taskId, trashedAt: extras.trashedAt as string }))
    .sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
}

/** حذف المهمة: إلى السلة (استرجاع لاحقًا) عند تفعيل الإعداد، وإلا حذف نهائي */
export function deleteTaskOrMoveToTrash(taskId: string): boolean {
  try {
    if (getStoredSettings().moveTasksToTrash) {
      moveTaskToTrash(taskId);
      return true;
    }
  } catch {
    // تجاهل — المسار الأصلي للحذف
  }
  return false;
}

/** هل تُؤرشف المهمة تلقائيًا عند اكتمالها؟ (إعداد المشروع يتجاوز العام) */
export function shouldArchiveOnComplete(projectId?: string): boolean {
  const action = projectId ? getProjectMeta(projectId)?.completionAction : undefined;
  if (action) return action === "archive";
  return getStoredSettings().archiveCompletedTasks;
}

export function subtaskProgress(extras: TaskExtras): { done: number; total: number } {
  const list = extras.subtasks || [];
  return { done: list.filter((item) => item.done).length, total: list.length };
}
