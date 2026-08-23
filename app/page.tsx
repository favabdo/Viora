"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  FolderKanban,
  LayoutGrid,
  CalendarDays,
  Lightbulb,
  GanttChart,
  FileText,
  Link2,
  BarChart3,
  Settings,
  DoorClosed,
} from "lucide-react";
import LinksSection from "@/components/LinksSection";
import RoomsSection from "@/components/RoomsSection";
import ProjectsSection from "@/components/ProjectsSection";
import ProjectWorkspace from "@/components/ProjectWorkspace";
import ComingSoon from "@/components/ComingSoon";
import EmptyState from "@/components/ui/EmptyState";
import PendingInvites from "@/components/PendingInvites";
import ProfileCardProvider from "@/components/ProfileCardContext";
import AppShell, { ShellTab } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Tab =
  | "dashboard"
  | "projects"
  | "board"
  | "calendar"
  | "ideas"
  | "timeline"
  | "files"
  | "links"
  | "reports"
  | "rooms"
  | "settings";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const TABS: ShellTab[] = [
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "projects", label: t("nav.projects"), icon: FolderKanban },
    { id: "board", label: t("nav.board"), icon: LayoutGrid },
    { id: "calendar", label: t("nav.calendar"), icon: CalendarDays },
    { id: "ideas", label: t("nav.ideas"), icon: Lightbulb },
    { id: "timeline", label: t("nav.timeline"), icon: GanttChart },
    { id: "files", label: t("nav.files"), icon: FileText },
    { id: "links", label: t("nav.links"), icon: Link2 },
    { id: "reports", label: t("nav.reports"), icon: BarChart3 },
    { id: "rooms", label: t("nav.rooms"), icon: DoorClosed },
    { id: "settings", label: t("nav.settings"), icon: Settings },
  ];
  const requestedTab = searchParams.get("tab");
  const initialTab = (requestedTab === "tasks" ? "projects" : requestedTab) as Tab || "projects";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [roomsInitialFilter, setRoomsInitialFilter] = useState<"open" | "pending">("open");
  const [openCreateSignal, setOpenCreateSignal] = useState(0);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

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
          setCurrentUserName((data.full_name && data.full_name.trim()) || data.username || "");
          setCurrentUserAvatar(data.avatar_url || null);
        }
      });
  }, [session]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checking || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-[#6C5CE7] animate-spin" />
      </main>
    );
  }

  function openProject(projectId: string) {
    setOpenProjectId(projectId);
    setTab("projects");
  }

  return (
    <ProfileCardProvider currentUserId={session.user.id}>
      <AppShell
        tabs={TABS}
        activeTab={tab}
        onTabChange={(id) => {
          const next = id as Tab;
          setTab(next);
          if (next === "projects") setOpenProjectId(null);
        }}
        onRoomsTabActivated={(hasPending) => setRoomsInitialFilter(hasPending ? "pending" : "open")}
        onNew={() => {
          if (openProjectId) setOpenProjectId(null);
          if (tab === "projects" || tab === "dashboard") setOpenCreateSignal((n) => n + 1);
          else setTab("projects");
        }}
        userName={currentUserName}
        avatarUrl={currentUserAvatar}
        onSignOut={handleSignOut}
        currentUserId={session.user.id}
      >
        <PendingInvites userId={session.user.id} />

        {tab === "dashboard" && <ComingSoon title={t("nav.dashboard")} icon={LayoutDashboard} />}
        {tab === "projects" && !openProjectId && (
          <ProjectsSection
            currentUserId={session.user.id}
            openCreateSignal={openCreateSignal}
            onOpenProject={openProject}
          />
        )}
        {tab === "projects" && openProjectId && (
          <ProjectWorkspace
            projectId={openProjectId}
            currentUserId={session.user.id}
            currentUserEmail={session.user.email || ""}
            onBack={() => setOpenProjectId(null)}
          />
        )}
        {tab === "board" && <ComingSoon title={t("nav.board")} icon={LayoutGrid} />}
        {tab === "calendar" && <ComingSoon title={t("nav.calendar")} icon={CalendarDays} />}
        {tab === "ideas" && <ComingSoon title={t("nav.ideas")} icon={Lightbulb} />}
        {tab === "timeline" && <ComingSoon title={t("nav.timeline")} icon={GanttChart} />}
        {tab === "files" && (
          <div className="rounded-xl border border-line bg-surface">
            <EmptyState icon={FileText} title={t("files.empty")} hint={t("files.emptyHint")} />
          </div>
        )}
        {tab === "links" && <LinksSection />}
        {tab === "reports" && <ComingSoon title={t("nav.reports")} icon={BarChart3} />}
        {tab === "rooms" && (
          <RoomsSection currentUserId={session.user.id} initialFilter={roomsInitialFilter} />
        )}
      </AppShell>
    </ProfileCardProvider>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
