"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
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
        router.replace("/");
      } else {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setError("اكتب اسمك");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: trimmedName },
          },
        });
        if (error) throw error;
        setInfo("تم إنشاء الحساب بنجاح. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل دخولك.");
        setMode("signin");
        setName("");
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
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-full.png"
            alt="Viora"
            width={220}
            height={70}
            priority
            className="h-auto w-[200px]"
          />
        </div>

        <div className="bg-paper border border-line rounded-2xl shadow-card p-6 fade-in">
          <h1 className="font-display text-2xl font-semibold mb-1 text-center">
            {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
          </h1>
          <p className="text-inkSoft text-sm text-center mb-6">
            {mode === "signin"
              ? "أهلاً بيك تاني في Viora"
              : "ابدأ رحلتك مع Viora"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="fade-in">
                <label className="block text-sm font-medium text-inkSoft mb-1.5">
                  الاسم
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسمك"
                  className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-inkSoft/60 outline-none transition-colors focus:border-teal"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-inkSoft/60 outline-none transition-colors focus:border-teal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-inkSoft/60 outline-none transition-colors focus:border-teal"
              />
            </div>

            {error && (
              <p className="text-sm text-clay bg-clay/10 border border-clay/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-sage bg-sage/10 border border-sage/30 rounded-lg px-3 py-2">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal hover:bg-tealDark transition-colors text-paper font-medium text-sm py-2.5 disabled:opacity-60"
            >
              {loading
                ? "لحظة..."
                : mode === "signin"
                ? "تسجيل الدخول"
                : "إنشاء الحساب"}
            </button>
          </form>

          <p className="text-center text-sm text-inkSoft mt-5">
            {mode === "signin" ? "لسه معملتش حساب؟" : "عندك حساب بالفعل؟"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
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
