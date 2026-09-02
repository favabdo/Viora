"use client";

import FilesSection from "@/components/FilesSection";
import { useAppSession } from "@/components/AppSession";

export default function FilesPage() {
  const { session, userName, avatarUrl } = useAppSession();
  return <FilesSection currentUserId={session.user.id} userName={userName} avatarUrl={avatarUrl} />;
}
