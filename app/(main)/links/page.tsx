"use client";

import LinksSection from "@/components/LinksSection";
import { useAppSession } from "@/components/AppSession";

export default function LinksPage() {
  const { session, userName, avatarUrl } = useAppSession();
  return <LinksSection currentUserId={session.user.id} userName={userName} avatarUrl={avatarUrl} />;
}
