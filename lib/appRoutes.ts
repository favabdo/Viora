export const APP_NAV = [
  "dashboard",
  "projects",
  "calendar",
  "ideas",
  "timeline",
  "files",
  "links",
  "reports",
  "rooms",
] as const;

export type AppNavId = (typeof APP_NAV)[number];

export const HOME_PATH = "/dashboard";

export const WORKSPACE_VIEWS = ["board", "list", "calendar", "timeline", "files", "history", "settings"] as const;
export type WorkspaceView = (typeof WORKSPACE_VIEWS)[number];

export function navIdFromPath(pathname: string): string {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/home")) return "dashboard";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/ideas")) return "ideas";
  if (pathname.startsWith("/timeline")) return "timeline";
  if (pathname.startsWith("/files")) return "files";
  if (pathname.startsWith("/links")) return "links";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/rooms")) return "rooms";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}

export function pathForNav(id: string) {
  if (id === "settings") return "/settings";
  return `/${id}`;
}

export function isWorkspaceView(value: string): value is WorkspaceView {
  return (WORKSPACE_VIEWS as readonly string[]).includes(value);
}

export function projectPath(projectId: string, view: WorkspaceView = "board") {
  return `/projects/${projectId}/${view}`;
}

export function ideaPath(ideaId?: string | null) {
  return ideaId ? `/ideas/${ideaId}` : "/ideas";
}
