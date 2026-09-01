import { NextResponse } from "next/server";
import { getRoomsPool } from "@/lib/sqlserver";
import { SOURCE_TABLE } from "@/lib/scheduledTasks";
import { supabase } from "@/lib/supabase";
import { sendPushToAllSubscribers } from "@/lib/webPush";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms/notify-pending?secret=...
 *
 * ده endpoint مخصوص يتنادى دوريًا من برّه (Vercel Cron أو خدمة cron خارجية زي
 * cron-job.org) - مش من المتصفح خالص، عشان كده مش محتاج كوكي Rooms session،
 * بس محتاج ?secret= يطابق ROOMS_NOTIFY_SECRET في متغيرات البيئة.
 *
 * بيدوّر على أي مهمة approval_status='pending' لسه مبعتناش عنها إيميل قبل كده
 * (بنتتبع ده في جدول rooms_notified_pending في Supabase)، ولو لقى حاجة جديدة
 * بيبعت إيميل واحد فيه كل الطلبات الجديدة، ويسجلها كـ "متبعتة" عشان محدش يتكرر.
 *
 * ده بيغطي الطلبات اللي بتتعمل من نايل شات نفسه (مش من فيورا) واللي فيورا
 * مش بتعرف بيها إلا بالسؤال الدوري ده. الطلبات اللي بتتعمل من فيورا نفسها
 * بتتبعت عنها إيميل فوري لحظة الإنشاء من جوه route المهام مباشرة.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expected = process.env.ROOMS_NOTIFY_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool.request().query(
      `SELECT id, task_text, customer_name, pending_changes, pending_changed_by_name, pending_changed_at
       FROM dbo.[${SOURCE_TABLE}]
       WHERE approval_status = 'pending' AND status = 'open'`
    );

    const pendingItems = result.recordset.map((r: any) => ({
      id: r.id as number,
      taskText: r.task_text as string,
      customerName: (r.customer_name || "").trim() || null,
      isNewTask: !r.pending_changes,
      requestedByName: (r.pending_changed_by_name || "").trim() || null,
    }));

    if (pendingItems.length === 0) {
      return NextResponse.json({ ok: true, newlyNotified: 0 });
    }

    const { data: alreadyNotified } = await supabase
      .from("rooms_notified_pending")
      .select("task_id")
      .in(
        "task_id",
        pendingItems.map((p) => p.id)
      );
    const notifiedIds = new Set((alreadyNotified || []).map((r: any) => r.task_id));

    const newItems = pendingItems.filter((p) => !notifiedIds.has(p.id));
    if (newItems.length === 0) {
      return NextResponse.json({ ok: true, newlyNotified: 0 });
    }

    const title = newItems.length === 1 ? "طلب جديد بانتظار الموافقة" : `${newItems.length} طلبات جديدة بانتظار الموافقة`;
    const body = newItems
      .map((item) => `${item.isNewTask ? "مهمة جديدة" : "طلب تعديل"}${item.requestedByName ? ` — ${item.requestedByName}` : ""}: ${item.taskText}`)
      .join(" | ");

    await sendPushToAllSubscribers(title, body, "/rooms");

    await supabase.from("rooms_notified_pending").insert(newItems.map((item) => ({ task_id: item.id })));

    return NextResponse.json({ ok: true, newlyNotified: newItems.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Notify] فشل:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
