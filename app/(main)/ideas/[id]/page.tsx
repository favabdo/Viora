"use client";

import { useRouter } from "next/navigation";
import IdeasSection from "@/components/IdeasSection";
import { useAppSession } from "@/components/AppSession";
import { ideaPath, projectPath } from "@/lib/appRoutes";

export default function IdeaDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { session, userName, avatarUrl } = useAppSession();

  return (
    <IdeasSection
      currentUserId={session.user.id}
      currentUserName={userName}
      currentUserAvatar={avatarUrl}
      selectedIdeaId={params.id}
      onSelectIdea={(id) => router.push(ideaPath(id))}
      onOpenProject={(id) => router.push(projectPath(id))}
    />
  );
}
