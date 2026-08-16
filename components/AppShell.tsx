"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LucideIcon, LogOut, UserRound, Moon, Sun, Bell, X } from "lucide-react";
import Avatar from "./ui/Avatar";
import IconButton from "./ui/IconButton";
import { applyTheme, getStoredTheme, Theme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useRoomsPendingPoll } from "@/lib/useRoomsPendingPoll";
import { usePushSubscription } from "@/lib/usePushSubscription";

export type ShellTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

/**
 * الهيكل العام للتطبيق: شريط جانبي ثابت على الشاشات الكبيرة (زي Linear/Notion)،
 * وشريط تنقّل سفلي على الموبايل. المحتوى نفسه بييجي من children.
 */
export default function AppShell({
  tabs,
  activeTab,
  onTabChange,
  userName,
  avatarUrl,
  onSignOut,
  children,
}: {
  tabs: ShellTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  userName: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileAccountMenuRef = useRef<HTMLDivElement | null>(null);
  const { pendingCount } = useRoomsPendingPoll();
  const { supported: pushSupported, subscribed: pushSubscribed, subscribing, subscribe } = usePushSubscription();
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);

  useEffect(() => {
    if (!pushSupported || pushSubscribed) return;
    const dismissed = typeof window !== "undefined" && localStorage.getItem("viora-push-prompt-dismissed") === "1";
    if (!dismissed) setShowEnablePrompt(true);
  }, [pushSupported, pushSubscribed]);

  function dismissEnablePrompt() {
    setShowEnablePrompt(false);
    try {
      localStorage.setItem("viora-push-prompt-dismissed", "1");
    } catch {
      // تجاهل
    }
  }

  function goToRooms() {
    onTabChange("rooms");
  }

  // نقرأ الوضع المحفوظ بعد أول رسم للصفحة (الـ script في layout.tsx بيكون طبّقه على الـ html بالفعل)
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  // قفل قائمة الحساب المنسدلة لو المستخدم دس في أي مكان تاني بره القائمة
  useEffect(() => {
    if (!showAccountMenu) return;
    function handleClickOutside(e: PointerEvent) {
      const target = e.target as Node;
      const insideDesktop = accountMenuRef.current?.contains(target);
      const insideMobile = mobileAccountMenuRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setShowAccountMenu(false);
      }
    }
    window.addEventListener("pointerdown", handleClickOutside);
    return () => window.removeEventListener("pointerdown", handleClickOutside);
  }, [showAccountMenu]);

  function goToProfile() {
    setShowAccountMenu(false);
    router.push("/profile");
  }

  function signOut() {
    setShowAccountMenu(false);
    onSignOut();
  }

  const accountMenuDropdown = (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-line mb-1">
        <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
        <span className="font-display text-sm font-medium text-ink truncate">{userName || t("shell.myAccount")}</span>
      </div>
      <button
        onClick={goToProfile}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-inkSoft hover:bg-paperDark hover:text-ink transition-colors text-start"
      >
        <UserRound size={15} strokeWidth={1.75} />
        {t("shell.openProfile")}
      </button>
      <button
        onClick={signOut}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-clay hover:bg-claySoft transition-colors text-start"
      >
        <LogOut size={15} strokeWidth={1.75} />
        {t("shell.signOut")}
      </button>
    </div>
  );

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="min-h-screen md:flex">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-l md:border-line md:h-screen md:sticky md:top-0 md:py-5 md:px-3.5">
        <div className="flex items-center gap-1 px-2 mb-7">
          <span className="viora-wordmark text-xl">iora</span>
          <Image src="/logo-icon.png" alt="Viora" width={28} height={28} priority className="h-7 w-auto" />
        </div>

        <nav className="flex flex-col gap-0.5" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(id)}
                className={`nav-item flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:bg-paperDark hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={goToRooms}
          className="flex items-center gap-2.5 px-2.5 py-2 mt-1 rounded-md text-sm font-medium text-inkSoft hover:bg-paperDark hover:text-ink transition-colors relative"
        >
          <Bell size={16} strokeWidth={1.75} />
          {t("notif.pendingRequests")}
          {pendingCount > 0 && (
            <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-2xs font-semibold text-white">
              {pendingCount}
            </span>
          )}
        </button>

        <div className="mt-auto pt-4 border-t border-line px-2 flex items-center gap-1.5 relative" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu((v) => !v)}
            className="flex items-center gap-2.5 min-w-0 flex-1 group text-start rounded-md px-1 py-1 hover:bg-paperDark transition-colors"
            aria-label={t("shell.account")}
          >
            <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
            <span className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
              {userName || t("shell.myAccount")}
            </span>
          </button>
          <IconButton
            aria-label={theme === "dark" ? t("shell.enableLight") : t("shell.enableDark")}
            onClick={toggleTheme}
            tone="default"
          >
            {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </IconButton>

          {showAccountMenu && (
            <div className="absolute bottom-full right-0 left-0 mb-2 z-40 bg-paper border border-line rounded-md shadow-modal p-1.5 fade-in">
              {accountMenuDropdown}
            </div>
          )}
        </div>
      </aside>

      {/* الهيدر — الموبايل فقط */}
      <header className="md:hidden flex items-center justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-paper/90 backdrop-blur z-30">
        <div className="flex items-center gap-1">
          <span className="viora-wordmark text-xl">iora</span>
          <Image src="/logo-icon.png" alt="Viora" width={28} height={28} priority className="h-7 w-auto" />
        </div>
        <div className="flex items-center gap-1.5">
          {userName && <span className="text-sm text-inkSoft font-medium ml-1">{userName}</span>}
          <IconButton aria-label={t("notif.pendingRequests")} onClick={goToRooms} tone="default" className="relative">
            <Bell size={16} strokeWidth={1.75} />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-clay px-0.5 text-[9px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </IconButton>
          <IconButton
            aria-label={theme === "dark" ? t("shell.enableLight") : t("shell.enableDark")}
            onClick={toggleTheme}
            tone="default"
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </IconButton>
          <div className="relative md:hidden" ref={mobileAccountMenuRef}>
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              aria-label={t("shell.account")}
              className="rounded-full transition-opacity hover:opacity-80"
            >
              <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
            </button>

            {showAccountMenu && (
              <div className="absolute top-full left-0 mt-2 z-40 bg-paper border border-line rounded-md shadow-modal p-1.5 fade-in">
                {accountMenuDropdown}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 px-5 py-6 md:px-9 md:py-8 pb-24 md:pb-8">
        <div className="max-w-5xl mx-auto">
          {showEnablePrompt && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-paperDark px-3.5 py-2.5 mb-4 text-sm fade-in">
              <div className="flex items-center gap-2">
                <Bell size={14} strokeWidth={1.75} className="text-teal shrink-0" />
                <span className="text-ink">{t("notif.enablePrompt")}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await subscribe();
                    setShowEnablePrompt(false);
                  }}
                  disabled={subscribing}
                  className="text-teal hover:text-tealDark font-medium text-xs disabled:opacity-50"
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
        </div>
      </main>

      {/* شريط تنقّل سفلي — الموبايل فقط */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line flex items-stretch pb-[env(safe-area-inset-bottom)]"
        role="tablist"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-2xs font-medium transition-colors ${
                active ? "text-teal" : "text-inkFaint"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2 : 1.75} />
              {label}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
