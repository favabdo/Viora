"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { CheckSquare, Link2 } from "lucide-react";
import TasksSection from "@/components/TasksSection";
import LinksSection from "@/components/LinksSection";
import PendingInvites from "@/components/PendingInvites";
import ProfileCardProvider from "@/components/ProfileCardContext";
import AppShell, { ShellTab } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type Tab = "tasks" | "links";

const TABS: ShellTab[] = [
  { id: "tasks", label: "المهام", icon: CheckSquare },
  { id: "links", label: "الروابط", icon: Link2 },
];

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "tasks";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentUserName, setCurrentUserName] = useState("");

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
      .select("full_name, username")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setCurrentUserName((data.full_name && data.full_name.trim()) || data.username || "");
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
        userName={currentUserName}
        onSignOut={handleSignOut}
      >
        <PendingInvites userId={session.user.id} />

        {tab === "tasks" && (
          <TasksSection currentUserId={session.user.id} currentUserEmail={session.user.email || ""} />
        )}
        {tab === "links" && <LinksSection />}
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
