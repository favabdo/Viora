"use client";

import ComingSoon from "@/components/ComingSoon";
import { FileText } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function FilesPage() {
  const { t } = useTranslation();
  return <ComingSoon title={t("nav.files")} icon={FileText} />;
}
