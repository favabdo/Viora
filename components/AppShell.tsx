"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LucideIcon, LogOut, UserRound, Moon, Sun } from "lucide-react";
import Avatar from "./ui/Avatar";
import IconButton from "./ui/IconButton";
import { applyTheme, getStoredTheme, Theme } from "@/lib/theme";

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
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileAccountMenuRef = useRef<HTMLDivElement | null>(null);

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
        <Avatar name={userName || "؟"} src={avatarUrl} size="sm" />
        <span className="font-display text-sm font-medium text-ink truncate">{userName || "حسابي"}</span>
      </div>
      <button
        onClick={goToProfile}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-inkSoft hover:bg-paperDark hover:text-ink transition-colors text-right"
      >
        <UserRound size={15} strokeWidth={1.75} />
        فتح الملف الشخصي
      </button>
      <button
        onClick={signOut}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-clay hover:bg-claySoft transition-colors text-right"
      >
        <LogOut size={15} strokeWidth={1.75} />
        تسجيل الخروج
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
        <div className="flex items-center gap-2 px-2 mb-7">
          <Image src="/logo-full.png" alt="Viora" width={96} height={28} priority className="h-7 w-auto" />
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

        <div className="mt-auto pt-4 border-t border-line px-2 flex items-center gap-1.5 relative" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu((v) => !v)}
            className="flex items-center gap-2.5 min-w-0 flex-1 group text-right rounded-md px-1 py-1 hover:bg-paperDark transition-colors"
            aria-label="الحساب"
          >
            <Avatar name={userName || "؟"} src={avatarUrl} size="sm" />
            <span className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
              {userName || "حسابي"}
            </span>
          </button>
          <IconButton
            aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
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
        <div className="flex items-center gap-2">
          <Image src="/logo-full.png" alt="Viora" width={96} height={28} priority className="h-7 w-auto" />
        </div>
        <div className="flex items-center gap-1.5">
          {userName && <span className="text-sm text-inkSoft font-medium ml-1">{userName}</span>}
          <IconButton
            aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
            onClick={toggleTheme}
            tone="default"
          >
            {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </IconButton>
          <div className="relative md:hidden" ref={mobileAccountMenuRef}>
            <button
              onClick={() => setShowAccountMenu((v) => !v)}
              aria-label="الحساب"
              className="rounded-full transition-opacity hover:opacity-80"
            >
              <Avatar name={userName || "؟"} src={avatarUrl} size="sm" />
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
        <div className="max-w-5xl mx-auto">{children}</div>
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
