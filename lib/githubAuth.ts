import { supabaseAdmin } from "./supabaseAdmin";

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "viora-app",
};

export type GithubIdentity = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  html_url: string | null;
};

/**
 * البريد الوهمي اللي بيحمل حساب فيورا المخصص لحساب جيت هب.
 * ".invalid" محجوز في RFC 6761 ومستحيل يبقى إيميل حقيقي، فما يحصلش تصادم
 * مع حساب مسجل بالبريد — وده اللي بيمنع Supabase إنه يدمج حسابات جيت هب
 * في حسابات الإيميل اللي بتشارك نفس العنوان.
 */
export function githubVirtualEmail(login: string): string {
  return `${login.toLowerCase().replace(/[^a-z0-9_]/g, "_")}@github.viora.invalid`;
}

export async function fetchGithubIdentity(accessToken: string): Promise<GithubIdentity | null> {
  const res = await fetch("https://api.github.com/user", { headers: { ...GH_HEADERS, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const user = (await res.json()) as Partial<GithubIdentity>;
  if (!user?.id || !user?.login) return null;
  return {
    id: user.id,
    login: user.login,
    name: user.name ?? null,
    avatar_url: user.avatar_url ?? null,
    html_url: user.html_url ?? null,
  };
}

export type IsolatedSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
};

type LinkType = "magiclink" | "invite";

export type MintResult =
  | { session: IsolatedSession }
  | { session: null; reason: string };

/**
 * بيضمن وجود حساب فيورا مستقل لهُوية جيت هب وبيرجّع جلسة بتاعته هو:
 * يولّد رابط دخول (بيُنشئ الحساب لو أول مرة) بالبريد الوهمي، يسجّل هُوية
 * جيت هب وتوكنه في app_metadata، وبعدين يتحقق من الرابط ويستلم الجلسة.
 * بيجرّب نوعين من الروابط لأن المشاريع بتختلف في تدفقات البريد المفعّلة.
 */
export async function mintGithubSession(
  identity: GithubIdentity,
  githubToken: string,
  verify: (tokenHash: string, type: LinkType) => Promise<IsolatedSession | null>
): Promise<MintResult> {
  const admin = supabaseAdmin();
  const email = githubVirtualEmail(identity.login);
  let reason = "no_link_type_available";

  const options = {
    data: {
      username: identity.login,
      full_name: identity.name || identity.login,
      avatar_url: identity.avatar_url,
    },
  };

  // GenerateLinkParams اتحاد بأنواع حرفية، فكل فرع بينادي بالمفتاح بتاعه صراحة
  const generateLinkFor = (type: LinkType) =>
    type === "magiclink"
      ? admin.auth.admin.generateLink({ type: "magiclink", email, options })
      : admin.auth.admin.generateLink({ type: "invite", email, options });

  for (const type of ["magiclink", "invite"] as LinkType[]) {
    const { data: link, error: linkError } = await generateLinkFor(type);

    if (linkError || !link?.properties?.hashed_token || !link.user) {
      reason = linkError?.message || "link_missing_token";
      continue;
    }

    await admin.auth.admin.updateUserById(link.user.id, {
      app_metadata: {
        provider: "github",
        provider_id: String(identity.id),
        user_name: identity.login,
        full_name: identity.name || identity.login,
        avatar_url: identity.avatar_url,
        github_token: githubToken,
      },
      user_metadata: {
        username: identity.login,
        full_name: identity.name || identity.login,
        avatar_url: identity.avatar_url,
      },
    });

    const session = await verify(link.properties.hashed_token, type);
    if (session) return { session };
    reason = `verify_failed:${type}`;
  }

  return { session: null, reason };
}
