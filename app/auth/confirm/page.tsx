"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import StatusScreen from "@/components/ui/StatusScreen";
import Button from "@/components/ui/Button";

type Status = "loading" | "success" | "error";

const REDIRECT_DELAY_MS = 1800;

function ConfirmPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("جارٍ التحقق من حسابك...");

  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout>;

    (async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;

      if (!tokenHash || !type) {
        setStatus("error");
        setMessage("رابط التأكيد غير مكتمل أو غير صالح. يُرجى فتح الرابط من البريد الإلكتروني مرة أخرى.");
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
            ? "انتهت صلاحية رابط التأكيد. يُرجى طلب رابط جديد والمحاولة مرة أخرى."
            : "تعذّر تأكيد حسابك. قد يكون الرابط مستخدمًا من قبل أو غير صالح."
        );
        return;
      }

      setStatus("success");
      setMessage("تم تأكيد حسابك بنجاح، سيتم تحويلك الآن...");

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
        <div className="flex justify-center items-center gap-2 mb-8">
          <Image src="/logo-full.png" alt="Viora" width={137} height={40} priority className="h-10 w-auto" />
        </div>

        <div className="bg-surface border border-line rounded-lg shadow-raised p-6 fade-in">
          {status === "loading" && <StatusScreen kind="loading" title="لحظة من فضلك..." message={message} />}

          {status === "success" && <StatusScreen kind="success" title="تم التأكيد" message={message} />}

          {status === "error" && (
            <>
              <StatusScreen kind="error" title="فشل التأكيد" message={message} />
              <Button variant="primary" fullWidth onClick={() => router.replace("/login")} className="mt-5">
                العودة إلى تسجيل الدخول
              </Button>
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
