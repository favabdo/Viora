import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool } from "@/lib/sqlserver";
import { SOURCE_TABLE } from "@/lib/scheduledTasks";

export const dynamic = "force-dynamic";

/**
 * GET: ليستة خفيفة بالمهام اللي approval_status='pending' حاليًا - بتُستخدم لنظام
 * التنبيهات داخل فيورا (مش أي حاجة في نايل شات). بيتسحب دوري (polling) من الفرونت
 * كل شوية عشان نكتشف أي طلب جديد من أي agent أول ما يحصل.
 */
export async function GET() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  if (!verifyRoomsSessionToken(token)) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool.request().query(
      `SELECT id, task_text, customer_name, pending_changes, pending_changed_by_name, pending_changed_at
       FROM dbo.[${SOURCE_TABLE}]
       WHERE approval_status = 'pending'
       ORDER BY pending_changed_at DESC`
    );

    const items = result.recordset.map((r: any) => {
      const isNewTask = !r.pending_changes;
      return {
        id: r.id,
        kind: isNewTask ? "new_task" : "change_request",
        taskText: r.task_text as string,
        customerName: (r.customer_name || "").trim() || null,
        requestedByName: (r.pending_changed_by_name || "").trim() || null,
        requestedAt: r.pending_changed_at instanceof Date ? r.pending_changed_at.toISOString() : r.pending_changed_at,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Pending] فشل القراءة:", message);
    return NextResponse.json({ errorCode: "load_failed", detail: message }, { status: 500 });
  }
}
