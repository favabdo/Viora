import { sql } from "@/lib/sqlserver";
import type { ConnectionPool } from "mssql";

/**
 * منطق قراءة/كتابة جدول NileChat_ScheduledTasks_byA مباشرة من SQL Server.
 * كل القراءة والكتابة هنا بتتم على SQL Server بس - مفيش أي كتابة في Supabase خالص.
 */

export const SOURCE_TABLE = "NileChat_ScheduledTasks_byA";

function normalize(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, "");
}

const COLUMN_CANDIDATES = {
  id: ["id", "taskid", "scheduledtaskid", "rowid", "recordid"],
  createdBy: ["createdby", "creatorname", "creator", "addedby", "requestedby", "createdbyname", "createdbyuser"],
  assignedTo: ["assignedto", "assigneename", "assignee", "responsible", "assignedtoname", "owner", "ownername", "responsibleperson"],
  text: ["tasktext", "description", "taskdescription", "details", "notes", "task", "content", "body", "tasktitle", "title", "taskname"],
  done: ["iscompleted", "completed", "isdone", "done", "status", "taskstatus", "state"],
} as const;

type FieldKey = keyof typeof COLUMN_CANDIDATES;

type ColumnInfo = { name: string; dataType: string };

export type DetectedColumns = {
  id: string | null;
  createdBy: string | null;
  assignedTo: string | null;
  text: string | null;
  done: string | null;
  doneDataType: string | null;
  /** true لو عمود الحالة نوعه رقمي/bit (يعني نقدر نكتب فيه 1/0 بأمان) */
  doneIsBoolean: boolean;
  /** لو عمود الحالة نصي، دي القيمة الفعلية المخزنة في الجدول لما التاسك "خلصت" (مثلاً "Ended") */
  doneTrueValue: string | null;
  /** ودي القيمة الفعلية لما التاسك "لسه مفتوحة" (مثلاً "Open") */
  doneFalseValue: string | null;
};

function findColumn(columns: ColumnInfo[], field: FieldKey): ColumnInfo | null {
  const candidates = COLUMN_CANDIDATES[field];
  for (const candidate of candidates) {
    const match = columns.find((c) => normalize(c.name) === candidate);
    if (match) return match;
  }
  return null;
}

const BOOLEAN_SQL_TYPES = ["bit", "tinyint", "int", "smallint", "boolean"];

/** بيقرا أعمدة الجدول الحقيقية من INFORMATION_SCHEMA ويحاول يطابقها مع الحقول المطلوبة */
export async function detectColumns(pool: ConnectionPool): Promise<{ columns: ColumnInfo[]; detected: DetectedColumns }> {
  const result = await pool.request().query<{ COLUMN_NAME: string; DATA_TYPE: string }>(
    `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${SOURCE_TABLE}'`
  );
  const columns: ColumnInfo[] = result.recordset.map((r) => ({ name: r.COLUMN_NAME, dataType: r.DATA_TYPE }));

  const idCol = findColumn(columns, "id");
  const createdByCol = findColumn(columns, "createdBy");
  const assignedToCol = findColumn(columns, "assignedTo");
  const textCol = findColumn(columns, "text");
  const doneCol = findColumn(columns, "done");
  const doneIsBoolean = doneCol ? BOOLEAN_SQL_TYPES.includes(doneCol.dataType.toLowerCase()) : false;

  let doneTrueValue: string | null = null;
  let doneFalseValue: string | null = null;
  if (doneCol && !doneIsBoolean) {
    const detectedValues = await detectTextStatusValues(pool, doneCol.name);
    doneTrueValue = detectedValues.trueValue;
    doneFalseValue = detectedValues.falseValue;
  }

  return {
    columns,
    detected: {
      id: idCol?.name ?? null,
      createdBy: createdByCol?.name ?? null,
      assignedTo: assignedToCol?.name ?? null,
      text: textCol?.name ?? null,
      done: doneCol?.name ?? null,
      doneDataType: doneCol?.dataType ?? null,
      doneIsBoolean,
      doneTrueValue,
      doneFalseValue,
    },
  };
}

/** بيحوّل قيمة عمود "الحالة/الإنجاز" (سواء bit أو نص زي Ended/Open أو Completed/Pending) لـ true/false للعرض */
export function parseDone(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const v = String(value).trim().toLowerCase();
  return [
    "true",
    "1",
    "yes",
    "y",
    "ended",
    "end",
    "completed",
    "complete",
    "done",
    "closed",
    "finished",
    "مكتمل",
    "تم",
    "منجز",
    "منجزة",
    "خلصت",
  ].includes(v);
}

const TRUE_STATUS_KEYWORDS = ["ended", "end", "completed", "complete", "done", "closed", "finished"];
const FALSE_STATUS_KEYWORDS = ["open", "pending", "notstarted", "instarted", "new", "todo", "inprogress", "started"];

/** بيدوّر جوه القيم الفعلية المخزنة في عمود الحالة النصي، ويحدد أنهي قيمة تعني "خلصت" وأنهي تعني "لسه مفتوحة" */
async function detectTextStatusValues(pool: ConnectionPool, doneCol: string): Promise<{ trueValue: string | null; falseValue: string | null }> {
  const result = await pool.request().query<{ v: string | null }>(
    `SELECT DISTINCT [${doneCol}] AS v FROM dbo.[${SOURCE_TABLE}] WHERE [${doneCol}] IS NOT NULL`
  );
  let trueValue: string | null = null;
  let falseValue: string | null = null;
  for (const row of result.recordset) {
    const raw = row.v;
    if (raw === null || raw === undefined) continue;
    const normalized = String(raw).trim().toLowerCase().replace(/[\s_-]/g, "");
    if (!trueValue && TRUE_STATUS_KEYWORDS.includes(normalized)) trueValue = String(raw);
    if (!falseValue && FALSE_STATUS_KEYWORDS.includes(normalized)) falseValue = String(raw);
  }
  return { trueValue, falseValue };
}

export function cleanText(value: unknown, fallback: string): string {
  const s = value === null || value === undefined ? "" : String(value).trim();
  return s || fallback;
}

export type ScheduledTaskDTO = {
  id: string;
  createdBy: string;
  assignedTo: string;
  text: string;
  done: boolean;
};

export { sql };
