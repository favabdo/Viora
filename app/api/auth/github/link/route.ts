import { NextResponse } from "next/server";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseForToken } from "@/lib/supabaseServer";
import { fetchGithubIdentity } from "@/lib/githubAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

/**
 * بيخزّن توكن جيت هب على حساب المستخدم اللي طالب الربط نفسه (app_metadata)،
 * فجلسة مسجّلة بالجيميل على حساب مرتبط بجيت هب تلاقي التوكن وتقدر تسحب
 * الريبوز من غير ما المستخدم يتسجّل خروج أو يبدّل حساب.
 */
export async function POST(request: Request) {
  const accessToken = bearer(request);
  if (!accessToken || !hasServiceRole()) {
    return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const caller = supabaseForToken(accessToken);
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  let githubToken = "";
  try {
    const body = (await request.json()) as { github_token?: unknown };
    githubToken = typeof body?.github_token === "string" ? body.github_token.trim() : "";
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  if (!githubToken) return NextResponse.json({ errorCode: "token_required" }, { status: 400 });

  // التوكن بيتحقق عند جيت هب نفسه، فمفيش حساب بياخد توكن حساب تاني
  const identity = await fetchGithubIdentity(githubToken);
  if (!identity) return NextResponse.json({ errorCode: "invalid_github_token" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      github_id: String(identity.id),
      github_login: identity.login,
      github_token: githubToken,
    },
  });
  if (error) {
    console.error("[github/link] updateUserById failed", user.id, error.code, error.message);
    return NextResponse.json(
      { errorCode: "store_failed", reason: error.message || error.code || "update_user_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, login: identity.login });
}
