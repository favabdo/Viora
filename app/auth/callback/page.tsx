"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { HOME_PATH } from "@/lib/appRoutes";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import VioraSplash from "@/components/ui/VioraSplash";

export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (/type=recovery/i.test(hash)) {
        router.replace(`/auth/reset-password${hash}`);
        return;
      }

      // supabase-js بيقرأ الكود/التوكن ويبدّل لجلسة أول ما الصفحة تفتح
      const recoveryListener = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") router.replace("/auth/reset-password");
      });
      const { data } = await supabase.auth.getSession();
      recoveryListener.data.subscription.unsubscribe();

      const session = data.session;
      // مزوّد OAuth (جيت هب/جوجل/آزور) = دخول ناجح، نكمّل للتطبيق
      if (session && session.user.app_metadata?.provider !== "email") {
        const invite = typeof window !== "undefined" ? localStorage.getItem("viora_invite_token") : null;
        router.replace(invite ? `/join/${invite}` : HOME_PATH);
        return;
      }

      if (!session) {
        router.replace("/login?oauth=failed");
        return;
      }

      // تأكيد البريد بيسيبه يسجّل بنفسه بعد التأكيد
      await supabase.auth.signOut();
      router.replace("/login?confirmed=1");
    })();
  }, [router]);

  return <VioraSplash label={t("authCallback.confirming")} />;
}
