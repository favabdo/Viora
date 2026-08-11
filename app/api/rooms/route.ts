import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool, sql } from "@/lib/sqlserver";

export const dynamic = "force-dynamic";

function requireSession() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  return verifyRoomsSessionToken(token);
}

/**
 * دلوقتي بس بنتأكد إن الاتصال بـ SQL Server شغال (خطوة "طريقة الاتصال").
 * لما تحدد اسم الجدول/الأعمدة بتاعة Rooms هنبدّل الكويري دي بـ SELECT حقيقي على الجدول.
 */
export async function GET() {
  if (!requireSession()) {
    return NextResponse.json({ error: "محتاج تدخل كلمة مرور Rooms الأول" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool.request().query<{ serverTime: Date; dbName: string }>(
      "SELECT GETDATE() AS serverTime, DB_NAME() AS dbName"
    );
    const row = result.recordset[0];
    return NextResponse.json({
      connected: true,
      serverTime: row?.serverTime,
      database: row?.dbName,
    });
  } catch (err) {
    console.error("Rooms SQL Server connection error:", err);
    return NextResponse.json(
      { connected: false, error: "فشل الاتصال بقاعدة بيانات Rooms. راجع بيانات الاتصال في متغيرات البيئة." },
      { status: 500 }
    );
  }
}
