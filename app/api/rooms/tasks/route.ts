import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool } from "@/lib/sqlserver";
import { mapRow, mapHistoryRow, SOURCE_TABLE, HISTORY_TABLE, sql, ScheduledTaskDTO, HistoryEntryDTO } from "@/lib/scheduledTasks";

export const dynamic = "force-dynamic";

function requireSession() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  return verifyRoomsSessionToken(token);
}

/**
 * GET: بيقرا كل صفوف NileChat_ScheduledTasks_byA مباشرة من SQL Server (مفيش أي قراءة/كتابة في Supabase هنا خالص).
 */
export async function GET() {
  if (!requireSession()) {
    return NextResponse.json({ error: "محتاج تدخل كلمة مرور Rooms الأول" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const [tasksResult, historyResult] = await Promise.all([
      pool.request().query(
        `SELECT id, contact_id, customer_name, task_text, agent_name, status,
                due_date, created_at, ended_at, delivery_status, assigned_to_name
         FROM dbo.[${SOURCE_TABLE}]
         ORDER BY due_date ASC, created_at DESC`
      ),
      pool.request().query(
        `SELECT id, task_id, field_name, old_value, new_value, changed_by_name, changed_at
         FROM dbo.[${HISTORY_TABLE}]
         ORDER BY changed_at DESC`
      ),
    ]);

    // بنجمّع سجل التغييرات لكل مهمة حسب task_id، عشان كل مهمة تاخد بس سجلها هي
    const historyByTaskId = new Map<number, HistoryEntryDTO[]>();
    for (const row of historyResult.recordset) {
      const entry = mapHistoryRow(row);
      const list = historyByTaskId.get(entry.taskId) || [];
      list.push(entry);
      historyByTaskId.set(entry.taskId, list);
    }

    const tasks: ScheduledTaskDTO[] = tasksResult.recordset.map((row: any) =>
      mapRow(row, historyByTaskId.get(row.id) || [])
    );
    return NextResponse.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Tasks] فشل القراءة:", message);
    return NextResponse.json({ error: "فشل قراءة المهام من قاعدة بيانات Rooms: " + message }, { status: 500 });
  }
}

/**
 * PATCH: بيحدّث حالة المهمة (open/ended) مباشرة على SQL Server.
 * لما نعلّم "خلصت": status = 'ended' و ended_at = الوقت الحالي.
 * لما نلغي التعليم: status = 'open' و ended_at = NULL.
 * ملحوظة: عمود delivery_status مش بنلمسه هنا خالص - ده بيتحسب/بيتحدّث من النظام الأصلي بتاع NileChat.
 */
export async function PATCH(request: Request) {
  if (!requireSession()) {
    return NextResponse.json({ error: "محتاج تدخل كلمة مرور Rooms الأول" }, { status: 401 });
  }

  let id: number | null = null;
  let done = false;
  try {
    const body = await request.json();
    id = typeof body?.id === "number" ? body.id : Number(body?.id);
    done = Boolean(body?.done);
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "id المهمة مطلوب" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();
    const status = done ? "ended" : "open";
    const endedAt = done ? new Date() : null;

    await pool
      .request()
      .input("id", sql.BigInt, id)
      .input("status", sql.NVarChar(20), status)
      .input("endedAt", sql.DateTime2, endedAt)
      .query(`UPDATE dbo.[${SOURCE_TABLE}] SET status = @status, ended_at = @endedAt WHERE id = @id`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Tasks] فشل التحديث:", message);
    return NextResponse.json({ error: "فشل تحديث المهمة في قاعدة بيانات Rooms: " + message }, { status: 500 });
  }
}
