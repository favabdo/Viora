import { sql } from "@/lib/sqlserver";

/**
 * منطق قراءة/كتابة جدول NileChat_ScheduledTasks_byA مباشرة من SQL Server.
 * كل القراءة والكتابة هنا بتتم على SQL Server بس - مفيش أي كتابة في Supabase خالص.
 *
 * الأعمدة الحقيقية للجدول (زي ما إتبعتت):
 *   id, contact_id, customer_name, task_text, agent_id, agent_name,
 *   status ('open' | 'ended'), due_date, created_at, ended_at,
 *   delivery_status, assigned_to_id, assigned_to_name
 */

export const SOURCE_TABLE = "NileChat_ScheduledTasks_byA";

export type ScheduledTaskDTO = {
  id: number;
  contactId: number;
  customerName: string;
  taskText: string;
  agentName: string;
  status: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string | null;
  endedAt: string | null;
  deliveryStatus: string | null;
  assignedToName: string;
  isOverdue: boolean;
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
};

function toIso(value: Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function mapRow(row: RawRow): ScheduledTaskDTO {
  const done = (row.status || "").trim().toLowerCase() === "ended";
  const dueDateIso = toIso(row.due_date);
  const isOverdue = !done && !!dueDateIso && new Date(dueDateIso).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

  return {
    id: row.id,
    contactId: row.contact_id,
    customerName: (row.customer_name || "").trim() || "عميل بدون اسم",
    taskText: row.task_text,
    agentName: (row.agent_name || "").trim() || "غير معروف",
    status: row.status,
    done,
    dueDate: dueDateIso,
    createdAt: toIso(row.created_at),
    endedAt: toIso(row.ended_at),
    deliveryStatus: row.delivery_status,
    assignedToName: (row.assigned_to_name || "").trim() || "غير مسندة",
    isOverdue,
  };
}

export { sql };
