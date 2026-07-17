"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const INVITE_KEY = "viora_invite_token";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [status, setStatus] = useState<"checking" | "needsAuth" | "joining" | "error" | "done">(
    "checking"
  );
  const [projectName, setProjectName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: info } = await supabase.rpc("invite_link_info", { p_token: token });
      const row = Array.isArray(info) ? info[0] : info;
      if (!row || !row.valid) {
        setStatus("error");
        setErrorMsg("رابط الدعوة ده مش شغال أو منتهي");
        return;
      }
      setProjectName(row.project_name || "");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        localStorage.setItem(INVITE_KEY, token);
        setStatus("needsAuth");
        return;
      }

      await joinNow();
    })();
  }, [token]);

  async function joinNow() {
    setStatus("joining");
    const { error } = await supabase.rpc("join_project_by_invite", { p_token: token });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message || "حصل خطأ، حاول تاني");
      return;
    }
    localStorage.removeItem(INVITE_KEY);
    setStatus("done");
    setTimeout(() => router.replace("/?tab=tasks"), 900);
  }

  function goToLogin() {
    localStorage.setItem(INVITE_KEY, token);
    router.push("/login?invite=1");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center items-center gap-2.5 mb-8">
          <Image src="/logo-full.png" alt="Viora" width={64} height={56} priority className="h-[52px] w-auto" />
          <span className="viora-wordmark text-4xl">Viora</span>
        </div>

        <div className="bg-paper border border-line rounded-2xl shadow-card p-6 fade-in text-center">
          {status === "checking" && <p className="text-inkSoft text-sm">بنتأكد من رابط الدعوة...</p>}

          {status === "needsAuth" && (
            <>
              <h1 className="font-display text-xl font-semibold mb-2">دعوة للانضمام</h1>
              <p className="text-inkSoft text-sm mb-6">
                إنت متدعي تنضم لمشروع <span className="font-medium text-ink">{projectName}</span>. سجّل دخولك أو
                اعمل حساب عشان تقدر تنضم.
              </p>
              <button
                onClick={goToLogin}
                className="w-full rounded-lg bg-teal hover:bg-tealDark transition-colors text-paper font-medium text-sm py-2.5"
              >
                تسجيل الدخول / إنشاء حساب
              </button>
            </>
          )}

          {status === "joining" && <p className="text-inkSoft text-sm">بتنضم للمشروع...</p>}

          {status === "done" && (
            <p className="text-sage text-sm">تم الانضمام لمشروع {projectName} 🎉</p>
          )}

          {status === "error" && (
            <>
              <p className="text-clay text-sm mb-4">{errorMsg}</p>
              <button
                onClick={() => router.replace("/")}
                className="text-teal text-sm hover:underline"
              >
                الرجوع للرئيسية
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
