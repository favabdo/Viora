"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { HOME_PATH } from "@/lib/appRoutes";
import { GH_LINK_DEBUG_KEY, storeGithubToken } from "@/lib/github";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import VioraSplash from "@/components/ui/VioraSplash";

export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const query = typeof window !== "undefined" ? window.location.search : "";
      const recoveryParams = new URLSearchParams(
        [hash.replace(/^#/, ""), query.replace(/^\?/, "")].filter(Boolean).join("&")
      );
      // لينك الاستعادة ممكن يوصل بارامترات في الهاش أو في الـ query حسب الـ redirect URL المضبوط
      if (/recovery/i.test(recoveryParams.get("type") || "")) {
        router.replace(
          `/auth/reset-password${recoveryParams.toString() ? `?${recoveryParams.toString()}` : ""}`
        );
        return;
      }

      // supabase-js بيقرأ الكود/التوكن ويبدّل لجلسة أول ما الصفحة تفتح
      const recoveryListener = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") router.replace("/auth/reset-password");
      });
      const { data } = await supabase.auth.getSession();
      recoveryListener.data.subscription.unsubscribe();

      let session = data.session;
      // دخول جيت هب: نخزّن التوكن على الحساب المرتبط نفسه عشان الاستيراد
      // يشتغل من أي جلسة بعده (حتى المسجّلة بالجيميل) من غير تبديل حساب
      if (session?.provider_token) {
        const link = await storeGithubToken();
        try {
          if (link.stored) sessionStorage.removeItem(GH_LINK_DEBUG_KEY);
          else sessionStorage.setItem(GH_LINK_DEBUG_KEY, link.reason || "unknown");
        } catch {
          // localStorage مش متاح
        }
        session = (await supabase.auth.getSession()).data.session;
      }
      // لينك تأكيد البريد القديم بيوصل هنا بنوع في الهاش؛ أي جلسة تانية = دخول ناجح
      const isEmailConfirmation = /type=(signup|email|magiclink|invite)/i.test(hash);

      if (session && !isEmailConfirmation) {
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
