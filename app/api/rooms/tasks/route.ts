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
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const [tasksResult, historyResult] = await Promise.all([
      pool.request().query(
        `SELECT id, contact_id, customer_name, task_text, agent_name, status,
                due_date, created_at, ended_at, delivery_status, assigned_to_name,
                approval_status, pending_changes, pending_changed_by_name, pending_changed_at
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
    return NextResponse.json({ errorCode: "load_failed", detail: message }, { status: 500 });
  }
}

/**
 * POST: بينشئ مهمة جديدة مباشرة في NileChat_ScheduledTasks_byA من فيورا.
 * المهمة بتتحط approval_status='pending' من الأول (مش 'approved') عشان متظهرش
 * للـ agent في نايل شات غير بعد ما الأدمن يعمل approve ليها، بالظبط زي أي مهمة
 * بتتعمل من نايل شات نفسه وتحتاج اعتماد.
 * المُنشئ (agent_id/agent_name) لازم يكون agent حقيقي في NileChat - بيتبعت من الفرونت
 * بعد ما اليوزر يربط حسابه في صفحة البروفايل (nilechat_links في Supabase).
 */
export async function POST(request: Request) {
  if (!requireSession()) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const contactId = Number(body?.contactId);
  const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const taskText = typeof body?.taskText === "string" ? body.taskText.trim() : "";
  const dueDate = typeof body?.dueDate === "string" ? body.dueDate : "";
  const assignedToId = body?.assignedToId != null ? Number(body.assignedToId) : null;
  const assignedToName = typeof body?.assignedToName === "string" ? body.assignedToName.trim() : null;
  const agentId = Number(body?.agentId);
  const agentName = typeof body?.agentName === "string" ? body.agentName.trim() : "";

  if (!contactId || !taskText || !dueDate || !agentId || !agentName) {
    return NextResponse.json({ errorCode: "missing_fields" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool
      .request()
      .input("contactId", sql.BigInt, contactId)
      .input("customerName", sql.NVarChar(200), customerName || null)
      .input("taskText", sql.NVarChar(sql.MAX), taskText)
      .input("agentId", sql.BigInt, agentId)
      .input("agentName", sql.NVarChar(200), agentName)
      .input("dueDate", sql.Date, dueDate)
      .input("assignedToId", sql.BigInt, assignedToId)
      .input("assignedToName", sql.NVarChar(200), assignedToName)
      .query(
        `INSERT INTO dbo.[${SOURCE_TABLE}]
           (contact_id, customer_name, task_text, agent_id, agent_name, status, due_date,
            assigned_to_id, assigned_to_name, company_id,
            approval_status, pending_changed_by_id, pending_changed_by_name, pending_changed_at)
         OUTPUT INSERTED.id
         VALUES (@contactId, @customerName, @taskText, @agentId, @agentName, 'open', @dueDate,
                 @assignedToId, @assignedToName, 1,
                 'pending', @agentId, @agentName, SYSUTCDATETIME())`
      );

    const newId = result.recordset[0]?.id;
    return NextResponse.json({ ok: true, id: newId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Tasks] فشل الإنشاء:", message);
    return NextResponse.json({ errorCode: "create_failed", detail: message }, { status: 500 });
  }
}

/**
 * PATCH: بيطلب تعليم المهمة كـ"خلصت"/"لسه مفتوحة" - ده مش تحديث مباشر، ده طلب اعتماد.
 * بنسجل الطلب في approval_status='pending' + pending_changes (بنفس شكل الـ JSON اللي
 * نايل شات بيستخدمه فعلًا: updates + historyEntries)، وبنسيب status الحقيقي زي ما هو
 * لحد ما الأدمن يعمل approve من نايل شات. القيم الحقيقية (status/ended_at) مش بتتغيرش هنا خالص.
 * لو فيه طلب pending قايم بالفعل على المهمة دي، بنرفض ونرجّع "already_pending".
 */
export async function PATCH(request: Request) {
  if (!requireSession()) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  let id: number | null = null;
  let done = false;
  let agentId: number | null = null;
  let agentName = "";
  try {
    const body = await request.json();
    id = typeof body?.id === "number" ? body.id : Number(body?.id);
    done = Boolean(body?.done);
    agentId = body?.agentId != null ? Number(body.agentId) : null;
    agentName = typeof body?.agentName === "string" ? body.agentName.trim() : "";
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ errorCode: "task_id_required" }, { status: 400 });
  }
  if (!agentId || !agentName) {
    return NextResponse.json({ errorCode: "nilechat_link_required" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();

    // هات الحالة الحالية عشان نسجلها كـ oldValue في السجل، ونتأكد إن مفيش طلب pending قايم بالفعل
    const currentResult = await pool
      .request()
      .input("id", sql.BigInt, id)
      .query(`SELECT status, approval_status FROM dbo.[${SOURCE_TABLE}] WHERE id = @id`);
    const current = currentResult.recordset[0];
    if (!current) {
      return NextResponse.json({ errorCode: "task_not_found" }, { status: 404 });
    }
    if ((current.approval_status || "approved").toLowerCase() === "pending") {
      return NextResponse.json({ errorCode: "already_pending" }, { status: 409 });
    }

    const newStatus = done ? "ended" : "open";
    const pendingChanges = JSON.stringify({
      updates: { status: newStatus },
      historyEntries: [{ fieldName: "status", oldValue: current.status, newValue: newStatus }],
    });

    await pool
      .request()
      .input("id", sql.BigInt, id)
      .input("pendingChanges", sql.NVarChar(sql.MAX), pendingChanges)
      .input("agentId", sql.BigInt, agentId)
      .input("agentName", sql.NVarChar(200), agentName)
      .query(
        `UPDATE dbo.[${SOURCE_TABLE}]
         SET approval_status = 'pending',
             pending_changes = @pendingChanges,
             pending_changed_by_id = @agentId,
             pending_changed_by_name = @agentName,
             pending_changed_at = SYSUTCDATETIME()
         WHERE id = @id`
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Tasks] فشل طلب التحديث:", message);
    return NextResponse.json({ errorCode: "update_failed", detail: message }, { status: 500 });
  }
}
