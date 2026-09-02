"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { HOME_PATH } from "@/lib/appRoutes";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Mode = "signin" | "signup" | "reset";

const INVITE_KEY = "viora_invite_token";

function nextDestination() {
  if (typeof window === "undefined") return "/";
  const token = localStorage.getItem(INVITE_KEY);
  return token ? `/join/${token}` : HOME_PATH;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  const hasInvite = searchParams.get("invite") === "1";

  useEffect(() => {
    if (searchParams.get("confirmed") === "1") {
      setInfo(t("login.confirmedInfo"));
    }
    if (searchParams.get("reset") === "1") {
      setInfo(t("login.resetSuccessInfo"));
    }
  }, [searchParams, t]);

  useEffect(() => {
    const fromReset = searchParams.get("reset") === "1";
    (async () => {
      if (fromReset) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined" && window.location.hash) {
          window.history.replaceState(null, "", "/login?reset=1");
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(nextDestination());
    })();
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "reset") {
        if (!email.trim()) {
          setError(t("login.err.generic"));
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        setInfo(t("login.resetEmailSent"));
        setLoading(false);
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace(nextDestination());
      } else {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setError(t("login.err.enterName"));
          setLoading(false);
          return;
        }

        const normalizedUsername = username.trim().toLowerCase();
        if (!USERNAME_RE.test(normalizedUsername)) {
          setError(t("login.err.usernameFormat"));
          setLoading(false);
          return;
        }

        // نتأكد إن اليوزرنيم متاح قبل ما نبعت طلب التسجيل
        const { data: exists, error: checkError } = await supabase.rpc(
          "username_exists",
          { check_username: normalizedUsername }
        );
        if (checkError) throw checkError;
        if (exists) {
          setError(t("login.err.usernameTaken"));
          setLoading(false);
          return;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: trimmedName, username: normalizedUsername },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          // لو حصل تعارض لحظي على نفس اليوزرنيم (اتسجل من حد تاني في نفس اللحظة)
          if (/duplicate|unique|already exists/i.test(error.message)) {
            setError(t("login.err.usernameTaken"));
            setLoading(false);
            return;
          }
          throw error;
        }

        // لو تأكيد الإيميل مقفول من إعدادات Supabase، بيرجع سيشن على طول
        if (signUpData.session) {
          router.replace(nextDestination());
          return;
        }

        setInfo(t("login.signupSuccess"));
        setMode("signin");
        setName("");
        setUsername("");
      }
    } catch (err: any) {
      setError(err?.message || t("login.err.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <div className="flex justify-center items-center gap-2">
            <Image
              src="/logo-full.png"
              alt="Viora"
              width={137}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </div>
          <span className="text-xs text-inkFaint tracking-wide">Save. Organize. Build Together</span>
        </div>

        <div className="rounded-xl border border-line bg-surface shadow-modal p-6 fade-in">
          <h1 className="text-xl font-semibold mb-1 text-ink">
            {mode === "signin"
              ? t("login.signIn")
              : mode === "reset"
              ? t("login.resetTitle")
              : t("login.createAccount")}
          </h1>
          <p className="text-inkSoft text-sm mb-6 leading-relaxed">
            {mode === "reset"
              ? t("login.resetHint")
              : hasInvite
              ? t("login.inviteHint")
              : mode === "signin"
              ? t("login.welcomeBack")
              : t("login.startJourney")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div className="fade-in">
                <label className="block text-xs font-medium text-inkFaint mb-1.5">
                  {t("login.name")}
                </label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("login.namePlaceholder")}
                />
              </div>
            )}

            {mode === "signup" && (
              <div className="fade-in">
                <label className="block text-xs font-medium text-inkFaint mb-1.5">
                  {t("login.username")}
                </label>
                <Input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="username"
                  dir="ltr"
                />
                <p className="text-xs text-inkFaint mt-1">
                  {t("login.usernameHint")}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-inkFaint mb-1.5">
                {t("login.email")}
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
              />
            </div>

            {mode !== "reset" && (
              <div>
                <label className="block text-xs font-medium text-inkFaint mb-1.5">
                  {t("login.password")}
                </label>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            )}

            {mode === "signin" && (
              <div className="text-end -mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-xs text-[#8C3AED] font-medium hover:underline"
                >
                  {t("login.forgotPassword")}
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-[#E85D4C] bg-[#E85D4C]/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-[#15803D] dark:text-[#4ADE80] bg-[#22C55E]/10 rounded-lg px-3 py-2">
                {info}
              </p>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading} className="mt-2">
              {mode === "signin"
                ? t("login.signIn")
                : mode === "reset"
                ? t("login.sendResetLink")
                : t("login.createAccountBtn")}
            </Button>
          </form>

          <p className="text-center text-sm text-inkSoft mt-5">
            {mode === "reset" ? (
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
                className="text-[#8C3AED] font-medium hover:underline"
              >
                {t("login.backToSignIn")}
              </button>
            ) : (
              <>
                {mode === "signin" ? t("login.noAccountYet") : t("login.haveAccount")}{" "}
                <button
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError(null);
                    setInfo(null);
                    setUsername("");
                  }}
                  className="text-[#8C3AED] font-medium hover:underline"
                >
                  {mode === "signin" ? t("login.createAccount") : t("login.signIn")}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
