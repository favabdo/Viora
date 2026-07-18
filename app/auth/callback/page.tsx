"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
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
        <span className="h-4 w-4 rounded-full border-2 border-line border-t-bottle animate-spin" />
        جارٍ تأكيد حسابك...
      </div>
    </main>
  );
}
