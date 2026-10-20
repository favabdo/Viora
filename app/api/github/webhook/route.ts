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

type IssuePayload = {
  action?: string;
  issue?: {
    number?: number;
    title?: string | null;
    state?: string;
    html_url?: string;
    pull_request?: unknown;
    user?: { login?: string; avatar_url?: string } | null;
    created_at?: string;
    updated_at?: string;
  } | null;
  repository?: { id?: number; html_url?: string } | null;
};

/**
 * مستقبِل Webhook جيت هب (push + issues). بيحقق التوقيع بـ GITHUB_WEBHOOK_SECRET
 * بعدين يخزّن الكوميتات في github_commits (عمود Done) والإيشوز في github_issues
 * (عمود To Do) من غير ما المستخدم يضغط مزامنة.
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

  const event = request.headers.get("x-github-event") || "";
  if (event !== "push" && event !== "issues") {
    return NextResponse.json({ ignored: true });
  }

  let payload: PushPayload | IssuePayload;
  try {
    payload = JSON.parse(raw) as PushPayload | IssuePayload;
  } catch {
    return NextResponse.json({ errorCode: "invalid_payload" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  if (event === "issues") {
    const data = payload as IssuePayload;
    const repoGithubId = data.repository?.id;
    const issue = data.issue;
    const number = issue?.number;
    // إيشوز مش مرتبطة بمشروع مستورد أو بتاعة PR: اتجاهلها
    if (!repoGithubId || !number || issue?.pull_request) return NextResponse.json({ stored: 0 });

    const { data: link, error: linkError } = await supabase
      .from("github_repos")
      .select("id, project_id")
      .eq("repo_id", repoGithubId)
      .maybeSingle();
    if (linkError || !link) return NextResponse.json({ stored: 0 });

    if (data.action === "deleted") {
      await supabase
        .from("github_issues")
        .delete()
        .eq("repo_row", link.id)
        .eq("issue_number", number);
      return NextResponse.json({ stored: 1 });
    }

    const row = {
      repo_row: link.id,
      project_id: link.project_id,
      issue_number: number,
      title: (issue?.title || "").trim() || `#${number}`,
      state: "open",
      author_login: issue?.user?.login ?? null,
      avatar_url: issue?.user?.avatar_url ?? null,
      html_url: issue?.html_url || null,
      opened_at: issue?.created_at || new Date().toISOString(),
      updated_at: issue?.updated_at || new Date().toISOString(),
      pulled_at: new Date().toISOString(),
    };
    if (data.action === "closed") {
      // قفل الإيشو = يختفي من To Do
      await supabase
        .from("github_issues")
        .delete()
        .eq("repo_row", link.id)
        .eq("issue_number", number);
      return NextResponse.json({ stored: 1 });
    }

    const { error } = await supabase.from("github_issues").upsert(row, { onConflict: "repo_row,issue_number" });
    if (error) return NextResponse.json({ errorCode: "storage_failed" }, { status: 500 });
    return NextResponse.json({ stored: 1 });
  }

  const push = payload as PushPayload;
  const repoGithubId = push.repository?.id;
  const commits = push.commits || [];
  const branch = (push.ref || "").replace("refs/heads/", "") || null;
  if (!repoGithubId || !commits.length || ZERO_SHA.test(push.after || "")) {
    return NextResponse.json({ stored: 0 });
  }

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
