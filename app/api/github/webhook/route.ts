import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { hasServiceRole, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ZERO_SHA = /^0{40}$/;

function signatureMatches(raw: string, signature: string, secret: string): boolean {
  if (!signature.startsWith("sha256=")) return false;
  const digest = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type PushCommit = {
  id?: string;
  message?: string;
  timestamp?: string;
  author?: { name?: string; email?: string } | null;
};

type PushPayload = {
  ref?: string;
  before?: string;
  after?: string;
  repository?: { id?: number; html_url?: string; default_branch?: string } | null;
  commits?: PushCommit[] | null;
};

/**
 * مستقبِل Webhook جيت هب (push). بيحقق التوقيع بـ GITHUB_WEBHOOK_SECRET وبعدين
 * يخزّن عناوين الكوميتات في github_commits، والواجهة بتعرضها في عمود Done.
 */
export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !hasServiceRole()) {
    return NextResponse.json({ errorCode: "not_configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-hub-signature-256") || "";
  const raw = await request.text();
  if (!signature || !signatureMatches(raw, signature, secret)) {
    return NextResponse.json({ errorCode: "invalid_signature" }, { status: 401 });
  }

  if ((request.headers.get("x-github-event") || "") !== "push") {
    return NextResponse.json({ ignored: true });
  }

  let payload: PushPayload;
  try {
    payload = JSON.parse(raw) as PushPayload;
  } catch {
    return NextResponse.json({ errorCode: "invalid_payload" }, { status: 400 });
  }

  const repoGithubId = payload.repository?.id;
  const commits = payload.commits || [];
  const branch = (payload.ref || "").replace("refs/heads/", "") || null;
  if (!repoGithubId || !commits.length || ZERO_SHA.test(payload.after || "")) {
    return NextResponse.json({ stored: 0 });
  }

  const supabase = supabaseAdmin();
  const { data: link, error: linkError } = await supabase
    .from("github_repos")
    .select("id, project_id")
    .eq("repo_id", repoGithubId)
    .maybeSingle();
  if (linkError || !link) return NextResponse.json({ stored: 0 });

  const repoUrl = payload.repository?.html_url || "";
  const rows = commits
    .filter((c) => c.id)
    .map((c) => ({
      repo_row: link.id,
      project_id: link.project_id,
      sha: c.id as string,
      title: (c.message || "").split("\n")[0].trim() || (c.id as string).slice(0, 7),
      author_name: c.author?.name || null,
      branch,
      html_url: repoUrl ? `${repoUrl}/commit/${c.id}` : null,
      committed_at: c.timestamp || new Date().toISOString(),
    }));

  const { error } = await supabase
    .from("github_commits")
    .upsert(rows, { onConflict: "repo_row,sha", ignoreDuplicates: true });
  if (error) return NextResponse.json({ errorCode: "storage_failed" }, { status: 500 });

  await supabase.from("github_repos").update({ synced_at: new Date().toISOString() }).eq("id", link.id);
  return NextResponse.json({ stored: rows.length });
}
