import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool } from "@/lib/sqlserver";
import { SOURCE_TABLE, sql } from "@/lib/scheduledTasks";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/tasks/dismiss: بيرفض طلب pending من غير ما يطبّق أي تعديل على المهمة -
 * زي زرار "Dismiss" في نايل شات بالظبط. المهمة بترجع approval_status='approved' بقيمها
 * الحالية زي ما هي، وبيتمسح كل أثر لطلب الـ pending (pending_changes وبيانات مين طلبه).
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
    console.error("[Rooms Dismiss] فشل:", message);
    return NextResponse.json({ errorCode: "dismiss_failed", detail: message }, { status: 500 });
  }
}
