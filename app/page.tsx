"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { CheckSquare, Link2, DoorClosed } from "lucide-react";
import TasksSection from "@/components/TasksSection";
import LinksSection from "@/components/LinksSection";
import RoomsSection from "@/components/RoomsSection";
import PendingInvites from "@/components/PendingInvites";
import ProfileCardProvider from "@/components/ProfileCardContext";
import AppShell, { ShellTab } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Tab = "tasks" | "links" | "rooms";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const TABS: ShellTab[] = [
    { id: "tasks", label: t("tabs.tasks"), icon: CheckSquare },
    { id: "links", label: t("tabs.links"), icon: Link2 },
    { id: "rooms", label: t("tabs.rooms"), icon: DoorClosed },
  ];
  const initialTab = (searchParams.get("tab") as Tab) || "tasks";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [roomsInitialFilter, setRoomsInitialFilter] = useState<"open" | "pending">("open");

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
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-teal animate-spin" />
      </main>
    );
  }

  return (
    <ProfileCardProvider currentUserId={session.user.id}>
      <AppShell
        tabs={TABS}
        activeTab={tab}
        onTabChange={(id) => setTab(id as Tab)}
        onRoomsTabActivated={(hasPending) => setRoomsInitialFilter(hasPending ? "pending" : "open")}
        userName={currentUserName}
        avatarUrl={currentUserAvatar}
        onSignOut={handleSignOut}
        currentUserId={session.user.id}
      >
        <PendingInvites userId={session.user.id} />

        {tab === "tasks" && (
          <TasksSection currentUserId={session.user.id} currentUserEmail={session.user.email || ""} />
        )}
        {tab === "links" && <LinksSection />}
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
