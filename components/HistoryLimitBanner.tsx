"use client";

import { useRouter } from "next/navigation";
import { History, Lock, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { usePlan } from "@/lib/planUsage";
import { limitsFor } from "@/lib/planUsage";

/*
 * تنبيه حد السجل: يظهر في ProjectHistoryView و ItemHistory
 * لتوضيح إن الخطة المجانية تعرض آخر 7 أيام فقط، مع CTA للترقية.
 */

export default function HistoryLimitBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = usePlan();
  const historyDays = limitsFor(plan).historyDays;

  // الخطط المدفوعة: لا تنبيه
  if (historyDays === null) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-inkFaint">
        <Lock size={11} />
        <span>{t("plan.history.compact", { days: historyDays })}</span>
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
        <p className="text-inkFaint text-[11px] mt-0.5">
          {t("plan.history.body")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/upgrade")}
        className="inline-flex items-center gap-1 rounded-lg bg-[#7c5cff] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_2px_8px_rgba(124,92,255,0.4)] hover:bg-[#6c4ceb] transition-colors"
      >
        <Sparkles size={12} />
        {t("plan.history.cta")}
      </button>
    </div>
  );
}
