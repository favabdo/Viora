"use client";

import GlobalCalendarView from "@/components/GlobalCalendarView";
import { useAppSession } from "@/components/AppSession";

export default function CalendarPage() {
  const { session } = useAppSession();
  return <GlobalCalendarView currentUserId={session.user.id} />;
}
