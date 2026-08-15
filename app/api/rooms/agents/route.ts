import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool } from "@/lib/sqlserver";

export const dynamic = "force-dynamic";

/** GET: ليستة agents نشطين من NileChat_Users_byA، تُستخدم في قائمة "إسناد التاسك لمين" */
export async function GET() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  if (!verifyRoomsSessionToken(token)) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool.request().query(
      `SELECT id, COALESCE(NULLIF(full_name, ''), NULLIF(display_name, '')) AS name
       FROM dbo.[NileChat_Users_byA]
       WHERE status = 'active'
       ORDER BY name`
    );
    const agents = result.recordset
      .filter((r: any) => r.name)
      .map((r: any) => ({ id: r.id, name: r.name as string }));
    return NextResponse.json({ agents });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Agents] فشل القراءة:", message);
    return NextResponse.json({ errorCode: "load_failed", detail: message }, { status: 500 });
  }
}
