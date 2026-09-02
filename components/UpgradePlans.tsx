"use client";

import { useState } from "react";
import {
  Check,
  Crown,
  Gift,
  ListTodo,
  MessageCircle,
  PenLine,
  Sparkles,
  Star,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Billing = "monthly" | "yearly";

export default function UpgradePlans() {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<Billing>("yearly");
  const yearly = billing === "yearly";
  const proPrice = yearly ? 7 : 9;
  const teamPrice = yearly ? 15 : 19;

  const tags = [
    t("upgrade.tag.ai"),
    t("upgrade.tag.workspace"),
    t("upgrade.tag.secure"),
    t("upgrade.tag.cancel"),
  ];

  const compareRows = [
    "projects",
    "tasks",
    "storage",
    "ideas",
    "history",
    "credits",
    "ai",
    "support",
  ] as const;

  return (
    <div className="mx-auto max-w-[1280px] pb-16">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between mb-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-tight">
            {t("upgrade.titleBefore")}{" "}
            <span className="bg-gradient-to-r from-[#a78bfa] via-[#7c6cff] to-[#38bdf8] bg-clip-text text-transparent">
              {t("upgrade.titleHighlight")}
            </span>{" "}
            {t("upgrade.titleAfter")}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-inkSoft">{t("upgrade.subtitle")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-surface/70 px-3 py-1 text-[11px] font-medium text-inkSoft"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start rounded-full border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              !yearly ? "bg-[#6C5CE7] text-white" : "text-inkSoft hover:text-ink"
            }`}
          >
            {t("upgrade.billing.monthly")}
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              yearly ? "bg-[#6C5CE7] text-white" : "text-inkSoft hover:text-ink"
            }`}
          >
            {t("upgrade.billing.yearly")}
          </button>
          <span className="me-1 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold text-sage">
            {t("upgrade.billing.save")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,1fr)_280px] items-stretch">
        <PlanCard
          icon={<Gift size={18} strokeWidth={1.75} />}
          name={t("upgrade.free.name")}
          price="$0"
          note={t("upgrade.free.priceNote")}
          cta={t("upgrade.free.cta")}
          ctaStyle="outline"
          features={[t("upgrade.free.f1"), t("upgrade.free.f2"), t("upgrade.free.f3"), t("upgrade.free.f4"), t("upgrade.free.f5")]}
          aiTitle={t("upgrade.free.aiTitle")}
          aiItems={[t("upgrade.free.ai1"), t("upgrade.free.ai2")]}
        />
        <PlanCard
          featured
          badge={t("upgrade.pro.badge")}
          icon={<Crown size={18} strokeWidth={1.75} />}
          name={t("upgrade.pro.name")}
          price={`$${proPrice}`}
          note={yearly ? t("upgrade.pro.priceNoteYearly") : t("upgrade.pro.priceNoteMonthly")}
          cta={t("upgrade.pro.cta")}
          ctaStyle="primary"
          features={[t("upgrade.pro.f1"), t("upgrade.pro.f2"), t("upgrade.pro.f3"), t("upgrade.pro.f4"), t("upgrade.pro.f5")]}
          aiTitle={t("upgrade.pro.aiTitle")}
          aiItems={[t("upgrade.pro.ai1"), t("upgrade.pro.ai2"), t("upgrade.pro.ai3")]}
        />
        <PlanCard
          icon={<Users size={18} strokeWidth={1.75} />}
          name={t("upgrade.team.name")}
          price={`$${teamPrice}`}
          note={t("upgrade.team.priceNote")}
          cta={t("upgrade.team.cta")}
          ctaStyle="teal"
          features={[t("upgrade.team.f1"), t("upgrade.team.f2"), t("upgrade.team.f3"), t("upgrade.team.f4"), t("upgrade.team.f5")]}
          aiTitle={t("upgrade.team.aiTitle")}
          aiItems={[t("upgrade.team.ai1"), t("upgrade.team.ai2"), t("upgrade.team.ai3")]}
        />

        <aside className="rounded-2xl border border-line bg-surface/80 p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-[#a78bfa]" />
            <h2 className="text-sm font-semibold text-ink">{t("upgrade.meet.title")}</h2>
          </div>
          <p className="text-[11px] text-inkSoft mb-4">{t("upgrade.meet.subtitle")}</p>
          <div className="space-y-2 flex-1">
            <MeetRow icon={ListTodo} title={t("upgrade.meet.g1")} desc={t("upgrade.meet.g1d")} />
            <MeetRow icon={Zap} title={t("upgrade.meet.g2")} desc={t("upgrade.meet.g2d")} />
            <MeetRow icon={Wand2} title={t("upgrade.meet.g3")} desc={t("upgrade.meet.g3d")} />
            <MeetRow icon={PenLine} title={t("upgrade.meet.g4")} desc={t("upgrade.meet.g4d")} />
            <MeetRow icon={MessageCircle} title={t("upgrade.meet.g5")} desc={t("upgrade.meet.g5d")} />
          </div>
          <blockquote className="mt-4 rounded-xl border border-line bg-paperDark/60 p-3">
            <p className="text-[12px] leading-relaxed text-inkSoft italic">“{t("upgrade.quote")}”</p>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex gap-0.5 text-amber">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} fill="currentColor" />
                ))}
              </div>
              <span className="text-[10px] font-medium text-inkFaint">{t("upgrade.quoteBy")}</span>
            </div>
          </blockquote>
        </aside>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-surface/70 overflow-hidden">
        <div className="px-5 py-4 border-b border-line">
          <h2 className="text-sm font-semibold text-ink">{t("upgrade.compare.title")}</h2>
        </div>
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-inkFaint">
                <th className="text-start font-medium px-5 py-3 w-[32%]">{t("upgrade.compare.feature")}</th>
                <th className="text-start font-medium px-4 py-3">{t("upgrade.free.name")}</th>
                <th className="text-start font-medium px-4 py-3 text-[#a78bfa]">{t("upgrade.pro.name")}</th>
                <th className="text-start font-medium px-4 py-3">{t("upgrade.team.name")}</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row} className="border-t border-line">
                  <td className="px-5 py-3 text-inkSoft">{t(`upgrade.compare.${row}`)}</td>
                  <td className="px-4 py-3 text-ink">{t(`upgrade.compare.v.${row}.free`)}</td>
                  <td className="px-4 py-3 text-ink font-medium">{t(`upgrade.compare.v.${row}.pro`)}</td>
                  <td className="px-4 py-3 text-ink">{t(`upgrade.compare.v.${row}.team`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-5 text-center text-[11px] text-inkFaint">{t("upgrade.trialNote")}</p>
    </div>
  );
}

function PlanCard({
  icon,
  name,
  price,
  note,
  cta,
  ctaStyle,
  features,
  aiTitle,
  aiItems,
  featured,
  badge,
}: {
  icon: React.ReactNode;
  name: string;
  price: string;
  note: string;
  cta: string;
  ctaStyle: "outline" | "primary" | "teal";
  features: string[];
  aiTitle: string;
  aiItems: string[];
  featured?: boolean;
  badge?: string;
}) {
  const ctaClass =
    ctaStyle === "primary"
      ? "bg-gradient-to-r from-[#7c6cff] to-[#6C5CE7] text-white shadow-[0_8px_24px_-8px_rgba(108,92,231,0.8)]"
      : ctaStyle === "teal"
        ? "border border-cyan-400/50 text-cyan-200 hover:bg-cyan-400/10"
        : "border border-line text-ink hover:bg-paperDark";

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-surface/80 p-5 ${
        featured
          ? "border-[#8b7cff] shadow-[0_0_0_1px_rgba(139,124,255,0.35),0_20px_50px_-20px_rgba(108,92,231,0.7)]"
          : "border-line"
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#7c6cff] to-[#6C5CE7] px-3 py-1 text-[10px] font-semibold text-white shadow-raised">
            <Crown size={11} />
            {badge}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-4 mt-1">
        <div className="h-9 w-9 rounded-xl bg-paperDark text-ink flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="text-[11px] text-inkFaint">
            <span className="text-ink text-base font-semibold">{price}</span> / month · {note}
          </p>
        </div>
      </div>

      <button type="button" className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${ctaClass}`}>
        {cta}
      </button>

      <ul className="mt-5 space-y-2">
        {features.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[13px] text-inkSoft">
            <Check size={14} className="mt-0.5 shrink-0 text-[#6C5CE7]" />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-inkFaint mb-2">{aiTitle}</p>
        <ul className="space-y-1.5">
          {aiItems.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12px] text-inkSoft">
              <Sparkles size={12} className="mt-0.5 shrink-0 text-[#a78bfa]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MeetRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof ListTodo;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-line/80 bg-paperDark/40 px-2.5 py-2">
      <div className="mt-0.5 h-7 w-7 rounded-lg bg-[#6C5CE7]/15 text-[#a78bfa] flex items-center justify-center shrink-0">
        <Icon size={13} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink">{title}</p>
        <p className="text-[10px] leading-snug text-inkFaint">{desc}</p>
      </div>
    </div>
  );
}
