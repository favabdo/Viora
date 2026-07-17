"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import TasksSection from "@/components/TasksSection";
import LinksSection from "@/components/LinksSection";
import PendingInvites from "@/components/PendingInvites";
import { supabase } from "@/lib/supabase";

type Tab = "tasks" | "links";

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "tasks";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checking || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-inkSoft text-sm">لحظة...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-10 md:px-10">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo-full.png"
              alt="Viora"
              width={48}
              height={42}
              priority
              className="h-10 w-auto"
            />
            <span className="viora-wordmark text-2xl">Viora</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-inkSoft hover:text-clay transition-colors border border-line rounded-lg px-3 py-1.5"
          >
            تسجيل الخروج
          </button>
        </header>

        <nav className="flex gap-6 border-b border-line mb-8">
          <button
            onClick={() => setTab("tasks")}
            className={`tab-btn pb-3 text-sm font-medium transition-colors ${
              tab === "tasks" ? "active text-ink" : "text-inkSoft hover:text-ink"
            }`}
          >
            المهام
          </button>
          <button
            onClick={() => setTab("links")}
            className={`tab-btn pb-3 text-sm font-medium transition-colors ${
              tab === "links" ? "active text-ink" : "text-inkSoft hover:text-ink"
            }`}
          >
            الروابط
          </button>
        </nav>

        <PendingInvites userId={session.user.id} />

        {tab === "tasks" && <TasksSection currentUserId={session.user.id} />}
        {tab === "links" && <LinksSection />}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
