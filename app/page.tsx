"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { CheckSquare, Link2, LogOut, UserCircle } from "lucide-react";
import TasksSection from "@/components/TasksSection";
import LinksSection from "@/components/LinksSection";
import PendingInvites from "@/components/PendingInvites";
import IconButton from "@/components/ui/IconButton";
import ProfileCardProvider from "@/components/ProfileCardContext";
import { supabase } from "@/lib/supabase";

type Tab = "tasks" | "links";

const TABS: { id: Tab; label: string; icon: typeof CheckSquare }[] = [
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
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-teal animate-spin" />
      </main>
    );
  }

  return (
    <ProfileCardProvider currentUserId={session.user.id}>
      <main className="min-h-screen px-5 py-6 md:px-10 md:py-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-7 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image
                src="/logo-full.png"
                alt="Viora"
                width={40}
                height={35}
                priority
                className="h-8 w-auto"
              />
              <span className="viora-wordmark text-lg">Viora</span>
            </div>
            <IconButton aria-label="تسجيل الخروج" onClick={handleSignOut} tone="default">
              <LogOut size={16} strokeWidth={1.75} />
            </IconButton>
          </header>

          <nav className="flex gap-1 border-b border-line mb-6" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`tab-btn flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors ${
                  tab === id ? "active text-ink" : "text-inkFaint hover:text-inkSoft"
                }`}
              >
                <Icon size={15} strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </nav>

          <PendingInvites userId={session.user.id} />

          {tab === "tasks" && <TasksSection currentUserId={session.user.id} />}
          {tab === "links" && <LinksSection />}

          <footer className="mt-14 pt-5 border-t border-line flex justify-center">
            <button
              onClick={() => router.push("/profile")}
              className="flex items-center gap-1.5 text-sm text-inkFaint hover:text-teal transition-colors"
            >
              <UserCircle size={15} strokeWidth={1.75} />
              الملف الشخصي
            </button>
          </footer>
        </div>
      </main>
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
