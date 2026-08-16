import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool } from "@/lib/sqlserver";
import { SOURCE_TABLE, HISTORY_TABLE, sql } from "@/lib/scheduledTasks";

export const dynamic = "force-dynamic";

// بنحوّل اسم الحقل زي ما بيجي في updates (camelCase من نايل شات) لاسم العمود الحقيقي في الجدول
const FIELD_COLUMN_MAP: Record<string, string> = {
  status: "status",
  dueDate: "due_date",
  taskText: "task_text",
  customerName: "customer_name",
  assignedToId: "assigned_to_id",
  assignedToName: "assigned_to_name",
};

/**
 * POST /api/rooms/tasks/approve: بيعتمد طلب pending (سواء مهمة جديدة أو طلب تعديل).
 * - لو مهمة جديدة (pending_changes فاضي): بس approval_status يرجع 'approved'.
 * - لو طلب تعديل: بيطبّق كل قيمة في updates على العمود الحقيقي المقابل، وبيسجل كل
 *   historyEntries في NileChat_ScheduledTaskHistory_byA بنفس اسم اللي طلب التعديل
 *   (احترامًا لنفس منطق نايل شات - الاعتماد بوابة بس، مش هو اللي "عمل" التعديل).
 */
export async function POST(request: Request) {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  if (!verifyRoomsSessionToken(token)) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  let id: number | null = null;
  try {
    const body = await request.json();
    id = typeof body?.id === "number" ? body.id : Number(body?.id);
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ errorCode: "task_id_required" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();

    const currentResult = await pool
      .request()
      .input("id", sql.BigInt, id)
      .query(
        `SELECT approval_status, pending_changes, pending_changed_by_name
         FROM dbo.[${SOURCE_TABLE}] WHERE id = @id`
      );
    const current = currentResult.recordset[0];
    if (!current) {
      return NextResponse.json({ errorCode: "task_not_found" }, { status: 404 });
    }
    if ((current.approval_status || "approved").toLowerCase() !== "pending") {
      return NextResponse.json({ errorCode: "already_pending" }, { status: 409 });
    }

    let updates: Record<string, unknown> = {};
    let historyEntries: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];
    if (current.pending_changes) {
      try {
        const parsed = JSON.parse(current.pending_changes);
        updates = parsed.updates || {};
        historyEntries = parsed.historyEntries || [];
      } catch {
        updates = {};
        historyEntries = [];
      }
    }

    // بنطبّق كل تعديل على العمود الحقيقي المقابل
    const updateKeys = Object.keys(updates).filter((k) => FIELD_COLUMN_MAP[k]);
    if (updateKeys.length > 0) {
      const req = pool.request().input("id", sql.BigInt, id);
      const setClauses: string[] = [];
      updateKeys.forEach((key, i) => {
        const column = FIELD_COLUMN_MAP[key];
        const paramName = `val${i}`;
        const value = updates[key];
        if (column === "due_date") req.input(paramName, sql.Date, value as string);
        else if (column === "assigned_to_id") req.input(paramName, sql.BigInt, value as number);
        else req.input(paramName, sql.NVarChar(sql.MAX), value as string);
        setClauses.push(`[${column}] = @${paramName}`);
      });
      await req.query(`UPDATE dbo.[${SOURCE_TABLE}] SET ${setClauses.join(", ")} WHERE id = @id`);
    }

    // بنسجل كل تغيير في السجل باسم اللي طلبه أصلًا (مش اللي اعتمده)
    for (const entry of historyEntries) {
      await pool
        .request()
        .input("taskId", sql.BigInt, id)
        .input("fieldName", sql.NVarChar(50), entry.fieldName)
        .input("oldValue", sql.NVarChar(sql.MAX), entry.oldValue)
        .input("newValue", sql.NVarChar(sql.MAX), entry.newValue)
        .input("changedByName", sql.NVarChar(200), current.pending_changed_by_name)
        .query(
          `INSERT INTO dbo.[${HISTORY_TABLE}] (task_id, field_name, old_value, new_value, changed_by_name)
           VALUES (@taskId, @fieldName, @oldValue, @newValue, @changedByName)`
        );
    }

    // نرجّع المهمة لحالة "معتمدة" ونمسح كل آثار الطلب المعلّق
    await pool
      .request()
      .input("id", sql.BigInt, id)
      .query(
        `UPDATE dbo.[${SOURCE_TABLE}]
         SET approval_status = 'approved', pending_changes = NULL,
             pending_changed_by_id = NULL, pending_changed_by_name = NULL, pending_changed_at = NULL
         WHERE id = @id`
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Approve] فشل:", message);
    return NextResponse.json({ errorCode: "approve_failed", detail: message }, { status: 500 });
  }
}
