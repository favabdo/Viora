import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool, sql } from "@/lib/sqlserver";

export const dynamic = "force-dynamic";

/** GET /api/rooms/contacts?q=... : بحث عن عملاء من NileChat_Contacts_byA (لاختيار العميل وقت إنشاء مهمة جديدة) */
export async function GET(request: Request) {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  if (!verifyRoomsSessionToken(token)) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  try {
    const pool = await getRoomsPool();
    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${q}%`)
      .query(
        `SELECT TOP 20 id, name
         FROM dbo.[NileChat_Contacts_byA]
         WHERE is_inactive = 0 AND (@q = '%%' OR name LIKE @q)
         ORDER BY name`
      );
    const contacts = result.recordset
      .filter((r: any) => r.name)
      .map((r: any) => ({ id: r.id, name: r.name as string }));
    return NextResponse.json({ contacts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Contacts] فشل البحث:", message);
    return NextResponse.json({ errorCode: "load_failed", detail: message }, { status: 500 });
  }
}
