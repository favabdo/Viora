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
      <p className="text-inkSoft text-sm">بنأكد حسابك...</p>
    </main>
  );
}
