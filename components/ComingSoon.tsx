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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6C5CE7]/15 text-[#6C5CE7]">
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-inkSoft max-w-sm">{t("comingSoon.hint")}</p>
    </div>
  );
}
