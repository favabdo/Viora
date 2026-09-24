import { NextRequest, NextResponse } from "next/server";
import { supabaseForToken } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "viora-app",
};

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

async function callerId(token: string | null) {
  if (!token) return null;
  const supabase = supabaseForToken(token);
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function parseBody(body: unknown) {
  const data = body as {
    token?: unknown;
    repos?: Array<{ id?: unknown; full_name?: unknown; webhook_id?: unknown }>;
  } | null;
  const ghToken = typeof data?.token === "string" ? data.token.trim() : "";
  const repos = Array.isArray(data?.repos)
    ? data.repos
        .map((r) => ({
          id: typeof r?.id === "string" ? r.id : "",
          full_name: typeof r?.full_name === "string" ? r.full_name.trim() : "",
          webhook_id: typeof r?.webhook_id === "number" ? r.webhook_id : null,
        }))
        .filter((r) => r.id && r.full_name.includes("/"))
    : [];
  return { ghToken, repos };
}

/**
 * POST: يخلق Webhook push على كل ريبو مستوردة عشان الكوميتات توصل لحظيًا.
 * توكن جيت هب بييجي من الجلسة ويستخدم هنا مرة واحدة بس ولا يُخزَّن في القاعدة.
 */
export async function POST(request: NextRequest) {
  const userId = await callerId(bearer(request));
  if (!userId) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ errorCode: "webhook_not_configured" }, { status: 500 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const { ghToken, repos } = parseBody(body);
  if (!ghToken || !repos.length) return NextResponse.json({ errorCode: "repos_required" }, { status: 400 });

  const endpoint = `${request.nextUrl.origin}/api/github/webhook`;
  const supabase = supabaseForToken(bearer(request) as string);
  const linked: Record<string, number> = {};
  const failed: string[] = [];

  for (const repo of repos) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo.full_name}/hooks`, {
        method: "POST",
        headers: { ...GH_HEADERS, Authorization: `Bearer ${ghToken}` },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["push"],
          config: { url: endpoint, content_type: "json", secret, insecure_ssl: "0" },
        }),
      });
      if (!res.ok) {
        failed.push(repo.full_name);
        continue;
      }
      const hook = (await res.json()) as { id?: number };
      if (typeof hook.id === "number") linked[repo.id] = hook.id;
    } catch {
      failed.push(repo.full_name);
    }
  }

  await Promise.all(
    Object.entries(linked).map(([id, webhookId]) =>
      supabase.from("github_repos").update({ webhook_id: webhookId }).eq("id", id).eq("user_id", userId)
    )
  );

  return NextResponse.json({ linked, failed });
}

/** DELETE: يشيل الـ Webhook من جيت هب قبل فك الربط */
export async function DELETE(request: Request) {
  const accessToken = bearer(request);
  const userId = await callerId(accessToken);
  if (!userId) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const { ghToken, repos } = parseBody(body);
  if (!ghToken || !repos.length) return NextResponse.json({ errorCode: "repos_required" }, { status: 400 });

  const supabase = supabaseForToken(accessToken as string);
  let removed = 0;

  for (const repo of repos) {
    if (!repo.webhook_id) continue;
    try {
      await fetch(`https://api.github.com/repos/${repo.full_name}/hooks/${repo.webhook_id}`, {
        method: "DELETE",
        headers: { ...GH_HEADERS, Authorization: `Bearer ${ghToken}` },
      });
      removed += 1;
    } catch {
      // توتال: الحذف المحلي بيتمّى برضه
    }
    await supabase.from("github_repos").update({ webhook_id: null }).eq("id", repo.id).eq("user_id", userId);
  }

  return NextResponse.json({ removed });
}
