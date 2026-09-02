"use client";

import { useRouter } from "next/navigation";
import BacklogSection from "@/components/BacklogSection";
import { useAppSession } from "@/components/AppSession";
import { projectPath } from "@/lib/appRoutes";

export default function BacklogPage() {
  const router = useRouter();
  const { session } = useAppSession();
  return (
    <BacklogSection
      currentUserId={session.user.id}
      onOpenProject={(id) => router.push(projectPath(id))}
    />
  );
}
