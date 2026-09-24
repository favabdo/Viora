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

      // لينك تسجيل البريد بيجي من غيره، والـ OAuth (جوجل/جيت هب) بيجيب provider_token
      const params = new URLSearchParams(hash.replace(/^[#?]/, ""));
      const isOAuth = Boolean(params.get("provider_token"));

      // supabase-js بيقرأ التوكن من اللينك ويعمل سيشن تلقائي أول ما الصفحة تفتح
      const { data } = await supabase.auth.getSession();

      if (isOAuth && data.session) {
        const invite = typeof window !== "undefined" ? localStorage.getItem("viora_invite_token") : null;
        router.replace(invite ? `/join/${invite}` : HOME_PATH);
        return;
      }

      // بنسجّل خروج ونرجّعه لصفحة الدخول عشان يدخل بنفسه بعد التأكيد
      await supabase.auth.signOut();
      router.replace("/login?confirmed=1");
    })();
  }, [router]);

  return <VioraSplash label={t("authCallback.confirming")} />;
}
