"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Lock, Mail, Moon, Shield, Sun } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { HOME_PATH } from "@/lib/appRoutes";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Button from "@/components/ui/Button";

type Mode = "signin" | "signup" | "reset";
type OAuthProvider = "google" | "azure";

const INVITE_KEY = "viora_invite_token";
const REMEMBER_KEY = "viora-remember-email";

function nextDestination() {
  if (typeof window === "undefined") return "/";
  const token = localStorage.getItem(INVITE_KEY);
  return token ? `/join/${token}` : HOME_PATH;
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  const { lang } = useTranslation();
  const mark = <Image src="/logo-icon.png" alt="Viora" width={28} height={28} priority className="h-7 w-auto" />;
  if (compact) return mark;
  const word = <span className="viora-wordmark text-xl">iora</span>;
  return (
    <div className="flex items-center gap-1">
      {lang === "ar" ? (
        <>
          {word}
          {mark}
        </>
      ) : (
        <>
          {mark}
          {word}
        </>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.7h5.2c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12Z" />
      <path fill="#34A853" d="M6.6 14.3 5.5 15.2 3.1 17.1C4.7 20.3 8.1 22.5 12 22.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.7 0-5-1.8-5.8-4.3Z" />
      <path fill="#FBBC05" d="M3.1 6.9C2.4 8.3 2 9.9 2 11.6c0 1.7.4 3.3 1.1 4.7l3.5-2.7c-.2-.7-.4-1.4-.4-2 0-.7.1-1.3.4-2L3.1 6.9Z" />
      <path fill="#4285F4" d="M12 4.8c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 1.8 14.7 1 12 1 8.1 1 4.7 3.2 3.1 6.4l3.5 2.7C7 6.6 9.3 4.8 12 4.8Z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

function DashboardPreview({ theme }: { theme: Theme }) {
  const src = theme === "light" ? "/login-preview-light.png" : "/login-preview-dark.png";
  const masks = [
    { left: "0.8%", top: "88%", width: "13.5%", height: "10.5%" },
    { left: "15.5%", top: "8.5%", width: "36%", height: "7%" },
    { left: "15.5%", top: "66%", width: "27%", height: "20%" },
    { left: "43%", top: "78%", width: "13%", height: "10%" },
    { left: "72.5%", top: "7.5%", width: "26.5%", height: "30%" },
    { left: "72.5%", top: "46%", width: "26.5%", height: "14%" },
  ];
  return (
    <div className="login-preview relative mt-10 w-[min(100%,640px)]">
      <div className="login-preview-frame relative overflow-hidden rounded-2xl border border-line">
        <Image
          src={src}
          alt=""
          width={1600}
          height={1000}
          className="h-auto w-full"
          priority
        />
        {masks.map((box, i) => (
          <span key={i} className="login-mask" style={box} />
        ))}
      </div>
    </div>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang, setLang } = useTranslation();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
  const hasInvite = searchParams.get("invite") === "1";

  useEffect(() => {
    setTheme(getStoredTheme());
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("confirmed") === "1") setInfo(t("login.confirmedInfo"));
    if (searchParams.get("reset") === "1") setInfo(t("login.resetSuccessInfo"));
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

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  async function oauth(provider: OAuthProvider) {
    setError(null);
    setOauthLoading(provider);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setOauthLoading(null);
    if (oauthError) setError(t("login.oauthFailed"));
  }

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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        try {
          if (remember) localStorage.setItem(REMEMBER_KEY, email);
          else localStorage.removeItem(REMEMBER_KEY);
        } catch {
          // ignore
        }
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

        const { data: exists, error: checkError } = await supabase.rpc("username_exists", {
          check_username: normalizedUsername,
        });
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
          if (/duplicate|unique|already exists/i.test(error.message)) {
            setError(t("login.err.usernameTaken"));
            setLoading(false);
            return;
          }
          throw error;
        }

        if (signUpData.session) {
          router.replace(nextDestination());
          return;
        }

        setInfo(t("login.signupSuccess"));
        setMode("signin");
        setName("");
        setUsername("");
      }
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "";
      setError(message || t("login.err.generic"));
    } finally {
      setLoading(false);
    }
  }

  const field =
    "login-field h-12 ps-11 pe-4 text-sm text-ink placeholder:text-inkFaint";

  return (
    <main className="login-scene relative min-h-screen overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex items-center pt-7">
          <BrandLogo />
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,460px)] lg:gap-16">
          <section className="hidden min-w-0 lg:block relative z-10">
            <span className="inline-flex rounded-full bg-[#7C3AED]/20 px-3 py-1 text-xs font-medium text-ink">
              {t("login.heroBadge")}
            </span>
            <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.12] tracking-tight text-ink">
              {t("login.heroTitleBefore")}{" "}
              <span className="text-[#8B5CF6]">Viora</span> {t("login.heroTitleAfter")}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-inkSoft">{t("login.heroSubtitle")}</p>
            <DashboardPreview theme={theme} />
          </section>

          <section className="relative z-30 mx-auto w-full max-w-[420px] lg:mx-0 lg:justify-self-end">
            <div className="login-card rounded-[28px] p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-2">
                <div className="inline-flex rounded-xl border border-line bg-paperDark/40 p-0.5" role="group" aria-label={t("login.language")}>
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`h-8 min-w-9 rounded-lg px-2 text-[11px] font-semibold ${
                      lang === "en" ? "bg-[#7C3AED] text-white" : "text-inkSoft hover:text-ink"
                    }`}
                  >
                    {t("login.english")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("ar")}
                    className={`h-8 min-w-9 rounded-lg px-2 text-[11px] font-semibold ${
                      lang === "ar" ? "bg-[#7C3AED] text-white" : "text-inkSoft hover:text-ink"
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

              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-paperDark/40">
                  <BrandLogo compact />
                </div>
                <h2 className="text-[22px] font-semibold text-ink">
                  {mode === "signin"
                    ? t("login.cardTitle")
                    : mode === "reset"
                    ? t("login.resetTitle")
                    : t("login.createAccount")}
                </h2>
                <p className="mt-1 text-sm text-inkSoft">
                  {mode === "reset"
                    ? t("login.resetHint")
                    : hasInvite
                    ? t("login.inviteHint")
                    : mode === "signin"
                    ? t("login.cardHint")
                    : t("login.startJourney")}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === "signup" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-inkSoft">{t("login.name")}</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("login.namePlaceholder")}
                      className="login-field h-12 px-4 text-sm text-ink placeholder:text-inkFaint"
                    />
                  </label>
                )}
                {mode === "signup" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-inkSoft">{t("login.username")}</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="username"
                      dir="ltr"
                      className="login-field h-12 px-4 text-sm text-ink placeholder:text-inkFaint"
                    />
                    <span className="mt-1 block text-[11px] text-inkFaint">{t("login.usernameHint")}</span>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-inkSoft">{t("login.emailAddress")}</span>
                  <span className="relative block">
                    <Mail size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-inkFaint" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("login.emailPlaceholder")}
                      dir="ltr"
                      className={field}
                    />
                  </span>
                </label>

                {mode !== "reset" && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-inkSoft">{t("login.password")}</span>
                    <span className="relative block">
                      <Lock size={16} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-inkFaint" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("login.passwordPlaceholder")}
                        dir="ltr"
                        className={`${field} pe-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-inkFaint hover:text-ink"
                        aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </span>
                  </label>
                )}

                {mode === "signin" && (
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <label className="inline-flex items-center gap-2 text-sm text-inkSoft">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 rounded accent-[#7C3AED]"
                      />
                      {t("login.rememberMe")}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-sm font-medium text-[#8B5CF6] hover:underline"
                    >
                      {t("login.forgotPassword")}
                    </button>
                  </div>
                )}

                {error && <p className="rounded-xl bg-[#E85D4C]/10 px-3 py-2 text-sm text-[#E85D4C]">{error}</p>}
                {info && (
                  <p className="rounded-xl bg-[#22C55E]/10 px-3 py-2 text-sm text-[#15803D] dark:text-[#4ADE80]">{info}</p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                  className="mt-1 h-12 rounded-xl bg-[#7C3AED] text-sm font-semibold shadow-[0_10px_24px_-8px_rgba(124,58,237,0.85)] hover:bg-[#6D28D9]"
                >
                  {mode === "signin"
                    ? t("login.signIn")
                    : mode === "reset"
                    ? t("login.sendResetLink")
                    : t("login.createAccountBtn")}
                </Button>
              </form>

              {mode !== "reset" && (
                <>
                  <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-inkFaint">
                    <span className="h-px flex-1 bg-line" />
                    {t("login.orContinue")}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => void oauth("google")}
                      disabled={Boolean(oauthLoading)}
                      className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paperDark/30 text-sm text-ink hover:bg-paperDark/60"
                    >
                      <GoogleMark />
                      {t("login.google")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void oauth("azure")}
                      disabled={Boolean(oauthLoading)}
                      className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paperDark/30 text-sm text-ink hover:bg-paperDark/60"
                    >
                      <MicrosoftMark />
                      {t("login.microsoft")}
                    </button>
                  </div>
                </>
              )}

              <p className="mt-6 text-center text-sm text-inkSoft">
                {mode === "reset" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                      setInfo(null);
                    }}
                    className="font-medium text-[#8B5CF6] hover:underline"
                  >
                    {t("login.backToSignIn")}
                  </button>
                ) : (
                  <>
                    {mode === "signin" ? t("login.noAccount") : t("login.haveAccount")}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === "signin" ? "signup" : "signin");
                        setError(null);
                        setInfo(null);
                        setUsername("");
                      }}
                      className="font-semibold text-[#8B5CF6] hover:underline"
                    >
                      {mode === "signin" ? t("login.signUp") : t("login.signIn")}
                    </button>
                  </>
                )}
              </p>
            </div>
          </section>
        </div>

        <footer className="mt-auto flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-inkFaint sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5">
            <Shield size={13} />
            {t("login.secure")}
          </p>
          <p className="inline-flex items-center gap-2">
            <span>{t("login.privacy")}</span>
            <span>·</span>
            <span>{t("login.terms")}</span>
          </p>
        </footer>
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
