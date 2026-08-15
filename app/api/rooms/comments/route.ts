import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool, sql } from "@/lib/sqlserver";

export const dynamic = "force-dynamic";

const COMMENTS_TABLE = "NileChat_TaskComments_byA";

function requireSession() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  return verifyRoomsSessionToken(token);
}

/** GET /api/rooms/comments?taskId=123 : كل كومنتات مهمة معينة */
export async function GET(request: Request) {
  if (!requireSession()) {
    return NextResponse.json({ errorCode: "session_required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = Number(searchParams.get("taskId"));
  if (!taskId) {
    return NextResponse.json({ errorCode: "task_id_required" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool
      .request()
      .input("taskId", sql.BigInt, taskId)
      .query(
        `SELECT id, task_id, comment_text, created_by_name, created_at
         FROM dbo.[${COMMENTS_TABLE}]
         WHERE task_id = @taskId
         ORDER BY created_at ASC`
      );
    const comments = result.recordset.map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      commentText: r.comment_text as string,
      createdByName: (r.created_by_name || "").trim() || null,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    }));
    return NextResponse.json({ comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Comments] فشل القراءة:", message);
    return NextResponse.json({ errorCode: "load_failed", detail: message }, { status: 500 });
  }
}

/**
 * POST: بيضيف كومنت جديد على مهمة. created_by_id/created_by_name لازم يكونوا agent حقيقي
 * في NileChat - بيتبعتوا من الفرونت بعد ما اليوزر يربط حسابه (nilechat_links في Supabase).
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

  const taskId = Number(body?.taskId);
  const commentText = typeof body?.commentText === "string" ? body.commentText.trim() : "";
  const createdById = body?.createdById != null ? Number(body.createdById) : null;
  const createdByName = typeof body?.createdByName === "string" ? body.createdByName.trim() : null;

  if (!taskId || !commentText) {
    return NextResponse.json({ errorCode: "missing_fields" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();
    const result = await pool
      .request()
      .input("taskId", sql.BigInt, taskId)
      .input("commentText", sql.NVarChar(sql.MAX), commentText)
      .input("createdById", sql.BigInt, createdById)
      .input("createdByName", sql.NVarChar(200), createdByName)
      .query(
        `INSERT INTO dbo.[${COMMENTS_TABLE}] (task_id, comment_text, created_by_id, created_by_name)
         OUTPUT INSERTED.id, INSERTED.created_at
         VALUES (@taskId, @commentText, @createdById, @createdByName)`
      );

    const row = result.recordset[0];
    return NextResponse.json({
      ok: true,
      comment: {
        id: row.id,
        taskId,
        commentText,
        createdByName,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Comments] فشل الإضافة:", message);
    return NextResponse.json({ errorCode: "create_failed", detail: message }, { status: 500 });
  }
}
