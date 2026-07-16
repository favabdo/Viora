"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import TasksSection from "@/components/TasksSection";
import LinksSection from "@/components/LinksSection";
import { supabase } from "@/lib/supabase";

type Tab = "home" | "tasks" | "links";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
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

  const displayName =
    (session?.user.user_metadata?.full_name as string | undefined) ||
    session?.user.email?.split("@")[0] ||
    "";

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
          <div className="flex items-center gap-3">
            <Image
              src="/logo-full.png"
              alt="Viora"
              width={160}
              height={51}
              priority
              className="h-auto w-[140px]"
            />
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-inkSoft hover:text-clay transition-colors border border-line rounded-lg px-3 py-1.5"
          >
            تسجيل الخروج
          </button>
        </header>
        <p className="text-inkSoft text-sm -mt-5 mb-8">
          مهامك وروابطك، كل حاجة في مكانها مع Viora
        </p>

        <nav className="flex gap-6 border-b border-line mb-8">
          <button
            onClick={() => setTab("home")}
            className={`tab-btn pb-3 text-sm font-medium transition-colors ${
              tab === "home" ? "active text-ink" : "text-inkSoft hover:text-ink"
            }`}
          >
            الرئيسية
          </button>
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

        {tab === "home" && (
          <section className="fade-in">
            <h1 className="font-display text-3xl md:text-4xl font-semibold mb-2">
              أهلاً، {displayName} 👋
            </h1>
            <p className="text-inkSoft text-sm">
              يومك النهارده جاهز؟ روح لتاب المهام عشان تنجز، أو الروابط عشان تلاقي اللي حفظته.
            </p>
          </section>
        )}
        {tab === "tasks" && <TasksSection />}
        {tab === "links" && <LinksSection />}
      </div>
    </main>
  );
}
