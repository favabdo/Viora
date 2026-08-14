"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Modal from "./ui/Modal";
import { Input } from "./ui/Input";
import { X, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function ConfirmPasswordModal({
  email,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  email: string;
  title: string;
  message?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t("confirmPassword.confirmDelete");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!password) {
      setError(t("confirmPassword.err.enterPassword"));
      return;
    }
    setChecking(true);
    setError("");

    // بنتأكد إن كلمة المرور صح قبل ما ننفّذ الحذف
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password });
    if (verifyError) {
      setError(t("confirmPassword.err.wrongPassword"));
      setChecking(false);
      return;
    }

    await onConfirm();
    setChecking(false);
  }

  return (
    <Modal onClose={onCancel} maxWidth="max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg font-medium flex items-center gap-1.5">
          <ShieldAlert size={16} strokeWidth={1.75} className="text-clay" />
          {title}
        </h3>
        <IconButton aria-label={t("common.close")} onClick={onCancel}>
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      {message && <p className="text-sm text-inkSoft mb-4 leading-relaxed">{message}</p>}

      <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("confirmPassword.password")}</label>
      <Input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
        dir="ltr"
        className="text-end"
        placeholder="••••••••"
      />
      {error && <p className="text-clay text-xs mt-2">{error}</p>}

      <div className="flex gap-2 mt-5">
        <Button variant="secondary" fullWidth onClick={onCancel} disabled={checking}>
          {t("common.cancel")}
        </Button>
        <Button variant="danger" fullWidth loading={checking} onClick={handleConfirm}>
          {resolvedConfirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
