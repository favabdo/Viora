import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** POST: يسجّل اشتراك Push جديد لهذا الجهاز/المتصفح */
export async function POST(request: Request) {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  if (!verifyRoomsSessionToken(token)) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const endpoint = body?.endpoint as string;
    const p256dh = body?.keys?.p256dh as string;
    const auth = body?.keys?.auth as string;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
    }

    const { error } = await supabase.from("push_subscriptions").upsert({ endpoint, p256dh, auth }, { onConflict: "endpoint" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Push Subscribe] فشل:", message);
    return NextResponse.json({ errorCode: "subscribe_failed", detail: message }, { status: 500 });
  }
}

/** DELETE: إلغاء اشتراك Push لهذا الجهاز */
export async function DELETE(request: Request) {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  if (!verifyRoomsSessionToken(token)) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const endpoint = body?.endpoint as string;
    if (!endpoint) return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ errorCode: "unsubscribe_failed", detail: message }, { status: 500 });
  }
}
