"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import StatusScreen from "@/components/ui/StatusScreen";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const INVITE_KEY = "viora_invite_token";

type Preview = {
  project_name: string;
  valid: boolean;
  inviter_name?: string | null;
  inviter_avatar?: string | null;
  access_role?: string | null;
};

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  const { t } = useTranslation();

  const [status, setStatus] = useState<"checking" | "ready" | "needsAuth" | "joining" | "error" | "done">(
    "checking"
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      let row: Preview | null = null;
      const previewRes = await supabase.rpc("invite_link_preview", { p_token: token });
      if (!previewRes.error && previewRes.data) {
        const data = Array.isArray(previewRes.data) ? previewRes.data[0] : previewRes.data;
        row = data as Preview;
      } else {
        const infoRes = await supabase.rpc("invite_link_info", { p_token: token });
        const data = Array.isArray(infoRes.data) ? infoRes.data[0] : infoRes.data;
        if (data) row = data as Preview;
      }

      if (!row || !row.valid) {
        setStatus("error");
        setErrorMsg(t("join.err.invalidInvite"));
        return;
      }
      setPreview(row);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        localStorage.setItem(INVITE_KEY, token);
        setStatus("needsAuth");
        return;
      }
      setStatus("ready");
    })();
  }, [token, t]);

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
    setTimeout(() => router.replace("/?tab=projects"), 900);
  }

  function goToLogin() {
    localStorage.setItem(INVITE_KEY, token);
    router.push("/login?invite=1");
  }

  const projectName = preview?.project_name || "";
  const roleKey = (preview?.access_role || "viewer") as "viewer" | "commenter" | "editor" | "admin";
  const roleLabel = t(`share.role.${roleKey}`);
  const roleHint = t(`share.roleHint.${roleKey}`);

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-2 mb-8">
          <Image src="/logo-full.png" alt="Viora" width={137} height={40} priority className="h-10 w-auto" />
        </div>

        <div className="bg-surface border border-line rounded-2xl shadow-raised p-6 fade-in">
          {status === "checking" && <StatusScreen kind="loading" title={t("join.checkingInvite")} />}

          {(status === "needsAuth" || status === "ready") && preview && (
            <div className="text-center">
              <h1 className="font-display text-lg font-medium mb-5 leading-snug">
                {t("share.invitedHeadline").replace("{project}", projectName)}
              </h1>
              <div className="rounded-xl border border-line bg-surfaceSunken px-4 py-3 flex items-center gap-3 text-start mb-4">
                <Avatar name={preview.inviter_name || t("common.someone")} src={preview.inviter_avatar} size="md" />
                <p className="text-sm text-ink">
                  {t("share.invitedBy").replace("{name}", preview.inviter_name || t("common.someone"))}
                </p>
              </div>
              <div className="rounded-xl border border-line px-4 py-3 text-start mb-5">
                <p className="text-sm font-medium text-ink mb-1">{t("share.joinAs").replace("{role}", roleLabel)}</p>
                <p className="text-xs text-inkSoft">{roleHint}</p>
              </div>
              {status === "ready" ? (
                <Button variant="primary" fullWidth onClick={() => void joinNow()}>
                  {t("share.accept")}
                </Button>
              ) : (
                <Button variant="primary" fullWidth onClick={goToLogin}>
                  {t("join.signInOrCreate")}
                </Button>
              )}
              <div className="mt-4 flex items-center justify-center gap-3 text-xs">
                <button type="button" onClick={goToLogin} className="text-inkFaint hover:text-ink">
                  {t("share.otherAccount")}
                </button>
                <span className="text-lineStrong">·</span>
                <button type="button" onClick={goToLogin} className="text-inkFaint hover:text-ink">
                  {t("share.signUp")}
                </button>
              </div>
            </div>
          )}

          {status === "joining" && <StatusScreen kind="loading" title={t("join.joining")} />}

          {status === "done" && (
            <StatusScreen kind="success" title={t("join.joined")} message={`${t("join.joinedMessage")} ${projectName}`} />
          )}

          {status === "error" && (
            <div className="text-center">
              <StatusScreen kind="error" title={t("join.problemTitle")} message={errorMsg} />
              <button onClick={() => router.replace("/")} className="text-teal text-sm hover:underline mt-5">
                {t("join.backHome")}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
