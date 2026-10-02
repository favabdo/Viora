"use client";

import { ReactNode, useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  LucideIcon,
  LogOut,
  UserRound,
  Moon,
  Sun,
  Settings,
  Crown,
  Menu,
  X,
} from "lucide-react";
import Avatar from "./ui/Avatar";
import { useThemePreference } from "@/lib/userSettings";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useRoomsPendingPoll } from "@/lib/useRoomsPendingPoll";
import { Plan, usePlan } from "@/lib/planUsage";
import { supabase } from "@/lib/supabase";
import VioraAIAssistant from "./VioraAIAssistant";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./GlobalSearch";

export type ShellTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export default function AppShell({
  tabs,
  activeTab,
  onTabChange,
  userName,
  userUsername,
  avatarUrl,
  onSignOut,
  currentUserId,
  children,
}: {
  tabs: ShellTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  userName: string;
  userUsername?: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
  currentUserId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isUpgrade = pathname.startsWith("/upgrade");
  const { t, lang } = useTranslation();
  const [theme, setTheme] = useThemePreference();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const plan = usePlan();
  const [isNilechatLinked, setIsNilechatLinked] = useState(false);
  const { pendingCount } = useRoomsPendingPoll(isNilechatLinked);

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("nilechat_links")
      .select("user_id")
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(({ data }) => setIsNilechatLinked(Boolean(data)));
  }, [currentUserId]);

  function handleTabClick(id: string) {
    setShowMobileNav(false);
    if (id === "settings") {
      router.push("/settings");
      return;
    }
    if (id === "upgrade") {
      router.push("/upgrade");
      return;
    }
    if (id === "rooms") {
      router.push(pendingCount > 0 ? "/rooms?filter=pending" : "/rooms");
      return;
    }
    onTabChange(id);
  }

  useEffect(() => {
    if (!showAccountMenu) return;
    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (!accountMenuRef.current?.contains(target)) setShowAccountMenu(false);
    }
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [showAccountMenu]);

  useEffect(() => {
    if (!showMobileNav) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowMobileNav(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [showMobileNav]);

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
    setTheme(theme === "dark" ? "light" : "dark");
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

  const sidebarProps = {
    logo: Logo,
    tabs,
    activeTab,
    notifCount: pendingCount,
    t,
    onTabClick: handleTabClick,
    onUpgrade: () => {
      setShowMobileNav(false);
      router.push("/upgrade");
    },
    onCloseMobile: () => setShowMobileNav(false),
  };

  const account = {
    userName,
    userUsername,
    avatarUrl,
    plan,
    t,
    showAccountMenu,
    accountMenuRef,
    onToggleAccount: () => setShowAccountMenu((v) => !v),
    onProfile: goToProfile,
    onSettings: goToSettings,
    onSignOut: signOut,
  };

  return (
    <div className="min-h-screen md:flex bg-transparent">
      <button
        type="button"
        aria-hidden={!showMobileNav}
        tabIndex={-1}
        onClick={() => setShowMobileNav(false)}
        className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          showMobileNav ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`flex w-[min(82vw,248px)] shrink-0 flex-col bg-surface/80 backdrop-blur-xl border-e border-line
          max-md:fixed max-md:inset-y-0 max-md:start-0 max-md:z-50 max-md:shadow-modal max-md:transition-transform max-md:duration-300
          md:sticky md:top-0 md:h-screen md:w-[248px]
          ${showMobileNav ? "max-md:translate-x-0" : "max-md:ltr:-translate-x-full max-md:rtl:translate-x-full"}`}
      >
        <SidebarPanel {...sidebarProps} onCloseMobile={() => setShowMobileNav(false)} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {!isUpgrade && (
        <header className="flex items-center gap-2 px-3 py-3 md:gap-3 md:px-6 border-b border-line sticky top-0 bg-paper/70 backdrop-blur-xl z-30">
          <button
            type="button"
            onClick={() => setShowMobileNav(true)}
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-xl text-ink hover:bg-surface shrink-0"
            aria-label={t("shell.openMenu")}
            aria-expanded={showMobileNav}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1 max-w-xl mx-auto">
            <GlobalSearch userId={currentUserId} />
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <PlanPill plan={plan} t={t} className="hidden sm:inline-flex" />
            <NotificationBell userId={currentUserId} />
            <button
              aria-label={theme === "dark" ? t("shell.enableLight") : t("shell.enableDark")}
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-inkSoft hover:text-ink hover:bg-surface"
            >
              {theme === "dark" ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
            </button>
            <AccountControl {...account} />
          </div>
        </header>
        )}

        {isUpgrade && <AccountControl {...account} floating />}

        {isUpgrade && (
          <button
            type="button"
            onClick={() => setShowMobileNav(true)}
            className="md:hidden fixed z-30 top-3 start-3 h-10 w-10 inline-flex items-center justify-center rounded-xl bg-surface text-ink border border-line shadow-sm backdrop-blur dark:bg-white/5 dark:text-white dark:border-white/10"
            aria-label={t("shell.openMenu")}
            aria-expanded={showMobileNav}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
        )}

        <main className={`flex-1 min-w-0 ${isUpgrade ? "overflow-visible px-0 py-0 pb-24" : "overflow-x-hidden px-3 py-4 sm:px-4 md:px-8 md:py-7 pb-24"}`}>
          {children}
        </main>
      </div>

      <VioraAIAssistant />
    </div>
  );
}

function SidebarPanel({
  logo,
  tabs,
  activeTab,
  notifCount,
  t,
  onTabClick,
  onUpgrade,
  onCloseMobile,
}: {
  logo: ReactNode;
  tabs: ShellTab[];
  activeTab: string;
  notifCount: number;
  t: (key: string) => string;
  onTabClick: (id: string) => void;
  onUpgrade: () => void;
  onCloseMobile: () => void;
}) {
  const [showUpgradePromo, setShowUpgradePromo] = useState(true);

  useEffect(() => {
    try {
      setShowUpgradePromo(localStorage.getItem("viora-upgrade-promo") !== "hidden");
    } catch {
      // ignore
    }
  }, []);

  function dismissUpgradePromo() {
    setShowUpgradePromo(false);
    try {
      localStorage.setItem("viora-upgrade-promo", "hidden");
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-6">
        {logo}
        <button
          type="button"
          onClick={onCloseMobile}
          className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
          aria-label={t("shell.closeMenu")}
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-3 pt-3 overflow-y-auto thin-scroll" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          const showBadge = id === "rooms" && notifCount > 0;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onTabClick(id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                active && id === "upgrade"
                  ? "bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white shadow-[0_8px_20px_-8px_rgba(37, 99, 235,0.9)]"
                  : active
                    ? "bg-teal/16 text-ink shadow-[0_0_16px_rgba(37, 99, 235,0.18)]"
                    : "text-inkSoft hover:bg-tealSoft hover:text-ink hover:shadow-[0_0_16px_rgba(37, 99, 235,0.16)]"
              }`}
            >
              {active && id !== "upgrade" && (
                <span className="absolute start-0 inset-y-1.5 w-[3px] rounded-full bg-[#2563EB]" />
              )}
              <Icon size={16} strokeWidth={1.75} className={active && id !== "upgrade" ? "text-[#2563EB]" : ""} />
              {label}
              {showBadge && (
                <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563EB] px-1 text-2xs font-semibold text-white">
                  {notifCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {showUpgradePromo && (
        <div className="px-3 pb-3 mt-4">
          <div className="relative rounded-xl border border-line bg-paperDark/70 px-3.5 py-3.5">
            <button
              type="button"
              onClick={dismissUpgradePromo}
              className="absolute top-2 end-2 h-7 w-7 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-surface"
              aria-label={t("shell.dismissUpgrade")}
            >
              <X size={14} strokeWidth={1.75} />
            </button>
            <div className="flex items-center gap-2 mb-1.5 pe-7">
              <div className="h-7 w-7 rounded-lg bg-[#2563EB]/18 text-[#2563EB] flex items-center justify-center">
                <Crown size={14} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-ink">{t("shell.upgradeTitle")}</p>
            </div>
            <ul className="mb-3 space-y-1 text-[11px] leading-relaxed text-inkSoft">
              <li>{t("shell.upgradeBenefit1")}</li>
              <li>{t("shell.upgradeBenefit2")}</li>
              <li>{t("shell.upgradeBenefit3")}</li>
            </ul>
            <button
              type="button"
              onClick={onUpgrade}
              className="w-full rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#2563EB] hover:shadow-[0_8px_20px_-8px_rgba(37, 99, 235,0.9)] text-white text-xs font-semibold py-2 transition-all"
            >
              {t("shell.upgradeNow")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function PlanPill({
  plan,
  t,
  className = "inline-flex",
}: {
  plan: Plan | null;
  t: (key: string) => string;
  className?: string;
}) {
  if (!plan) return null;
  return (
    <span
      className={`shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        plan === "pro"
          ? "bg-[#2563EB]/10 text-[#2563EB]"
          : plan === "team"
            ? "bg-[#22C55E]/15 text-[#16A34A] dark:text-[#4ADE80]"
            : "bg-paperDark text-inkSoft"
      } ${className}`}
    >
      {t(`plan.name.${plan}`)}
    </span>
  );
}

function AccountControl({
  userName,
  userUsername,
  avatarUrl,
  plan,
  t,
  showAccountMenu,
  accountMenuRef,
  onToggleAccount,
  onProfile,
  onSettings,
  onSignOut,
  floating = false,
}: {
  userName: string;
  userUsername?: string;
  avatarUrl?: string | null;
  plan: Plan | null;
  t: (key: string) => string;
  showAccountMenu: boolean;
  accountMenuRef: RefObject<HTMLDivElement>;
  onToggleAccount: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onSignOut: () => void;
  floating?: boolean;
}) {
  return (
    <div className={floating ? "fixed top-3 end-3 z-40" : "relative"} ref={accountMenuRef}>
      <button
        type="button"
        onClick={onToggleAccount}
        aria-label={t("shell.myAccount")}
        aria-expanded={showAccountMenu}
        className={`h-9 w-9 inline-flex items-center justify-center rounded-full transition-shadow hover:shadow-[0_0_16px_rgba(37,99,235,0.28)] ${
          floating ? "bg-surface border border-line shadow-sm" : ""
        }`}
      >
        <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
      </button>
      {showAccountMenu && (
        <AccountMenu
          userName={userName}
          userUsername={userUsername}
          avatarUrl={avatarUrl}
          plan={plan}
          t={t}
          onProfile={onProfile}
          onSettings={onSettings}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
}

function AccountMenu({
  userName,
  userUsername,
  avatarUrl,
  plan,
  t,
  onProfile,
  onSettings,
  onSignOut,
}: {
  userName: string;
  userUsername?: string;
  avatarUrl?: string | null;
  plan: Plan | null;
  t: (key: string) => string;
  onProfile: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="absolute z-40 top-11 end-0 mt-1 bg-surface border border-line rounded-xl shadow-modal p-1.5 min-w-[220px] max-w-[calc(100vw-1.5rem)] fade-in">
      <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-line mb-1">
        <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink truncate">{userName || t("shell.myAccount")}</span>
          {userUsername && (
            <span className="block text-[11px] text-inkFaint truncate" dir="ltr">
              @{userUsername}
            </span>
          )}
        </span>
        <PlanPill plan={plan} t={t} />
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
