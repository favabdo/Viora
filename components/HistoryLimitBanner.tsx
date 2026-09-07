"use client";

import { useRouter } from "next/navigation";
import { History, Lock, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { usePlan, limitsFor } from "@/lib/planUsage";

/*
 * تنبيه حد السجل: يظهر في ProjectHistoryView و ItemHistory
 * Free → "Last 7 days" مع CTA "ترقية لمزيد" يوديك لـ /upgrade
 * Pro/Team → hidden (السجل بلا حد بمجرد تفعيل الدفعة)
 * (coming soon) → يعرض "قريبًا" لمستخدمين free مع upgrade CTA
 */

export default function HistoryLimitBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = usePlan();
  const historyDays = limitsFor(plan).historyDays;

  // Pro / Team → no banner (unlimited)
  if (historyDays === null) return null;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/8 px-2.5 py-1.5 text-[11px] text-inkSoft">
        <span className="inline-flex items-center gap-1.5">
          <Lock size={11} className="text-[#d97706]" />
          <span>{t("plan.history.compact", { days: historyDays })}</span>
        </span>
        <button
          type="button"
          onClick={() => router.push("/upgrade")}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7c5cff] hover:text-[#6c4ceb] transition-colors"
        >
          <Sparkles size={11} />
          {t("plan.history.upgradeMore")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/8 px-3.5 py-2.5 text-[12px] text-inkSoft">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f59e0b]/15 text-[#d97706]">
        <History size={14} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="text-ink font-medium leading-tight">
          {t("plan.history.title", { days: historyDays })}
        </p>
        <p className="text-inkFaint text-[11px] mt-0.5">{t("plan.history.body")}</p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/upgrade")}
        className="inline-flex items-center gap-1 rounded-lg bg-[#7c5cff] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_2px_8px_rgba(124,92,255,0.4)] hover:bg-[#6c4ceb] transition-colors"
      >
        <Sparkles size={12} />
        {t("plan.history.upgradeMore")}
      </button>
    </div>
  );
}
