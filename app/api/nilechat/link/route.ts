import { NextResponse } from "next/server";
import { getRoomsPool, sql } from "@/lib/sqlserver";
import { supabaseForToken } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function getAuthToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

/**
 * POST: بيتحقق من access_token اللي المستخدم لصقه (جايبه من صفحة البروفايل بتاعته في NileChat)
 * مقابل جدول NileChat_Users_byA على SQL Server، ولو لقى agent مطابق بيربطه بحساب Viora بتاعه
 * (بيخزن الربط في جدول nilechat_links في Supabase، اللي كل يوزر يشوف صفه بس).
 */
export async function POST(request: Request) {
  const accessToken = getAuthToken(request);
  if (!accessToken) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  let nilechatToken = "";
  try {
    const body = await request.json();
    nilechatToken = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  if (!nilechatToken) {
    return NextResponse.json({ errorCode: "token_required" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool
      .request()
      .input("token", sql.NVarChar, nilechatToken)
      .query(
        `SELECT TOP 1 id, COALESCE(NULLIF(full_name, ''), NULLIF(display_name, '')) AS name
         FROM dbo.[NileChat_Users_byA]
         WHERE access_token = @token AND status = 'active'`
      );

    const row = result.recordset[0];
    if (!row || !row.name) {
      return NextResponse.json({ errorCode: "invalid_token" }, { status: 404 });
    }

    const supabase = supabaseForToken(accessToken);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
    }

    const { error: upsertErr } = await supabase.from("nilechat_links").upsert({
      user_id: user.id,
      access_token: nilechatToken,
      agent_id: row.id,
      agent_name: row.name,
      linked_at: new Date().toISOString(),
    });
    if (upsertErr) throw upsertErr;

    return NextResponse.json({ ok: true, agentId: row.id, agentName: row.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[NileChat Link] فشل الربط:", message);
    return NextResponse.json({ errorCode: "link_failed", detail: message }, { status: 500 });
  }
}

/** DELETE: إلغاء ربط حساب NileChat */
export async function DELETE(request: Request) {
  const accessToken = getAuthToken(request);
  if (!accessToken) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }
  try {
    const supabase = supabaseForToken(accessToken);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
    }
    const { error } = await supabase.from("nilechat_links").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[NileChat Link] فشل إلغاء الربط:", message);
    return NextResponse.json({ errorCode: "unlink_failed", detail: message }, { status: 500 });
  }
}
