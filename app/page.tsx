import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/appRoutes";

const TAB_PATHS: Record<string, string> = {
  dashboard: "/dashboard",
  home: "/dashboard",
  projects: "/projects",
  tasks: "/projects",
  board: "/projects",
  calendar: "/calendar",
  ideas: "/ideas",
  timeline: "/timeline",
  files: "/files",
  links: "/links",
  reports: "/reports",
  rooms: "/rooms",
  settings: "/settings",
};

export default function HomePage({
  searchParams,
}: {
  searchParams: { tab?: string; project?: string; view?: string; task?: string };
}) {
  const project = searchParams.project;
  if (project) {
    const view = searchParams.view || "board";
    const q = searchParams.task ? `?task=${encodeURIComponent(searchParams.task)}` : "";
    redirect(`/projects/${project}/${view}${q}`);
  }
  redirect(TAB_PATHS[searchParams.tab || ""] || HOME_PATH);
}
