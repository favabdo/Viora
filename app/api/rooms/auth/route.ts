import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRoomsSessionToken, ROOMS_COOKIE_MAX_AGE, ROOMS_COOKIE_NAME, verifyRoomsSessionToken } from "@/lib/roomsAuth";

export const dynamic = "force-dynamic";

/** بيرجع هل اليوزر فاتح سيشن Rooms صالح دلوقتي ولا لأ (تستخدم لما الصفحة تفتح عشان ماتسألوش تاني لو معاه كوكي سليم) */
export async function GET() {
  const token = cookies().get(ROOMS_COOKIE_NAME)?.value;
  return NextResponse.json({ unlocked: verifyRoomsSessionToken(token) });
}

/** بيتأكد من الباسورد المدخل مقابل ROOMS_PASSWORD في متغيرات البيئة، ولو صح بيفتح سيشن */
export async function POST(request: Request) {
  const roomsPassword = process.env.ROOMS_PASSWORD;
  if (!roomsPassword) {
    return NextResponse.json({ errorCode: "not_configured" }, { status: 500 });
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (password !== roomsPassword) {
    return NextResponse.json({ errorCode: "wrong_password" }, { status: 401 });
  }

  const token = createRoomsSessionToken();
  cookies().set(ROOMS_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ROOMS_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ unlocked: true });
}

/** تسجيل خروج من سيكشن Rooms (مسح الكوكي) */
export async function DELETE() {
  cookies().delete(ROOMS_COOKIE_NAME);
  return NextResponse.json({ unlocked: false });
}
