"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { renderActivity } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import { recordLoginNotification, useInboxNotifications, type InboxItem } from "@/lib/inboxNotifications";
import { supabase } from "@/lib/supabase";

export default function NotificationBell({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, loading, unreadCount, markRead, refresh } = useInboxNotifications(userId);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      recordLoginNotification(userId, new Date().toISOString());
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [userId, refresh]);

  useEffect(() => {
    if (!open || items.length === 0) return;
    markRead(items.map((item) => item.id));
  }, [open, items, markRead]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function labelFor(item: InboxItem) {
    if (item.kind === "login") return t("inbox.login");
    if (item.kind === "idea") {
      const action = item.action ? t(`ideas.activity.${item.action}`) : t("inbox.ideaEvent");
      return item.ideaTitle ? `${action} · ${item.ideaTitle}` : action;
    }
    const rendered = renderActivity(
      {
        actor_id: item.actorId,
        actor_name: item.actorName,
        message: item.message,
        action: item.action,
        action_params: item.actionParams,
      },
      t,
      userId,
      true
    );
    const text = `${rendered.label}${rendered.rest}`.trim();
    return item.projectName ? `${text} · ${item.projectName}` : text;
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        aria-label={t("inbox.title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 inline-flex items-center justify-center rounded-xl text-inkSoft hover:text-ink hover:bg-surface"
      >
        <Bell size={17} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6C5CE7] px-1 text-[9px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-50 w-[min(92vw,360px)] rounded-xl border border-line bg-surface shadow-modal overflow-hidden fade-in">
          <div className="px-3.5 py-2.5 border-b border-line">
            <p className="text-sm font-semibold text-ink">{t("inbox.title")}</p>
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto thin-scroll">
            {loading ? (
              <p className="px-3.5 py-6 text-sm text-inkFaint">{t("inbox.loading")}</p>
            ) : items.length === 0 ? (
              <p className="px-3.5 py-6 text-sm text-inkFaint">{t("inbox.empty")}</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        markRead([item.id]);
                        setOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full text-start px-3.5 py-2.5 hover:bg-paperDark/70"
                    >
                      <p className="text-[13px] text-ink leading-snug">{labelFor(item)}</p>
                      <p className="mt-0.5 text-[11px] text-inkFaint">{timeAgo(item.createdAt, t)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
