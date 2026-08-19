"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LucideIcon, LogOut, UserRound, Moon, Sun, Bell, X, Search } from "lucide-react";
import Avatar from "./ui/Avatar";
import IconButton from "./ui/IconButton";
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

/**
 * الهيكل العام للتطبيق: شريط جانبي ثابت على الشاشات الكبيرة (زي Linear/Notion)،
 * شريط علوي ثابت (بحث + إشعارات + وضع الليل + الحساب) في كل الأحجام، وشريط تنقّل
 * سفلي على الموبايل بس. المحتوى نفسه بييجي من children.
 */
export default function AppShell({
  tabs,
  activeTab,
  onTabChange,
  onRoomsTabActivated,
  userName,
  avatarUrl,
  onSignOut,
  currentUserId,
  children,
}: {
  tabs: ShellTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** بينادى كل ما حد يدوس على تاب Rooms، بيقول لصاحب الصفحة هل فيه طلبات معلّقة وقت الدوسة عشان يفلتر تلقائي */
  onRoomsTabActivated?: (hasPending: boolean) => void;
  userName: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
  currentUserId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [isNilechatLinked, setIsNilechatLinked] = useState(false);
  const { pendingCount } = useRoomsPendingPoll(isNilechatLinked);
  const { supported: pushSupported, subscribed: pushSubscribed, subscribing, subscribe } = usePushSubscription();
  const [showEnablePrompt, setShowEnablePrompt] = useState(false);

  // عداد الطلبات المعلّقة بجانب "Rooms"/"الغرف" بيظهر بس لللي رابط حسابه في NileChat من البروفايل
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
    if (id === "rooms") onRoomsTabActivated?.(pendingCount > 0);
    onTabChange(id);
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
      if (!accountMenuRef.current?.contains(target)) setShowAccountMenu(false);
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
    <div className="min-h-screen md:flex">
      {/* الشريط الجانبي — سطح المكتب فقط */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-e md:border-line md:h-screen md:sticky md:top-0 md:py-5 md:px-3.5">
        <div className="px-2 mb-7">{Logo}</div>

        <nav className="flex flex-col gap-0.5" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const showBadge = id === "rooms" && isNilechatLinked && pendingCount > 0;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => handleTabClick(id)}
                className={`nav-item flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:bg-paperDark hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
                {showBadge && (
                  <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-2xs font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* الشريط العلوي — بحث + إشعارات + وضع الليل + الحساب، ظاهر في كل الأحجام */}
        <header className="flex items-center gap-3 px-5 py-3.5 md:px-7 border-b border-line sticky top-0 bg-paper/90 backdrop-blur z-30">
          <div className="md:hidden">{Logo}</div>

          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search size={15} strokeWidth={1.75} className="absolute top-1/2 -translate-y-1/2 start-3 text-inkFaint" />
            <input
              type="text"
              placeholder={t("shell.search")}
              className="w-full bg-paperDark border border-line rounded-md ps-9 pe-3 py-2 text-sm text-ink placeholder:text-inkFaint focus:outline-none focus:ring-1 focus:ring-teal transition-shadow"
            />
          </div>

          <div className="flex items-center gap-1.5 ms-auto">
            <IconButton
              aria-label={t("notif.pendingRequests")}
              onClick={() => handleTabClick("rooms")}
              tone="default"
              className="relative"
            >
              <Bell size={16} strokeWidth={1.75} />
              {isNilechatLinked && pendingCount > 0 && (
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

            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setShowAccountMenu((v) => !v)}
                aria-label={t("shell.account")}
                className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
              >
                <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
                <span className="hidden md:inline text-sm font-medium text-ink">{userName || t("shell.myAccount")}</span>
              </button>

              {showAccountMenu && (
                <div className="absolute top-full end-0 mt-2 z-40 bg-paper border border-line rounded-md shadow-modal p-1.5 min-w-[180px] fade-in">
                  <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-line mb-1">
                    <Avatar name={userName || t("shell.unnamed")} src={avatarUrl} size="sm" />
                    <span className="font-display text-sm font-medium text-ink truncate">
                      {userName || t("shell.myAccount")}
                    </span>
                  </div>
                  <button
                    onClick={goToProfile}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-inkSoft hover:bg-paperDark hover:text-ink transition-colors text-start w-full"
                  >
                    <UserRound size={15} strokeWidth={1.75} />
                    {t("shell.openProfile")}
                  </button>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-clay hover:bg-claySoft transition-colors text-start w-full"
                  >
                    <LogOut size={15} strokeWidth={1.75} />
                    {t("shell.signOut")}
                  </button>
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
      </div>

      {/* شريط تنقّل سفلي — الموبايل فقط */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line flex items-stretch pb-[env(safe-area-inset-bottom)]"
        role="tablist"
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          const showBadge = id === "rooms" && isNilechatLinked && pendingCount > 0;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => handleTabClick(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-2xs font-medium transition-colors relative ${
                active ? "text-teal" : "text-inkFaint"
              }`}
            >
              <span className="relative">
                <Icon size={19} strokeWidth={active ? 2 : 1.75} />
                {showBadge && (
                  <span className="absolute -top-1 -end-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-clay px-0.5 text-[9px] font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
