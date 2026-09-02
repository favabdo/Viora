"use client";

import FilesSection from "@/components/FilesSection";
import { useAppSession } from "@/components/AppSession";

export default function FilesPage() {
  const { session } = useAppSession();
  return <FilesSection currentUserId={session.user.id} />;
}
