"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LucideIcon,
  LogOut,
  UserRound,
  Moon,
  Sun,
  Bell,
  X,
  Search,
  Settings,
  Plus,
  Crown,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import Avatar from "./ui/Avatar";
import { applyTheme, getStoredTheme, Theme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useRoomsPendingPoll } from "@/lib/useRoomsPendingPoll";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { supabase } from "@/lib/supabase";

export type ShellTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export default function AppShell({
  tabs,
  activeTab,
  onTabChange,
  onRoomsTabActivated,
  onNew,
  userName,
  avatarUrl,
  onSignOut,
  currentUserId,
  children,
}: {
  tabs: ShellTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onRoomsTabActivated?: (hasPending: boolean) => void;
  onNew?: () => void;
  userName: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
  currentUserId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);
  const [isNilechatLinked, setIsNilechatLinked] = useState(false);
  const { pendingCount } = useRoomsPendingPoll(isNilechatLinked);
  const { supported: pushSupported, subscribed: pushSubscribed, subscribing, subscribe } = usePushSubscription();
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);
  const notifCount = isNilechatLinked ? pendingCount : 0;

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("nilechat_links")
      .select("user_id")
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(({ data }) => setIsNilechatLinked(Boolean(data)));
  }, [currentUserId]);

  useEffect(() => {
    if (!isNilechatLinked || !pushSupported || pushSubscribed) return;
    const dismissed = typeof window !== "undefined" && localStorage.getItem("viora-push-prompt-dismissed") === "1";
    if (!dismissed) setShowEnablePrompt(true);
  }, [isNilechatLinked, pushSupported, pushSubscribed]);

  function dismissEnablePrompt() {
    setShowEnablePrompt(false);
    try {
      localStorage.setItem("viora-push-prompt-dismissed", "1");
    } catch {
      // تجاهل
    }
  }

  function handleTabClick(id: string) {
    setShowMobileNav(false);
    if (id === "settings") {
      router.push("/settings");
      return;
    }
    if (id === "rooms") onRoomsTabActivated?.(pendingCount > 0);
    onTabChange(id);
  }

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!showAccountMenu && !showMobileNav) return;
    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (showAccountMenu && !accountMenuRef.current?.contains(target)) setShowAccountMenu(false);
      if (showMobileNav && !mobileNavRef.current?.contains(target)) setShowMobileNav(false);
    }
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [showAccountMenu, showMobileNav]);

  function goToProfile() {
    setShowAccountMenu(false);
    setShowMobileNav(false);
    router.push("/profile");
  }

  function goToSettings() {
    setShowAccountMenu(false);
    setShowMobileNav(false);
    router.push("/settings");
  }

  function signOut() {
    setShowAccountMenu(false);
    setShowMobileNav(false);
    onSignOut();
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const Logo = (
    <div className="flex items-center gap-1">
      {lang === "ar" ? (
        <>
          <span className="viora-wordmark text-xl">iora</span>
          <Image src="/logo-icon.png" alt="Viora" width={28} height={28} priority className="h-7 w-auto" />
        </>
      ) : (
        <>
          <Image src="/logo-icon.png" alt="Viora" width={28} height={28} priority className="h-7 w-auto" />
          <span className="viora-wordmark text-xl">iora</span>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen md:flex bg-paper">
      <aside className="hidden md:flex md:w-[248px] md:shrink-0 md:flex-col md:h-screen md:sticky md:top-0 md:bg-surface md:border-e md:border-line">
        <div className="px-5 pt-5 pb-6">{Logo}</div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto thin-scroll" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const showBadge = id === "rooms" && notifCount > 0;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => handleTabClick(id)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                  active ? "bg-[#6C5CE7]/16 text-ink" : "text-inkSoft hover:bg-paperDark hover:text-ink"
                }`}
              >
                {active && <span className="absolute start-0 inset-y-1.5 w-[3px] rounded-full bg-[#6C5CE7]" />}
                <Icon size={16} strokeWidth={1.75} className={active ? "text-[#6C5CE7]" : ""} />
                {label}
                {showBadge && (
                  <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6C5CE7] px-1 text-2xs font-semibold text-white">
                    {notifCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-3 mt-4">
          <div className="rounded-xl border border-line bg-paperDark/70 px-3.5 py-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-[#6C5CE7]/18 text-[#6C5CE7] flex items-center justify-center">
                <Crown size={14} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-ink">{t("shell.upgradeTitle")}</p>
            </div>
            <p className="text-[11px] leading-relaxed text-inkSoft mb-3">{t("shell.upgradeHint")}</p>
            <button className="w-full rounded-lg bg-[#6C5CE7] hover:bg-[#5b4bd6] text-white text-xs font-semibold py-2 transition-colors">
              {t("shell.upgradeNow")}
            </button>
          </div>
        </div>

        <div className="relative px-3 pb-4" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu((v) => !v)}
            className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-paperDark transition-colors"
          >
            <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="md" />
            <div className="min-w-0 text-start flex-1">
              <p className="text-sm font-medium text-ink truncate">{userName || t("shell.myAccount")}</p>
              <p className="text-[11px] text-inkFaint">{t("shell.admin")}</p>
            </div>
            <ChevronDown size={14} className="text-inkFaint shrink-0" />
          </button>
          {showAccountMenu && (
            <AccountMenu
              userName={userName}
              avatarUrl={avatarUrl}
              t={t}
              onProfile={goToProfile}
              onSettings={goToSettings}
              onSignOut={signOut}
            />
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-3 px-4 py-3 md:px-6 border-b border-line sticky top-0 bg-paper/90 backdrop-blur z-30">
          <div className="relative md:hidden" ref={mobileNavRef}>
            <button
              type="button"
              onClick={() => setShowMobileNav((v) => !v)}
              className="flex items-center gap-2 rounded-xl pe-2 py-1 hover:bg-surface"
              aria-label={t("shell.openMenu")}
              aria-expanded={showMobileNav}
            >
              <MoreHorizontal size={20} strokeWidth={2} className="text-ink shrink-0" />
              {Logo}
              <span className="text-sm font-medium text-ink truncate max-w-[7.5rem]">
                {userName || t("shell.myAccount")}
              </span>
            </button>
            {showMobileNav && (
              <div className="absolute start-0 top-full mt-2 z-50 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-line bg-surface shadow-modal p-2 fade-in">
                <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-medium uppercase tracking-wide text-inkFaint">
                  {t("shell.sections")}
                </p>
                <div className="max-h-[55vh] overflow-y-auto thin-scroll">
                  {tabs.map(({ id, label, icon: Icon }) => {
                    const active = activeTab === id;
                    const showBadge = id === "rooms" && notifCount > 0;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleTabClick(id)}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                          active ? "bg-[#6C5CE7]/16 text-ink" : "text-inkSoft hover:bg-paperDark hover:text-ink"
                        }`}
                      >
                        <Icon size={16} strokeWidth={1.75} className={active ? "text-[#6C5CE7]" : ""} />
                        <span className="flex-1 text-start">{label}</span>
                        {showBadge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6C5CE7] px-1 text-2xs font-semibold text-white">
                            {notifCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 border-t border-line pt-1">
                  <button
                    type="button"
                    onClick={goToProfile}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-inkSoft hover:bg-paperDark hover:text-ink"
                  >
                    <UserRound size={16} strokeWidth={1.75} />
                    {t("shell.openProfile")}
                  </button>
                  <button
                    type="button"
                    onClick={goToSettings}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-inkSoft hover:bg-paperDark hover:text-ink"
                  >
                    <Settings size={16} strokeWidth={1.75} />
                    {t("settings.title")}
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-clay hover:bg-claySoft"
                  >
                    <LogOut size={16} strokeWidth={1.75} />
                    {t("shell.signOut")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-1 max-w-xl mx-auto hidden md:block">
            <Search size={15} strokeWidth={1.75} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-inkFaint" />
            <input
              type="text"
              placeholder={t("shell.search")}
              className="w-full bg-surfaceSunken border-0 rounded-[1.75rem] ps-10 pe-14 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none focus:outline-none focus:ring-0"
            />
            <span className="absolute top-1/2 -translate-y-1/2 end-3 text-[11px] text-inkFaint border border-line rounded-md px-1.5 py-0.5">
              ⌘ K
            </span>
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <button
              onClick={onNew}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5b4bd6] text-white text-sm font-semibold px-3.5 py-2 transition-colors"
            >
              <Plus size={15} strokeWidth={2.25} />
              {t("shell.new")}
            </button>
            <button
              aria-label={t("notif.pendingRequests")}
              onClick={() => handleTabClick("projects")}
              className="relative h-9 w-9 inline-flex items-center justify-center rounded-xl text-inkSoft hover:text-ink hover:bg-surface"
            >
              <Bell size={17} strokeWidth={1.75} />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6C5CE7] px-1 text-[9px] font-semibold text-white">
                  {notifCount}
                </span>
              )}
            </button>
            <button
              aria-label={theme === "dark" ? t("shell.enableLight") : t("shell.enableDark")}
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-inkSoft hover:text-ink hover:bg-surface"
            >
              {theme === "dark" ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 px-4 py-6 md:px-8 md:py-7 pb-8">
          {showEnablePrompt && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 mb-4 text-sm fade-in">
              <div className="flex items-center gap-2">
                <Bell size={14} strokeWidth={1.75} className="text-[#6C5CE7] shrink-0" />
                <span className="text-ink">{t("notif.enablePrompt")}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await subscribe();
                    setShowEnablePrompt(false);
                  }}
                  disabled={subscribing}
                  className="text-[#6C5CE7] hover:text-[#5b4bd6] font-medium text-xs disabled:opacity-50"
                >
                  {t("notif.enable")}
                </button>
                <button onClick={dismissEnablePrompt} className="text-inkFaint hover:text-ink">
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

    </div>
  );
}

function AccountMenu({
  userName,
  avatarUrl,
  t,
  onProfile,
  onSettings,
  onSignOut,
}: {
  userName: string;
  avatarUrl?: string | null;
  t: (key: string) => string;
  onProfile: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="absolute z-40 bg-surface border border-line rounded-xl shadow-modal p-1.5 min-w-[180px] fade-in bottom-16 start-3 end-3 md:start-auto">
      <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-line mb-1">
        <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
        <span className="text-sm font-medium text-ink truncate">{userName || t("shell.myAccount")}</span>
      </div>
      <button
        onClick={onProfile}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-inkSoft hover:bg-paperDark hover:text-ink transition-colors text-start w-full"
      >
        <UserRound size={15} strokeWidth={1.75} />
        {t("shell.openProfile")}
      </button>
      <button
        onClick={onSettings}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-inkSoft hover:bg-paperDark hover:text-ink transition-colors text-start w-full"
      >
        <Settings size={15} strokeWidth={1.75} />
        {t("settings.title")}
      </button>
      <button
        onClick={onSignOut}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-clay hover:bg-claySoft transition-colors text-start w-full"
      >
        <LogOut size={15} strokeWidth={1.75} />
        {t("shell.signOut")}
      </button>
    </div>
  );
}
