"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import StatusScreen from "@/components/ui/StatusScreen";
import Button from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const INVITE_KEY = "viora_invite_token";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  const { t } = useTranslation();

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
        setErrorMsg(t("join.err.invalidInvite"));
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
      setErrorMsg(error.message || t("profile.err.generic"));
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
        <div className="flex justify-center items-center gap-2 mb-8">
          <Image src="/logo-full.png" alt="Viora" width={137} height={40} priority className="h-10 w-auto" />
        </div>

        <div className="bg-surface border border-line rounded-lg shadow-raised p-6 fade-in">
          {status === "checking" && (
            <StatusScreen kind="loading" title={t("join.checkingInvite")} />
          )}

          {status === "needsAuth" && (
            <div className="text-center">
              <h1 className="font-display text-lg font-medium mb-2">{t("join.title")}</h1>
              <p className="text-inkSoft text-sm mb-6 leading-relaxed">
                {t("join.invitedTo")} <span className="font-medium text-ink">{projectName}</span>. {t("join.pleaseSignIn")}
              </p>
              <Button variant="primary" fullWidth onClick={goToLogin}>
                {t("join.signInOrCreate")}
              </Button>
            </div>
          )}

          {status === "joining" && (
            <StatusScreen kind="loading" title={t("join.joining")} />
          )}

          {status === "done" && (
            <StatusScreen kind="success" title={t("join.joined")} message={`${t("join.joinedMessage")} ${projectName}`} />
          )}

          {status === "error" && (
            <div className="text-center">
              <StatusScreen kind="error" title={t("join.problemTitle")} message={errorMsg} />
              <button
                onClick={() => router.replace("/")}
                className="text-teal text-sm hover:underline mt-5"
              >
                {t("join.backHome")}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
