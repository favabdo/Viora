"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import { Input } from "./ui/Input";
import { X, ShieldAlert } from "lucide-react";

export default function ConfirmPasswordModal({
  email,
  title,
  message,
  confirmLabel = "تأكيد الحذف",
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
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!password) {
      setError("يُرجى إدخال كلمة المرور");
      return;
    }
    setChecking(true);
    setError("");

    // بنتأكد إن كلمة المرور صح قبل ما ننفّذ الحذف
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password });
    if (verifyError) {
      setError("كلمة المرور غير صحيحة");
      setChecking(false);
      return;
    }

    await onConfirm();
    setChecking(false);
  }

  return (
    <div
      className="fixed inset-0 bg-ink/45 flex items-center justify-center p-4 z-50 fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-paper border border-line rounded-lg shadow-modal max-w-xs w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-medium flex items-center gap-1.5">
            <ShieldAlert size={16} strokeWidth={1.75} className="text-clay" />
            {title}
          </h3>
          <IconButton aria-label="إغلاق" onClick={onCancel}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        {message && <p className="text-sm text-inkSoft mb-4 leading-relaxed">{message}</p>}

        <label className="block text-sm font-medium text-inkSoft mb-1.5">كلمة المرور</label>
        <Input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          dir="ltr"
          className="text-left"
          placeholder="••••••••"
        />
        {error && <p className="text-clay text-xs mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={checking}>
            إلغاء
          </Button>
          <Button variant="danger" fullWidth loading={checking} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
