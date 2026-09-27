import { NextResponse } from "next/server";
import { hasServiceRole } from "@/lib/supabaseAdmin";
import { supabaseForToken, supabasePublic } from "@/lib/supabaseServer";
import { fetchGithubIdentity, mintGithubSession, type IsolatedSession } from "@/lib/githubAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

/**
 * بياخد توكن جيت هب من جلسة OAuth الحالية ويرجّع جلسة لحساب فيورا المخصص
 * لهُوية جيت هب دي — لو تسجيل الدخول اتدمج في حساب إيميل بنفس العنوان.
 * التوكن بيتحقق منه عند جيت هب، فالردّ دايماً جلسة الحساب اللي تطابق التوكن نفسه.
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
  if (user.app_metadata?.provider === "github") {
    return NextResponse.json({ noop: true });
  }

  let githubToken = "";
  try {
    const body = (await request.json()) as { github_token?: unknown };
    githubToken = typeof body?.github_token === "string" ? body.github_token.trim() : "";
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  if (!githubToken) return NextResponse.json({ errorCode: "token_required" }, { status: 400 });

  const identity = await fetchGithubIdentity(githubToken);
  if (!identity) return NextResponse.json({ errorCode: "invalid_github_token" }, { status: 400 });

  const publicClient = supabasePublic();
  const result = await mintGithubSession(identity, githubToken, async (tokenHash, type) => {
    const { data, error } = await publicClient.auth.verifyOtp({
      type: type === "invite" ? "invite" : "magiclink",
      token_hash: tokenHash,
    });
    if (error || !data.session) return null;
    const out: IsolatedSession = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    };
    return out;
  });

  if (!result.session) {
    return NextResponse.json({ errorCode: "isolation_failed", reason: result.reason }, { status: 500 });
  }
  return NextResponse.json(result.session);
}
