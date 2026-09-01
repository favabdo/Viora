"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectsSection from "@/components/ProjectsSection";
import { useAppSession } from "@/components/AppSession";
import { projectPath } from "@/lib/appRoutes";

function ProjectsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAppSession();
  const shouldCreate = searchParams.get("new") === "1";

  useEffect(() => {
    if (shouldCreate) router.replace("/projects");
  }, [shouldCreate, router]);

  return (
    <ProjectsSection
      currentUserId={session.user.id}
      openCreateSignal={shouldCreate ? 1 : 0}
      onOpenProject={(id) => router.push(projectPath(id))}
    />
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageInner />
    </Suspense>
  );
}
