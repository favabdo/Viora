"use client";

import ComingSoon from "@/components/ComingSoon";
import { GanttChart } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function TimelinePage() {
  const { t } = useTranslation();
  return <ComingSoon title={t("nav.timeline")} icon={GanttChart} />;
}
