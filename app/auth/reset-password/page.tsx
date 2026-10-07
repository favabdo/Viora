"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Moon, Sun } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useThemePreference } from "@/lib/userSettings";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import StatusScreen from "@/components/ui/StatusScreen";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Status = "checking" | "form" | "success" | "error";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const { t, lang, setLang } = useTranslation();

  const [status, setStatus] = useState<Status>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState("");
  const [theme, setTheme] = useThemePreference();

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrorKey("");

    if (newPassword.length < 6) {
      setFormErrorKey("resetPassword.err.minLength");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormErrorKey("resetPassword.err.mismatch");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setStatus("success");
    } catch {
      setFormErrorKey("resetPassword.err.generic");
    } finally {
      setSaving(false);
    }
  }

  async function goToLogin() {
    try {
      await supabase.auth.signOut();
    } catch {
      // ننتقل إلى صفحة الدخول حتى لو تعذّر إنهاء الجلسة هنا
    }
    window.location.assign("/login?reset=1");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-paper">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <div className="flex items-center gap-1" dir="ltr">
            <Image src="/logo-icon.png" alt="Viora" width={28} height={28} priority className="h-7 w-auto" />
            <span className="viora-wordmark text-xl">iora</span>
          </div>
          <span className="text-xs text-inkSoft tracking-wide">Save. Organize. Build Together</span>
        </div>

        <div className="rounded-xl border border-line bg-surface shadow-modal p-6 fade-in">
          <div className="mb-5 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-xl border border-line bg-paperDark/40 p-0.5" role="group" aria-label={t("login.language")}>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`h-8 min-w-9 rounded-lg px-2 text-[11px] font-semibold ${
                  lang === "en" ? "bg-[#1D4ED8] text-white" : "text-inkSoft hover:text-ink"
                }`}
              >
                {t("login.english")}
              </button>
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`h-8 min-w-9 rounded-lg px-2 text-[11px] font-semibold ${
                  lang === "ar" ? "bg-[#1D4ED8] text-white" : "text-inkSoft hover:text-ink"
                }`}
              >
                {t("login.arabic")}
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("shell.enableLight") : t("shell.enableDark")}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-line text-inkSoft hover:text-ink hover:bg-paperDark/60"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          {status === "checking" && (
            <StatusScreen kind="loading" title={t("resetPassword.checkingTitle")} message={t("resetPassword.checking")} />
          )}

          {status === "error" && (
            <>
              <StatusScreen kind="error" title={t("resetPassword.errorTitle")} message={t("resetPassword.err.invalidLink")} />
              <Button type="button" variant="primary" fullWidth onClick={goToLogin} className="mt-5">
                {t("resetPassword.goToLogin")}
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <StatusScreen kind="success" title={t("resetPassword.successTitle")} message={t("resetPassword.success")} />
              <Button type="button" variant="primary" fullWidth onClick={goToLogin} className="mt-5">
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
                  <label className="block text-xs font-medium text-inkSoft mb-1.5">{t("profile.newPassword")}</label>
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
                  <label className="block text-xs font-medium text-inkSoft mb-1.5">
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

                {formErrorKey && (
                  <p className="text-sm text-clay bg-claySoft rounded-lg px-3 py-2">{t(formErrorKey)}</p>
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
