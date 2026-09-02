"use client";

import { useState } from "react";
import {
  Check,
  Clock3,
  Crown,
  FolderKanban,
  Gift,
  HardDrive,
  Headset,
  Lightbulb,
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
type Accent = "violet" | "teal";

export default function UpgradePlans() {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<Billing>("monthly");
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
    { key: "projects" as const, icon: FolderKanban },
    { key: "tasks" as const, icon: ListTodo },
    { key: "storage" as const, icon: HardDrive },
    { key: "ideas" as const, icon: Lightbulb },
    { key: "history" as const, icon: Clock3 },
    { key: "credits" as const, icon: Sparkles },
    { key: "ai" as const, icon: Wand2 },
    { key: "support" as const, icon: Headset },
  ];

  return (
    <div className="upgrade-stage px-4 sm:px-6 md:px-10 pt-8 md:pt-12 pb-20">
      <div className="relative mx-auto max-w-[1280px]">
        <div className="flex justify-end mb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                !yearly ? "bg-[#7C5CFF] text-white shadow-[0_0_18px_rgba(124,92,255,0.55)]" : "text-white/55 hover:text-white"
              }`}
            >
              {t("upgrade.billing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                yearly ? "bg-[#7C5CFF] text-white shadow-[0_0_18px_rgba(124,92,255,0.55)]" : "text-white/55 hover:text-white"
              }`}
            >
              {t("upgrade.billing.yearly")}
            </button>
            <span className="me-1 rounded-full bg-[#22c55e]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#4ade80] shadow-[0_0_12px_rgba(74,222,128,0.25)]">
              {t("upgrade.billing.save")}
            </span>
          </div>
        </div>

        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-[1.85rem] sm:text-[2.35rem] md:text-[2.75rem] font-semibold tracking-tight text-white leading-[1.15]">
            {t("upgrade.titleBefore")}{" "}
            <span className="bg-gradient-to-r from-[#c4b5fd] via-[#8b7cff] to-[#38bdf8] bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(139,92,246,0.55)]">
              {t("upgrade.titleHighlight")}
            </span>{" "}
            {t("upgrade.titleAfter")}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/60">{t("upgrade.subtitle")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {tags.map((tag) => (
              <span key={tag} className="upgrade-pill rounded-full px-3.5 py-1.5 text-[11px] font-medium text-white/70">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)_minmax(0,1fr)_minmax(250px,280px)] items-stretch">
          <PlanCard
            accent="violet"
            icon={<Gift size={18} strokeWidth={1.7} />}
            name={t("upgrade.free.name")}
            price="$0"
            unit={t("upgrade.free.priceNote")}
            cta={t("upgrade.free.cta")}
            ctaStyle="outline"
            features={[t("upgrade.free.f1"), t("upgrade.free.f2"), t("upgrade.free.f3"), t("upgrade.free.f4"), t("upgrade.free.f5")]}
            aiTitle={t("upgrade.free.aiTitle")}
            aiItems={[t("upgrade.free.ai1"), t("upgrade.free.ai2")]}
          />
          <PlanCard
            featured
            accent="violet"
            badge={t("upgrade.pro.badge")}
            icon={<Crown size={18} strokeWidth={1.7} />}
            name={t("upgrade.pro.name")}
            price={`$${proPrice}`}
            unit="/ month"
            note={yearly ? t("upgrade.pro.priceNoteYearly") : t("upgrade.pro.priceNoteMonthly")}
            cta={t("upgrade.pro.cta")}
            ctaStyle="primary"
            features={[t("upgrade.pro.f1"), t("upgrade.pro.f2"), t("upgrade.pro.f3"), t("upgrade.pro.f4"), t("upgrade.pro.f5")]}
            aiTitle={t("upgrade.pro.aiTitle")}
            aiItems={[t("upgrade.pro.ai1"), t("upgrade.pro.ai2"), t("upgrade.pro.ai3")]}
          />
          <PlanCard
            accent="teal"
            icon={<Users size={18} strokeWidth={1.7} />}
            name={t("upgrade.team.name")}
            price={`$${teamPrice}`}
            unit="/ month"
            note={t("upgrade.team.priceNote")}
            cta={t("upgrade.team.cta")}
            ctaStyle="teal"
            features={[t("upgrade.team.f1"), t("upgrade.team.f2"), t("upgrade.team.f3"), t("upgrade.team.f4"), t("upgrade.team.f5")]}
            aiTitle={t("upgrade.team.aiTitle")}
            aiItems={[t("upgrade.team.ai1"), t("upgrade.team.ai2"), t("upgrade.team.ai3")]}
          />

          <aside className="upgrade-card rounded-2xl p-4 flex flex-col min-h-[440px]">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-[#c4b5fd] drop-shadow-[0_0_8px_rgba(196,181,253,0.8)]" />
              <h2 className="text-sm font-semibold text-white">{t("upgrade.meet.title")}</h2>
            </div>
            <p className="text-[11px] text-white/50 mb-4">{t("upgrade.meet.subtitle")}</p>
            <div className="space-y-2 flex-1">
              <MeetRow icon={ListTodo} tone="violet" title={t("upgrade.meet.g1")} desc={t("upgrade.meet.g1d")} />
              <MeetRow icon={Zap} tone="blue" title={t("upgrade.meet.g2")} desc={t("upgrade.meet.g2d")} />
              <MeetRow icon={Wand2} tone="fuchsia" title={t("upgrade.meet.g3")} desc={t("upgrade.meet.g3d")} />
              <MeetRow icon={PenLine} tone="cyan" title={t("upgrade.meet.g4")} desc={t("upgrade.meet.g4d")} />
              <MeetRow icon={MessageCircle} tone="violet" title={t("upgrade.meet.g5")} desc={t("upgrade.meet.g5d")} />
            </div>
            <blockquote className="mt-4 rounded-xl border border-white/8 bg-black/25 p-3">
              <p className="text-[12px] leading-relaxed text-white/65 italic">“{t("upgrade.quote")}”</p>
              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex gap-0.5 text-[#fbbf24] drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} fill="currentColor" />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-white/40">{t("upgrade.quoteBy")}</span>
              </div>
            </blockquote>
          </aside>
        </div>

        <section className="upgrade-card mt-10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-sm font-semibold text-white">{t("upgrade.compare.title")}</h2>
          </div>
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-white/45">
                  <th className="text-start font-medium px-5 py-3 w-[34%]">{t("upgrade.compare.feature")}</th>
                  <th className="text-start font-medium px-4 py-3">{t("upgrade.free.name")}</th>
                  <th className="text-start font-medium px-4 py-3 text-[#c4b5fd]">{t("upgrade.pro.name")}</th>
                  <th className="text-start font-medium px-4 py-3 text-[#5eead4]">{t("upgrade.team.name")}</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map(({ key, icon: Icon }, i) => (
                  <tr key={key} className={i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent"}>
                    <td className="px-5 py-3 text-white/70">
                      <span className="inline-flex items-center gap-2">
                        <Icon size={14} className="text-[#a78bfa]" />
                        {t(`upgrade.compare.${key}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/80">{t(`upgrade.compare.v.${key}.free`)}</td>
                    <td className="px-4 py-3 text-white font-medium">{t(`upgrade.compare.v.${key}.pro`)}</td>
                    <td className="px-4 py-3 text-white/80">{t(`upgrade.compare.v.${key}.team`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function PlanCard({
  icon,
  name,
  price,
  unit,
  note,
  cta,
  ctaStyle,
  features,
  aiTitle,
  aiItems,
  featured,
  badge,
  accent,
}: {
  icon: React.ReactNode;
  name: string;
  price: string;
  unit: string;
  note?: string;
  cta: string;
  ctaStyle: "outline" | "primary" | "teal";
  features: string[];
  aiTitle: string;
  aiItems: string[];
  featured?: boolean;
  badge?: string;
  accent: Accent;
}) {
  const checkClass = accent === "teal" ? "text-[#2dd4bf]" : "text-[#a78bfa]";
  const ctaClass =
    ctaStyle === "primary"
      ? "text-white bg-gradient-to-r from-[#8b5cf6] via-[#7c5cff] to-[#4f46e5] shadow-[0_10px_28px_-6px_rgba(124,92,255,0.95)]"
      : ctaStyle === "teal"
        ? "border border-[#2dd4bf]/70 text-[#5eead4] shadow-[0_0_18px_rgba(45,212,191,0.18)] hover:bg-[#2dd4bf]/10"
        : "border border-white/25 text-white hover:bg-white/5";

  return (
    <div className={`relative ${featured ? "xl:-mt-3 xl:mb-[-12px]" : ""}`}>
      {featured && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 z-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(139,92,246,0.55) 0%, rgba(99,102,241,0.18) 42%, transparent 70%)",
            filter: "blur(16px)",
          }}
        />
      )}
      <div
        className={`relative z-[1] flex h-full flex-col rounded-2xl p-5 ${featured ? "upgrade-card-pro" : "upgrade-card"}`}
      >
        {badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] px-3 py-1 text-[10px] font-semibold text-white shadow-[0_8px_20px_rgba(124,92,255,0.7)]">
              <Crown size={11} />
              {badge}
            </span>
          </div>
        )}

        <div className="flex items-start gap-3 mb-5 mt-1">
          <div className="upgrade-icon h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{name}</p>
            <p className="mt-0.5 leading-tight">
              <span className="text-[1.65rem] font-semibold tracking-tight text-white">{price}</span>
              <span className="ms-1 text-[12px] text-white/50">{unit}</span>
            </p>
            {note && <p className="text-[11px] text-white/40 mt-0.5">{note}</p>}
          </div>
        </div>

        <button type="button" className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${ctaClass}`}>
          {cta}
        </button>

        <ul className="mt-5 space-y-2.5">
          {features.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] text-white/70">
              <Check size={14} className={`mt-0.5 shrink-0 ${checkClass}`} />
              {item}
            </li>
          ))}
        </ul>

        <div className={`mt-auto pt-4 rounded-xl p-3 ${accent === "teal" ? "upgrade-ai-box-teal" : "upgrade-ai-box"}`}>
          <p className="text-[11px] font-semibold text-white/80 mb-2">{aiTitle}</p>
          <ul className="space-y-1.5">
            {aiItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12px] text-white/65">
                <Sparkles size={12} className={`mt-0.5 shrink-0 ${accent === "teal" ? "text-[#5eead4]" : "text-[#c4b5fd]"}`} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MeetRow({
  icon: Icon,
  title,
  desc,
  tone,
}: {
  icon: typeof ListTodo;
  title: string;
  desc: string;
  tone: "violet" | "blue" | "fuchsia" | "cyan";
}) {
  const tones = {
    violet: "bg-[#7c5cff]/20 text-[#c4b5fd] shadow-[0_0_12px_rgba(124,92,255,0.25)]",
    blue: "bg-[#3b82f6]/20 text-[#93c5fd] shadow-[0_0_12px_rgba(59,130,246,0.25)]",
    fuchsia: "bg-[#d946ef]/18 text-[#e879f9] shadow-[0_0_12px_rgba(217,70,239,0.22)]",
    cyan: "bg-[#22d3ee]/16 text-[#67e8f9] shadow-[0_0_12px_rgba(34,211,238,0.22)]",
  };
  return (
    <div className="flex gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon size={13} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-white">{title}</p>
        <p className="text-[10px] leading-snug text-white/40">{desc}</p>
      </div>
    </div>
  );
}
