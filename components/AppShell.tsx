"use client";

import { ReactNode, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LucideIcon, LogOut, UserRound } from "lucide-react";
import Avatar from "./ui/Avatar";
import Modal from "./ui/Modal";
import Button from "./ui/Button";

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

        <div className="mt-auto pt-4 border-t border-line px-2">
          <button
            onClick={() => setShowAccountMenu(true)}
            className="flex items-center gap-2.5 min-w-0 w-full group text-right rounded-md px-1 py-1 hover:bg-paperDark transition-colors"
            aria-label="الحساب"
          >
            <Avatar name={userName || "؟"} src={avatarUrl} size="sm" />
            <span className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
              {userName || "حسابي"}
            </span>
          </button>
        </div>
      </aside>

      {/* الهيدر — الموبايل فقط */}
      <header className="md:hidden flex items-center justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-paper/90 backdrop-blur z-30">
        <div className="flex items-center gap-2">
          <Image src="/logo-full.png" alt="Viora" width={96} height={28} priority className="h-7 w-auto" />
        </div>
        <div className="flex items-center gap-1.5">
          {userName && <span className="text-sm text-inkSoft font-medium ml-1">{userName}</span>}
          <button
            onClick={() => setShowAccountMenu(true)}
            aria-label="الحساب"
            className="rounded-full transition-opacity hover:opacity-80"
          >
            <Avatar name={userName || "؟"} src={avatarUrl} size="sm" />
          </button>
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

      {showAccountMenu && (
        <Modal onClose={() => setShowAccountMenu(false)} maxWidth="max-w-xs">
          <div className="flex items-center gap-2.5 mb-4">
            <Avatar name={userName || "؟"} src={avatarUrl} size="sm" />
            <span className="font-display text-base font-medium text-ink truncate">{userName || "حسابي"}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowAccountMenu(false);
                router.push("/profile");
              }}
              className="justify-start"
            >
              <UserRound size={15} strokeWidth={1.75} />
              فتح الملف الشخصي
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setShowAccountMenu(false);
                onSignOut();
              }}
              className="justify-start"
            >
              <LogOut size={15} strokeWidth={1.75} />
              تسجيل الخروج
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
