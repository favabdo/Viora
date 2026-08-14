"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import StatusScreen from "@/components/ui/StatusScreen";
import Button from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Status = "loading" | "success" | "error";

const REDIRECT_DELAY_MS = 1800;

function ConfirmPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");
  const displayMessage = message || t("authConfirm.checking");

  useEffect(() => {
    let redirectTimer: ReturnType<typeof setTimeout>;

    (async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;

      if (!tokenHash || !type) {
        setStatus("error");
        setMessage(t("authConfirm.err.invalidLink"));
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        setStatus("error");
        setMessage(
          /expired/i.test(error.message) ? t("authConfirm.err.expiredLink") : t("authConfirm.err.confirmFailed")
        );
        return;
      }

      setStatus("success");
      setMessage(t("authConfirm.success"));

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
          {status === "loading" && <StatusScreen kind="loading" title={t("authConfirm.loadingTitle")} message={displayMessage} />}

          {status === "success" && <StatusScreen kind="success" title={t("authConfirm.successTitle")} message={displayMessage} />}

          {status === "error" && (
            <>
              <StatusScreen kind="error" title={t("authConfirm.errorTitle")} message={displayMessage} />
              <Button variant="primary" fullWidth onClick={() => router.replace("/login")} className="mt-5">
                {t("authConfirm.backToLogin")}
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
