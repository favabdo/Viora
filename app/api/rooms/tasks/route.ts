import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";
import { getRoomsPool } from "@/lib/sqlserver";
import { detectColumns, parseDone, cleanText, SOURCE_TABLE, sql, ScheduledTaskDTO } from "@/lib/scheduledTasks";

export const dynamic = "force-dynamic";

function requireSession() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  return verifyRoomsSessionToken(token);
}

/**
 * GET: بيقرا كل صفوف NileChat_ScheduledTasks_byA مباشرة من SQL Server (مفيش أي كتابة/قراءة في Supabase هنا خالص)
 * وبيرجعها متحولة لشكل تاسك بسيط: نص المهمة، مين أنشأها، مين اتسندت له، وهل خلصت ولا لأ.
 */
export async function GET() {
  if (!requireSession()) {
    return NextResponse.json({ error: "محتاج تدخل كلمة مرور Rooms الأول" }, { status: 401 });
  }

  try {
    const pool = await getRoomsPool();
    const { columns, detected } = await detectColumns(pool);

    if (!detected.text || !detected.id) {
      return NextResponse.json(
        {
          error:
            "مقدرتش أحدد عمود نص المهمة أو عمود الـ id تلقائيًا. شوف أسماء الأعمدة تحت وابعتهملي عشان أظبط المطابقة.",
          columns,
          detected,
        },
        { status: 422 }
      );
    }

    const result = await pool.request().query(`SELECT * FROM dbo.[${SOURCE_TABLE}]`);
    const tasks: ScheduledTaskDTO[] = result.recordset.map((row: Record<string, unknown>) => ({
      id: String(row[detected.id as string]),
      createdBy: detected.createdBy ? cleanText(row[detected.createdBy], "غير معروف") : "غير معروف",
      assignedTo: detected.assignedTo ? cleanText(row[detected.assignedTo], "غير معروف") : "غير معروف",
      text: cleanText(row[detected.text as string], "بدون نص"),
      done: detected.done ? parseDone(row[detected.done]) : false,
    }));

    return NextResponse.json({
      tasks,
      // بنرجّع ده عشان الفرونت يعرف يفعّل/يعطّل التعديل (checkbox) - شغال لو العمود رقمي، أو نصي وعرفنا قيمتيه (زي Open/Ended)
      doneEditable: detected.doneIsBoolean || Boolean(detected.doneTrueValue && detected.doneFalseValue),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Tasks] فشل القراءة:", message);
    return NextResponse.json({ error: "فشل قراءة المهام من قاعدة بيانات Rooms: " + message }, { status: 500 });
  }
}

/**
 * PATCH: بيحدّث حالة "خلصت/معلقة" لمهمة معينة مباشرة في SQL Server (UPDATE على الجدول الأصلي نفسه).
 * بيشتغل بس لو عمود الحالة نوعه رقمي/bit (يعني قيمة true/false واضحة ومضمونة).
 * لو عمود الحالة نص (زي "Completed"/"Pending") مش هنعدله تلقائي عشان مش عارفين القيم بالظبط
 * المستخدمة عندك، وهنرجّع خطأ واضح بدل ما نخمّن ونكسر بيانات حقيقية.
 */
export async function PATCH(request: Request) {
  if (!requireSession()) {
    return NextResponse.json({ error: "محتاج تدخل كلمة مرور Rooms الأول" }, { status: 401 });
  }

  let id = "";
  let done = false;
  try {
    const body = await request.json();
    id = typeof body?.id === "string" || typeof body?.id === "number" ? String(body.id) : "";
    done = Boolean(body?.done);
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "id المهمة مطلوب" }, { status: 400 });
  }

  try {
    const pool = await getRoomsPool();
    const { detected } = await detectColumns(pool);

    if (!detected.id || !detected.done) {
      return NextResponse.json({ error: "عمود الحالة أو الـ id مش متعرف عليهم" }, { status: 422 });
    }

    if (detected.doneIsBoolean) {
      await pool
        .request()
        .input("id", sql.NVarChar, id)
        .input("done", sql.Bit, done)
        .query(`UPDATE dbo.[${SOURCE_TABLE}] SET [${detected.done}] = @done WHERE [${detected.id}] = @id`);
    } else if (detected.doneTrueValue && detected.doneFalseValue) {
      // عمود نصي (زي Status = Open/Ended) وعرفنا القيمتين الحقيقيتين المخزنتين في الجدول
      const value = done ? detected.doneTrueValue : detected.doneFalseValue;
      await pool
        .request()
        .input("id", sql.NVarChar, id)
        .input("value", sql.NVarChar, value)
        .query(`UPDATE dbo.[${SOURCE_TABLE}] SET [${detected.done}] = @value WHERE [${detected.id}] = @id`);
    } else {
      return NextResponse.json(
        {
          error: `عمود الحالة (${detected.done}) نوعه ${detected.doneDataType} ومقدرتش أحدد القيم الفعلية اللي بتستخدمها (زي Open/Ended) من الداتا الموجودة. قولي القيم بالظبط.`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Rooms Tasks] فشل التحديث:", message);
    return NextResponse.json({ error: "فشل تحديث المهمة في قاعدة بيانات Rooms: " + message }, { status: 500 });
  }
}
