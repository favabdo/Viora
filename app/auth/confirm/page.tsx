"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "success" | "error";

const REDIRECT_DELAY_MS = 1800;

function ConfirmPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("بنتأكد من حسابك...");

  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout>;

    (async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;

      if (!tokenHash || !type) {
        setStatus("error");
        setMessage("رابط التأكيد ناقص أو غير صالح. جرّب تفتح الرابط من الإيميل تاني.");
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        setStatus("error");
        setMessage(
          /expired/i.test(error.message)
            ? "انتهت صلاحية رابط التأكيد. اطلب رابط جديد وجرّب تاني."
            : "مقدرناش نأكد حسابك. الرابط ممكن يكون مستخدم قبل كده أو غير صالح."
        );
        return;
      }

      setStatus("success");
      setMessage("تم تأكيد حسابك بنجاح! هنحولك دلوقتي...");

      redirectTimer = setTimeout(() => {
        router.replace(data.session ? "/" : "/login?confirmed=1");
      }, REDIRECT_DELAY_MS);
    })();

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center items-center gap-2.5 mb-8">
          <Image
            src="/logo-full.png"
            alt="Viora"
            width={64}
            height={56}
            priority
            className="h-[52px] w-auto"
          />
          <span className="viora-wordmark text-4xl">Viora</span>
        </div>

        <div className="bg-paper border border-line rounded-2xl shadow-card p-6 fade-in text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-line border-t-teal animate-spin" />
              <h1 className="font-display text-xl font-semibold mb-1">
                لحظة واحدة...
              </h1>
              <p className="text-inkSoft text-sm">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-sage/15 border border-sage/30 flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6E8F5C"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1 className="font-display text-xl font-semibold mb-1">
                تم التأكيد
              </h1>
              <p className="text-sm text-sage bg-sage/10 border border-sage/30 rounded-lg px-3 py-2 mt-3">
                {message}
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-clay/15 border border-clay/30 flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#B5533C"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </div>
              <h1 className="font-display text-xl font-semibold mb-1">
                فشل التأكيد
              </h1>
              <p className="text-sm text-clay bg-clay/10 border border-clay/30 rounded-lg px-3 py-2 mt-3 mb-5">
                {message}
              </p>
              <button
                onClick={() => router.replace("/login")}
                className="w-full rounded-lg bg-teal hover:bg-tealDark transition-colors text-paper font-medium text-sm py-2.5"
              >
                الرجوع لتسجيل الدخول
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmPageInner />
    </Suspense>
  );
}
