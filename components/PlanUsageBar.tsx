"use client";

import { useEffect, useState } from "react";
import { FolderKanban, Lightbulb, ListTodo, Crown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useRouter } from "next/navigation";
import {
  countUserProjects,
  countTotalTasks,
  countUserIdeas,
  limitsFor,
  usePlan,
} from "@/lib/planUsage";

/*
 * شريط حالة الخطة في الرئيسية: فاضل كام مشروع/مهمة/فكرة من إجمالي الخطّة.
 * عدّ المهام شامل مهام الباك لوج (localStorage) مع مهام المشاريع.
 */

type Usage = { projects: number; tasks: number; ideas: number };

export default function PlanUsageBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const plan = usePlan();
  const limits = limitsFor(plan);
  const [usage, setUsage] = useState<Usage | null>(null);

  // الخطط المدفوعة (بلا حدود) → الشريط مخفي بالكامل
  if (plan !== "free") return null;

  useEffect(() => {
    let alive = true;
    Promise.all([countUserProjects(), countTotalTasks(), countUserIdeas()]).then(
      ([projects, tasks, ideas]) => {
        if (alive) setUsage({ projects, tasks, ideas });
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const rows = [
    {
      key: "projects" as const,
      icon: FolderKanban,
      used: usage?.projects ?? 0,
      limit: limits.projects,
      color: "#7c5cff",
      barClass: "bg-[#7c5cff]",
    },
    {
      key: "tasks" as const,
      icon: ListTodo,
      used: usage?.tasks ?? 0,
      limit: limits.tasks,
      color: "#6366f1",
      barClass: "bg-[#6366f1]",
    },
    {
      key: "ideas" as const,
      icon: Lightbulb,
      used: usage?.ideas ?? 0,
      limit: limits.ideas,
      color: "#f59e0b",
      barClass: "bg-[#f59e0b]",
    },
  ];

  return (
    <div className="upgrade-card rounded-2xl p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-2 me-auto">
        <div className="h-8 w-8 rounded-lg bg-teal/15 text-teal flex items-center justify-center">
          <Crown size={15} />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-ink">{t("plan.usage.title")}</p>
          <p className="text-[11px] text-inkFaint">{t(`plan.name.${plan}`)}</p>
        </div>
      </div>

      {rows.map(({ key, icon: Icon, used, limit, barClass }) => {
        const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const nearLimit = limit !== null && used >= limit * 0.8;
        return (
          <div key={key} className="flex items-center gap-2 min-w-[150px]">
            <Icon
              size={15}
              className={nearLimit ? "text-clay" : "text-inkFaint"}
            />
            <div className="flex-1 min-w-[110px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-inkSoft">{t(`plan.usage.${key}`)}</span>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    nearLimit ? "text-clay" : "text-ink"
                  }`}
                >
                  {used} / {limit ?? "∞"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-paperDark overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${nearLimit ? "bg-clay" : barClass}`}
                  style={{ width: `${limit ? pct : 0}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {plan === "free" && (
        <button
          type="button"
          onClick={() => router.push("/upgrade")}
          className="text-[11px] font-semibold text-teal hover:text-tealDark transition-colors whitespace-nowrap"
        >
          {t("plan.usage.upgrade")}
        </button>
      )}
    </div>
  );
}
