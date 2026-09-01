"use client";

import ComingSoon from "@/components/ComingSoon";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function DashboardPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t("nav.dashboard")} icon={LayoutDashboard} />;
}
