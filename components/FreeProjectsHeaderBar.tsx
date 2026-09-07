"use client";

import { useRouter } from "next/navigation";
import { FolderKanban, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { limitsFor, usePlan } from "@/lib/planUsage";

/*
 * شريط أعلى صفحة المشاريع يظهر في الخطة المجانية فقط
 * يبيّن "فاضل لك X مشاريع من إجمالي الحد"
 * + CTA للترقية (روت لصفحة /upgrade) — المخفي في الخطط المدفوعة
 */

export default function FreeProjectsHeaderBar({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = usePlan();
  const planLimit = limitsFor(plan).projects;
  // لو الخطة مدفوعة (بلا حد) أو الحد مختلف عن الـ prop المعطى → اخفِ
  if (planLimit === null) return null;
  if (planLimit !== limit) return null;

  const remaining = Math.max(0, limit - used);
  const full = used >= limit;

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12px] ${
        full
          ? "border-[#EF4444]/30 bg-[#EF4444]/8 text-ink"
          : "border-[#7c5cff]/25 bg-[#7c5cff]/8 text-inkSoft"
      }`}
    >
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
          full ? "bg-[#EF4444]/15 text-[#dc2626]" : "bg-[#7c5cff]/15 text-[#5b4bd6]"
        }`}
      >
        <FolderKanban size={14} />
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="text-ink font-medium leading-tight">
          {t("projects.remaining", { limit, used })}
        </p>
        <p className="text-inkFaint text-[11px] mt-0.5">
          {full
            ? t("upgrade.limit.projects")
            : t("projects.remaining.short", { limit, used })}
        </p>
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
