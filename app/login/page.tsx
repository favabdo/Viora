"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Mode = "signin" | "signup";

const INVITE_KEY = "viora_invite_token";

function nextDestination() {
  if (typeof window === "undefined") return "/";
  const token = localStorage.getItem(INVITE_KEY);
  return token ? `/join/${token}` : "/";
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      setInfo("تم تأكيد حسابك بنجاح! سجّل دخولك دلوقتي.");
    }
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextDestination());
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
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
          setError("اكتب اسمك");
          setLoading(false);
          return;
        }

        const normalizedUsername = username.trim().toLowerCase();
        if (!USERNAME_RE.test(normalizedUsername)) {
          setError("اسم اليوزر لازم يكون من 3 لـ 20 حرف، وحروف إنجليزي صغيرة أو أرقام أو _ بس");
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
          setError("اليوزر ده متسجل بالفعل، جرّب واحد تاني");
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
            setError("اليوزر ده متسجل بالفعل، جرّب واحد تاني");
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

        setInfo("تم إنشاء الحساب بنجاح. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل دخولك.");
        setMode("signin");
        setName("");
        setUsername("");
      }
    } catch (err: any) {
      setError(err?.message || "حصل خطأ، حاول تاني");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center items-center gap-2 mb-8">
          <Image
            src="/logo-full.png"
            alt="Viora"
            width={52}
            height={45}
            priority
            className="h-10 w-auto"
          />
          <span className="viora-wordmark text-2xl">Viora</span>
        </div>

        <div className="bg-surface border border-line rounded-lg shadow-raised p-6 fade-in">
          <h1 className="font-display text-xl font-medium mb-1 text-center">
            {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
          </h1>
          <p className="text-inkSoft text-sm text-center mb-6">
            {hasInvite
              ? "بعد ما تسجل هتنضم للمشروع اللي اتدعيت له تلقائي"
              : mode === "signin"
              ? "أهلاً بيك تاني في Viora"
              : "ابدأ رحلتك مع Viora"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <div className="fade-in">
                <label className="block text-sm font-medium text-inkSoft mb-1.5">
                  الاسم
                </label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسمك"
                />
              </div>
            )}

            {mode === "signup" && (
              <div className="fade-in">
                <label className="block text-sm font-medium text-inkSoft mb-1.5">
                  اسم اليوزر
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
                  className="font-mono text-left"
                />
                <p className="text-xs text-inkFaint mt-1">
                  حروف إنجليزي صغيرة أو أرقام أو _ بس، من 3 لـ 20 حرف
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">
                البريد الإلكتروني
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">
                كلمة المرور
              </label>
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="text-left"
              />
            </div>

            {error && (
              <p className="text-sm text-clay bg-claySoft rounded-md px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-[#4B6640] bg-sageSoft rounded-md px-3 py-2">
                {info}
              </p>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading} className="mt-1">
              {mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </Button>
          </form>

          <p className="text-center text-sm text-inkSoft mt-5">
            {mode === "signin" ? "لسه معملتش حساب؟" : "عندك حساب بالفعل؟"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
                setUsername("");
              }}
              className="text-teal font-medium hover:underline"
            >
              {mode === "signin" ? "إنشاء حساب" : "تسجيل الدخول"}
            </button>
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
