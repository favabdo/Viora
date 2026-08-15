import { sql } from "@/lib/sqlserver";

/**
 * منطق قراءة/كتابة جدول NileChat_ScheduledTasks_byA مباشرة من SQL Server.
 * كل القراءة والكتابة هنا بتتم على SQL Server بس - مفيش أي كتابة في Supabase خالص.
 *
 * الأعمدة الحقيقية للجدول (زي ما إتبعتت):
 *   id, contact_id, customer_name, task_text, agent_id, agent_name,
 *   status ('open' | 'ended'), due_date, created_at, ended_at,
 *   delivery_status, assigned_to_id, assigned_to_name,
 *   approval_status ('approved' | 'pending'), pending_changes (JSON text),
 *   pending_changed_by_id, pending_changed_by_name, pending_changed_at
 *
 * نظام الـ approval بتاع NileChat: أي تعديل على مهمة (مش إنشاء بس) بيتسجل كـ
 * approval_status='pending' + pending_changes JSON بالشكل:
 *   { "updates": { "<camelCaseField>": <newValue> },
 *     "historyEntries": [{ "fieldName": "<snake_case_field>", "oldValue": "...", "newValue": "..." }] }
 * وبيفضل التاسك بالقيم القديمة لحد ما الأدمن يعمل approve من نايل شات (وقتها القيم الحقيقية تتحدّث
 * ويتحط سجل في NileChat_ScheduledTaskHistory_byA، وapproval_status يرجع 'approved').
 */

export const SOURCE_TABLE = "NileChat_ScheduledTasks_byA";
export const HISTORY_TABLE = "NileChat_ScheduledTaskHistory_byA";

export type HistoryEntryDTO = {
  id: number;
  taskId: number;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  changedByName: string | null;
  changedAt: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  assigned_to: "Assignee change",
  customer: "Customer change",
  task_text: "Task text change",
  status: "Status change",
  due_date: "Due date change",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] || fieldName;
}

type RawHistoryRow = {
  id: number;
  task_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  changed_at: Date | null;
};

export function mapHistoryRow(row: RawHistoryRow): HistoryEntryDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    fieldName: row.field_name,
    fieldLabel: fieldLabel(row.field_name),
    oldValue: row.old_value,
    newValue: row.new_value,
    changedByName: (row.changed_by_name || "").trim() || null,
    changedAt: toIso(row.changed_at),
  };
}

export type PendingChanges = {
  updates?: Record<string, unknown>;
  historyEntries?: { fieldName: string; oldValue: string | null; newValue: string | null }[];
} | null;

export type ScheduledTaskDTO = {
  id: number;
  contactId: number;
  /** null لو مفيش اسم عميل مسجّل - الواجهة تعرض نص "بدون اسم" مترجَم */
  customerName: string | null;
  taskText: string;
  /** null لو مفيش اسم مُنشئ - الواجهة تعرض "غير معروف" مترجَم */
  agentName: string | null;
  status: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string | null;
  endedAt: string | null;
  deliveryStatus: string | null;
  /** null لو مفيش حد متسند له ومفيش حتى مُنشئ نرجعله كبديل - الواجهة تعرض "غير معروف" مترجَم */
  assignedToName: string | null;
  isOverdue: boolean;
  /** عدد الأيام المتبقية على تاريخ التسليم (موجب) - null لو مفيش due_date أو المهمة خلصت */
  daysRemaining: number | null;
  /** عدد الأيام اللي فاتت على تاريخ التسليم (موجب) - null لو مش متأخرة */
  daysOverdue: number | null;
  history: HistoryEntryDTO[];
  /** 'approved' | 'pending' - لو pending يبقى فيه تعديل أو مهمة جديدة لسه مستنية موافقة الأدمن في NileChat */
  approvalStatus: string;
  isPending: boolean;
  pendingChanges: PendingChanges;
  pendingChangedByName: string | null;
  pendingChangedAt: string | null;
};

type RawRow = {
  id: number;
  contact_id: number;
  customer_name: string | null;
  task_text: string;
  agent_name: string | null;
  status: string;
  due_date: Date | null;
  created_at: Date | null;
  ended_at: Date | null;
  delivery_status: string | null;
  assigned_to_name: string | null;
  approval_status: string | null;
  pending_changes: string | null;
  pending_changed_by_name: string | null;
  pending_changed_at: Date | null;
};

function toIso(value: Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function mapRow(row: RawRow, history: HistoryEntryDTO[] = []): ScheduledTaskDTO {
  const done = (row.status || "").trim().toLowerCase() === "ended";
  const dueDateIso = toIso(row.due_date);
  const agentName = (row.agent_name || "").trim() || null;
  // لو مفيش حد متسندله المهمة، تتسند تلقائيًا في العرض للي أنشأها
  const assignedToName = (row.assigned_to_name || "").trim() || agentName;

  let isOverdue = false;
  let daysRemaining: number | null = null;
  let daysOverdue: number | null = null;

  if (dueDateIso) {
    const todayMidnight = new Date().setHours(0, 0, 0, 0);
    const dueMidnight = new Date(dueDateIso).setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

    if (!done) {
      if (diffDays < 0) {
        isOverdue = true;
        daysOverdue = Math.abs(diffDays);
      } else {
        daysRemaining = diffDays;
      }
    }
  }

  const approvalStatus = (row.approval_status || "approved").trim().toLowerCase();
  let pendingChanges: PendingChanges = null;
  if (row.pending_changes) {
    try {
      pendingChanges = JSON.parse(row.pending_changes);
    } catch {
      pendingChanges = null;
    }
  }

  return {
    id: row.id,
    contactId: row.contact_id,
    customerName: (row.customer_name || "").trim() || null,
    taskText: row.task_text,
    agentName,
    status: row.status,
    done,
    dueDate: dueDateIso,
    createdAt: toIso(row.created_at),
    endedAt: toIso(row.ended_at),
    deliveryStatus: row.delivery_status,
    assignedToName,
    isOverdue,
    daysRemaining,
    daysOverdue,
    history,
    approvalStatus,
    isPending: approvalStatus === "pending",
    pendingChanges,
    pendingChangedByName: (row.pending_changed_by_name || "").trim() || null,
    pendingChangedAt: toIso(row.pending_changed_at),
  };
}

export { sql };
