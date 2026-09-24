import { supabase } from "./supabase";
import { countUserProjects, getMyPlan, limitsFor } from "./planUsage";

const GITHUB_API = "https://api.github.com";

export type GithubRepoSummary = {
  repo_id: number;
  full_name: string;
  owner_login: string;
  repo_name: string;
  html_url: string;
  default_branch: string;
  is_private: boolean;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
};

export type LinkedRepo = GithubRepoSummary & {
  id: string;
  project_id: string;
  user_id: string;
  webhook_id: number | null;
};

export type GithubCommit = {
  id: string;
  sha: string;
  title: string;
  author_name: string | null;
  author_login: string | null;
  branch: string | null;
  html_url: string | null;
  committed_at: string;
  repo_row: string;
  github_repos: { repo_name: string; full_name: string; default_branch: string; html_url: string } | null;
};

type RawRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string | null;
  language: string | null;
  pushed_at: string | null;
  owner?: { login?: string } | null;
};

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** بيوت GitHub جوه سيشن Supabase — موجود بس لو المستخدم داخل بجيت هب */
export async function getGithubToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.provider_token || null;
}

export async function getGithubLogin(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;
  const meta = session.user.app_metadata || {};
  if (meta.provider !== "github") return null;
  return (meta.user_name as string) || null;
}

export async function isGithubUser(): Promise<boolean> {
  return (await getGithubLogin()) !== null;
}

/** ريبوز المستخدم (العامة والخاصة) مرتبة بالأحدث نشاطًا */
export async function fetchGithubRepos(): Promise<GithubRepoSummary[]> {
  const token = await getGithubToken();
  if (!token) return [];

  const repos: GithubRepoSummary[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner`,
      { headers: ghHeaders(token) }
    );
    if (!res.ok) break;
    const rows = (await res.json()) as RawRepo[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      repos.push({
        repo_id: r.id,
        full_name: r.full_name,
        owner_login: r.owner?.login || r.full_name.split("/")[0],
        repo_name: r.name,
        html_url: r.html_url,
        default_branch: r.default_branch || "main",
        is_private: !!r.private,
        description: r.description ?? null,
        language: r.language ?? null,
        pushed_at: r.pushed_at ?? null,
      });
    }
    if (rows.length < 100) break;
  }
  return repos;
}

/** المشاريع المستوردة فعلًا عشان نستبعدها من القائمة */
export async function listLinkedRepos(): Promise<LinkedRepo[]> {
  const { data } = await supabase
    .from("github_repos")
    .select("id, user_id, project_id, repo_id, full_name, owner_login, repo_name, html_url, default_branch, is_private, description, language, webhook_id")
    .order("created_at", { ascending: false });
  return (data as LinkedRepo[]) || [];
}

/**
 * عدد المشاريع المتاحة على الخطة الحالية.
 * null = بلا حد (pro/team)، غير كده عدد الاختيارات المتاحة دلوقتي.
 */
export async function getRepoSlots(): Promise<number | null> {
  const plan = await getMyPlan();
  const cap = limitsFor(plan).projects;
  if (cap === null) return null;
  const used = await countUserProjects();
  return Math.max(0, cap - used);
}

type CommitPayload = {
  repo_row: string;
  project_id: string;
  sha: string;
  title: string;
  author_name: string | null;
  author_login: string | null;
  branch: string | null;
  html_url: string | null;
  committed_at: string;
};

function toCommits(
  rows: Array<{ sha: string; commit?: { message?: string; author?: { name?: string; date?: string } }; html_url?: string; author?: { login?: string } }>,
  repo: LinkedRepo
): CommitPayload[] {
  return rows
    .filter((c) => c.sha)
    .map((c) => ({
      repo_row: repo.id,
      project_id: repo.project_id,
      sha: c.sha,
      title: (c.commit?.message || "").split("\n")[0].trim() || c.sha.slice(0, 7),
      author_name: c.commit?.author?.name ?? null,
      author_login: c.author?.login ?? null,
      branch: repo.default_branch,
      html_url: c.html_url || `${repo.html_url}/commit/${c.sha}`,
      committed_at: c.commit?.author?.date || new Date().toISOString(),
    }));
}

/** سحب الكوميتات من جيت هب وتخزينها — بيشتغل من غير الـ webhook */
export async function syncRepoCommits(repo: LinkedRepo, perPage = 20): Promise<number> {
  const token = await getGithubToken();
  if (!token) return 0;
  const res = await fetch(
    `${GITHUB_API}/repos/${repo.full_name}/commits?sha=${encodeURIComponent(repo.default_branch)}&per_page=${perPage}`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const { error } = await supabase
    .from("github_commits")
    .upsert(toCommits(rows, repo), { onConflict: "repo_row,sha", ignoreDuplicates: true });
  if (error) return 0;
  await supabase.from("github_repos").update({ synced_at: new Date().toISOString() }).eq("id", repo.id);
  return rows.length;
}

export async function listProjectCommits(projectId: string, limit = 60): Promise<GithubCommit[]> {
  const { data } = await supabase
    .from("github_commits")
    .select("id, sha, title, author_name, author_login, branch, html_url, committed_at, repo_row, github_repos(repo_name, full_name, default_branch, html_url)")
    .eq("project_id", projectId)
    .order("committed_at", { ascending: false })
    .limit(limit);
  const rows = (data as unknown as GithubCommit[]) || [];
  return rows
    .filter((row) => !row.branch || !row.github_repos || row.branch === row.github_repos.default_branch)
    .map((row) => ({ ...row, sha: row.sha.slice(0, 7) }));
}

export type ImportResult = { created: LinkedRepo[]; failed: string[] };

/**
 * استيراد ريبوز كمشاريع: ينشئ المشروع، يربطه بالريبو، يعمل Webhook، ويجيب آخر الكوميتات.
 * slots = حد الاختيارات اللي الواجهة اتفقت عليه مع خطة المستخدم.
 */
export async function importRepos(repos: GithubRepoSummary[], slots: number | null): Promise<ImportResult> {
  const created: LinkedRepo[] = [];
  const failed: string[] = [];

  for (const repo of repos) {
    if (slots !== null && created.length >= slots) break;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({ name: repo.repo_name })
      .select()
      .single();
    if (projectError || !project) {
      failed.push(repo.full_name);
      continue;
    }

    const { data: link, error: linkError } = await supabase
      .from("github_repos")
      .insert({
        project_id: project.id,
        repo_id: repo.repo_id,
        full_name: repo.full_name,
        owner_login: repo.owner_login,
        repo_name: repo.repo_name,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        is_private: repo.is_private,
        description: repo.description,
        language: repo.language,
      })
      .select()
      .single();
    if (linkError || !link) {
      await supabase.from("projects").delete().eq("id", project.id);
      failed.push(repo.full_name);
      continue;
    }

    const row = { ...(link as LinkedRepo), ...repo };
    created.push(row);
    void syncRepoCommits(row);
  }

  if (created.length) {
    const token = await getGithubToken();
    if (token) {
      try {
        await fetch("/api/github/hooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            repos: created.map((r) => ({ id: r.id, full_name: r.full_name })),
          }),
        });
      } catch {
        // الـ webhook اختياري: المزامنة اليدوية شغالة بدونه
      }
    }
  }

  return { created, failed };
}

/** فك ربط ريبو — بيحذف المشروع تبعها لو ماحدش تاني لسه شالها */
export async function unlinkRepo(repo: LinkedRepo, deleteProject: boolean): Promise<boolean> {
  if (repo.webhook_id) {
    const token = await getGithubToken();
    if (token) {
      try {
        await fetch("/api/github/hooks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            repos: [{ id: repo.id, full_name: repo.full_name, webhook_id: repo.webhook_id }],
          }),
        });
      } catch {
        // كمّل الحذف المحلي حتى لو جيت هب ماردش
      }
    }
  }

  const { error } = await supabase.from("github_repos").delete().eq("id", repo.id);
  if (error) return false;
  if (deleteProject) await supabase.from("projects").delete().eq("id", repo.project_id);
  return true;
}
