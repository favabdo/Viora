"use client";

import GlobalTimelineView from "@/components/GlobalTimelineView";
import { useAppSession } from "@/components/AppSession";

export default function TimelinePage() {
  const { session } = useAppSession();
  return <GlobalTimelineView currentUserId={session.user.id} />;
}
