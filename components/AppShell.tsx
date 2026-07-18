"use client";

import { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LucideIcon, LogOut, UserCircle } from "lucide-react";
import IconButton from "./ui/IconButton";
import Avatar from "./ui/Avatar";

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
  onSignOut,
  children,
}: {
  tabs: ShellTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  userName: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen md:flex">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-l md:border-line md:h-screen md:sticky md:top-0 md:py-5 md:px-3.5">
        <div className="flex items-center gap-2 px-2 mb-7">
          <Image src="/logo-full.png" alt="Viora" width={32} height={28} priority className="h-7 w-auto" />
          <span className="viora-wordmark text-base">Viora</span>
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

        <div className="mt-auto pt-4 border-t border-line px-2 flex items-center gap-2.5">
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center gap-2.5 min-w-0 flex-1 group text-right"
            aria-label="الملف الشخصي"
          >
            <Avatar name={userName || "؟"} size="sm" />
            <span className="text-sm font-medium text-ink truncate group-hover:text-teal transition-colors">
              {userName || "حسابي"}
            </span>
          </button>
          <IconButton aria-label="تسجيل الخروج" onClick={onSignOut} tone="default">
            <LogOut size={15} strokeWidth={1.75} />
          </IconButton>
        </div>
      </aside>

      {/* الهيدر — الموبايل فقط */}
      <header className="md:hidden flex items-center justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-paper/90 backdrop-blur z-30">
        <div className="flex items-center gap-2">
          <Image src="/logo-full.png" alt="Viora" width={30} height={26} priority className="h-7 w-auto" />
          <span className="viora-wordmark text-base">Viora</span>
        </div>
        <div className="flex items-center gap-1">
          {userName && <span className="text-sm text-inkSoft font-medium ml-1">{userName}</span>}
          <IconButton aria-label="الملف الشخصي" onClick={() => router.push("/profile")} tone="default">
            <UserCircle size={17} strokeWidth={1.75} />
          </IconButton>
          <IconButton aria-label="تسجيل الخروج" onClick={onSignOut} tone="default">
            <LogOut size={16} strokeWidth={1.75} />
          </IconButton>
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
