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
