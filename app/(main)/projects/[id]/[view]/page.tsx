"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import { useAppSession } from "@/components/AppSession";
import { isWorkspaceView, projectPath } from "@/lib/appRoutes";

function ProjectViewInner({ id, view }: { id: string; view: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAppSession();

  useEffect(() => {
    if (!isWorkspaceView(view)) router.replace(projectPath(id, "board"));
  }, [view, id, router]);

  if (!isWorkspaceView(view)) return null;

  return (
    <ProjectWorkspace
      projectId={id}
      view={view}
      settingsTab={searchParams.get("tab")}
      currentUserId={session.user.id}
      currentUserEmail={session.user.email || ""}
      onViewChange={(next) => router.push(projectPath(id, next))}
      onBack={() => router.push("/projects")}
      onSettingsTabChange={(tab) => {
        const url = tab === "general" ? projectPath(id, "settings") : `${projectPath(id, "settings")}?tab=${tab}`;
        router.push(url);
      }}
    />
  );
}

export default function ProjectViewPage({ params }: { params: { id: string; view: string } }) {
  return (
    <Suspense fallback={null}>
      <ProjectViewInner id={params.id} view={params.view} />
    </Suspense>
  );
}
