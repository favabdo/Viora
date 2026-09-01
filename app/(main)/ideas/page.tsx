"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import IdeasSection from "@/components/IdeasSection";
import { useAppSession } from "@/components/AppSession";
import { ideaPath, projectPath } from "@/lib/appRoutes";

function IdeasPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, userName, avatarUrl } = useAppSession();
  const shouldCreate = searchParams.get("new") === "1";

  useEffect(() => {
    if (shouldCreate) router.replace("/ideas");
  }, [shouldCreate, router]);

  return (
    <IdeasSection
      currentUserId={session.user.id}
      currentUserName={userName}
      currentUserAvatar={avatarUrl}
      openCreateSignal={shouldCreate ? 1 : 0}
      selectedIdeaId={null}
      onSelectIdea={(id) => router.push(ideaPath(id))}
      onOpenProject={(id) => router.push(projectPath(id))}
    />
  );
}

export default function IdeasPage() {
  return (
    <Suspense fallback={null}>
      <IdeasPageInner />
    </Suspense>
  );
}
