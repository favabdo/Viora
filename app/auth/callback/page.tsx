"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";

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

      // supabase-js بيقرأ التوكن من اللينك ويعمل سيشن تلقائي أول ما الصفحة تفتح
      await supabase.auth.getSession();
      // بنسجّل خروج ونرجّعه لصفحة الدخول عشان يدخل بنفسه بعد التأكيد
      await supabase.auth.signOut();
      router.replace("/login?confirmed=1");
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2.5 text-inkSoft text-sm">
        <span className="h-4 w-4 rounded-full border-2 border-line border-t-teal animate-spin" />
        {t("authCallback.confirming")}
      </div>
    </main>
  );
}
