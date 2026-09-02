"use client";

import { LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function ComingSoon({
  title,
  icon: Icon,
}: {
  title: string;
  icon: LucideIcon;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/15 text-teal shadow-[0_0_24px_rgba(124,92,255,0.35)]">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <p className="text-sm text-inkFaint">{title}</p>
      <h1 className="mt-1 text-2xl font-semibold text-ink tracking-tight">{t("comingSoon.hint")}</h1>
    </div>
  );
}
