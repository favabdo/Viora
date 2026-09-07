"use client";

import { useRouter } from "next/navigation";
import { Crown, FolderKanban, ListTodo, HardDrive, Lightbulb, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/*
 * مودال تجاوز حدود الخطة المجانية — بيظهر لما المستخدم يحاول تجاوز
 * أي حد (مشاريع / مهام / تخزين) ويوجهه لصفحة الترقية /upgrade
 */

export type LimitKind = "projects" | "tasks" | "ideas" | "storage" | "history" | "ai";

const LIMIT_STYLE: Record<
  LimitKind,
  { icon: typeof FolderKanban; iconClass: string }
> = {
  projects: {
    icon: FolderKanban,
    iconClass: "bg-[#7c5cff]/15 text-[#5b4bd6]",
  },
  tasks: {
    icon: ListTodo,
    iconClass: "bg-[#6366f1]/15 text-[#4f46e5]",
  },
  ideas: {
    icon: Lightbulb,
    iconClass: "bg-[#f59e0b]/15 text-[#d97706]",
  },
  storage: {
    icon: HardDrive,
    iconClass: "bg-[#0ea5e9]/15 text-[#0284c7]",
  },
  history: {
    icon: Sparkles,
    iconClass: "bg-[#f59e0b]/15 text-[#d97706]",
  },
  ai: {
    icon: Sparkles,
    iconClass: "bg-[#8b5cf6]/15 text-[#7c3aed]",
  },
};

export default function UpgradeLimitModal({
  kind,
  open,
  onClose,
}: {
  kind: LimitKind;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  if (!open) return null;

  const Icon = LIMIT_STYLE[kind].icon;
  const iconClass = LIMIT_STYLE[kind].iconClass;

  return (
    <Modal onClose={onClose} titleAlign="center" maxWidth="max-w-sm">
      <div className="text-center">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${iconClass} shadow-[0_0_20px_rgba(124,92,255,0.25)]`}
        >
          <Icon size={26} strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-semibold text-ink mb-1.5">
          {t("upgrade.limit.title")}
        </h3>
        <p className="text-[13px] text-inkSoft leading-relaxed mb-1">
          {t(`upgrade.limit.${kind}`)}
        </p>
        <p className="text-[12px] text-inkFaint mb-6">
          {t("upgrade.limit.hint")}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              onClose();
              router.push("/upgrade");
            }}
          >
            <Crown size={16} className="me-1" />
            {t("upgrade.limit.cta")}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            {t("upgrade.limit.later")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
