"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import { Input } from "./ui/Input";
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
    <Modal onClose={onCancel} title={title} maxWidth="max-w-sm">
      {message && <p className="text-sm text-inkSoft mb-4 leading-relaxed">{message}</p>}

      <label className="block text-xs font-medium text-inkFaint mb-1.5">{t("confirmPassword.password")}</label>
      <Input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
        dir="ltr"
        placeholder="••••••••"
      />
      {error && <p className="text-[#E85D4C] text-xs mt-2">{error}</p>}

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
