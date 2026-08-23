"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import StatusScreen from "@/components/ui/StatusScreen";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Status = "checking" | "form" | "success" | "error";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    function markReady() {
      if (cancelled || settled) return;
      settled = true;
      setStatus("form");
    }

    function markError() {
      if (cancelled || settled) return;
      settled = true;
      setStatus("error");
      setErrorMessage(t("resetPassword.err.invalidLink"));
    }

    (async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = (searchParams.get("type") as EmailOtpType | null) || "recovery";

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          markError();
          return;
        }
        markReady();
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        markReady();
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    const timeout = setTimeout(() => {
      if (!settled) markError();
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (newPassword.length < 6) {
      setFormError(t("resetPassword.err.minLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(t("resetPassword.err.mismatch"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setStatus("success");
    } catch {
      setFormError(t("resetPassword.err.generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-paper">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <Image src="/logo-full.png" alt="Viora" width={137} height={40} priority className="h-10 w-auto" />
          <span className="text-xs text-inkFaint tracking-wide">Save. Organize. Build Together</span>
        </div>

        <div className="rounded-xl border border-line bg-surface shadow-modal p-6 fade-in">
          {status === "checking" && (
            <StatusScreen kind="loading" title={t("resetPassword.checkingTitle")} message={t("resetPassword.checking")} />
          )}

          {status === "error" && (
            <>
              <StatusScreen kind="error" title={t("resetPassword.errorTitle")} message={errorMessage} />
              <Button variant="primary" fullWidth onClick={() => router.replace("/login")} className="mt-5">
                {t("resetPassword.goToLogin")}
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <StatusScreen kind="success" title={t("resetPassword.successTitle")} message={t("resetPassword.success")} />
              <Button variant="primary" fullWidth onClick={() => router.replace("/login")} className="mt-5">
                {t("resetPassword.goToLogin")}
              </Button>
            </>
          )}

          {status === "form" && (
            <>
              <h1 className="text-xl font-semibold mb-1 text-ink">{t("resetPassword.title")}</h1>
              <p className="text-inkSoft text-sm mb-6 leading-relaxed">{t("resetPassword.subtitle")}</p>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-inkFaint mb-1.5">{t("profile.newPassword")}</label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-inkFaint mb-1.5">
                    {t("profile.confirmNewPassword")}
                  </label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    autoComplete="new-password"
                  />
                </div>

                {formError && (
                  <p className="text-sm text-clay bg-claySoft rounded-lg px-3 py-2">{formError}</p>
                )}

                <Button type="submit" variant="primary" fullWidth loading={saving} className="mt-2">
                  {t("resetPassword.submit")}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
