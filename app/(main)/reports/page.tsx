"use client";

import ComingSoon from "@/components/ComingSoon";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function ReportsPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t("nav.reports")} icon={BarChart3} />;
}
