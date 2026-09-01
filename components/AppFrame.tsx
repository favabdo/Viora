"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  Home,
  FolderKanban,
  CalendarDays,
  Lightbulb,
  GanttChart,
  FileText,
  Link2,
  BarChart3,
  Settings,
  DoorClosed,
} from "lucide-react";
import AppShell, { ShellTab } from "@/components/AppShell";
import PendingInvites from "@/components/PendingInvites";
import ProfileCardProvider from "@/components/ProfileCardContext";
import { AppSessionProvider } from "@/components/AppSession";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { navIdFromPath, pathForNav } from "@/lib/appRoutes";

export default function AppFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const tabs: ShellTab[] = [
    { id: "dashboard", label: t("nav.dashboard"), icon: Home },
    { id: "projects", label: t("nav.projects"), icon: FolderKanban },
    { id: "calendar", label: t("nav.calendar"), icon: CalendarDays },
    { id: "ideas", label: t("nav.ideas"), icon: Lightbulb },
    { id: "timeline", label: t("nav.timeline"), icon: GanttChart },
    { id: "files", label: t("nav.files"), icon: FileText },
    { id: "links", label: t("nav.links"), icon: Link2 },
    { id: "reports", label: t("nav.reports"), icon: BarChart3 },
    { id: "rooms", label: t("nav.rooms"), icon: DoorClosed },
    { id: "settings", label: t("nav.settings"), icon: Settings },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) router.replace("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("full_name, username, avatar_url")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserName((data.full_name && data.full_name.trim()) || data.username || "");
          setAvatarUrl(data.avatar_url || null);
        }
      });
  }, [session]);

  if (checking || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-[#6C5CE7] animate-spin" />
      </main>
    );
  }

  return (
    <ProfileCardProvider currentUserId={session.user.id}>
      <AppSessionProvider value={{ session, userName, avatarUrl }}>
        <AppShell
          tabs={tabs}
          activeTab={navIdFromPath(pathname)}
          onTabChange={(id) => router.push(pathForNav(id))}
          onNew={() => {
            if (pathname.startsWith("/ideas")) {
              router.push("/ideas?new=1");
              return;
            }
            router.push("/projects?new=1");
          }}
          userName={userName}
          avatarUrl={avatarUrl}
          onSignOut={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          currentUserId={session.user.id}
        >
          <PendingInvites userId={session.user.id} />
          {children}
        </AppShell>
      </AppSessionProvider>
    </ProfileCardProvider>
  );
}
