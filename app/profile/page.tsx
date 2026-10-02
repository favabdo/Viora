"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/Input";
import { AlertCircle, Camera, CheckCircle2, DoorOpen, KeyRound, Languages, Lock, Moon, Sun } from "lucide-react";
import VLogoLoader from "@/components/ui/VLogoLoader";
import VioraSplash from "@/components/ui/VioraSplash";
import AvatarCropModal from "@/components/AvatarCropModal";
import ConfirmPasswordModal from "@/components/ConfirmPasswordModal";
import { HOME_PATH } from "@/lib/appRoutes";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { applyTheme, getStoredTheme, Theme } from "@/lib/theme";
import { FieldRow, Segmented, SettingsGroup, SettingsGroupTitle, SettingsHeader, SettingsRow } from "@/components/settingsUi";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function Notice({ kind, text }: { kind: "error" | "success"; text: string }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium leading-tight ${
        kind === "error"
          ? "border-[#E85D4C]/30 bg-[#E85D4C]/10 text-[#C0483B] dark:text-[#F3A99E]"
          : "border-[#14B8A6]/30 bg-[#14B8A6]/10 text-[#0F766E] dark:text-[#5EEAD4]"
      }`}
    >
      <Icon size={15} strokeWidth={2.25} className="shrink-0" />
      <span>{text}</span>
    </p>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, lang, setLang } = useTranslation();
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  function handleThemeChange(next: Theme) {
    setThemeState(next);
    applyTheme(next);
  }

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [timezone, setTimezone] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [infoError, setInfoError] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [sendingReset, setSendingReset] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  const [nilechatLink, setNilechatLink] = useState<{ agentId: number; agentName: string } | null>(null);
  const [nilechatToken, setNilechatToken] = useState("");
  const [linkingNilechat, setLinkingNilechat] = useState(false);
  const [nilechatError, setNilechatError] = useState("");
  const [nilechatMsg, setNilechatMsg] = useState("");

  const [roomsUnlocked, setRoomsUnlocked] = useState(false);
  const [checkingRoomsAuth, setCheckingRoomsAuth] = useState(true);
  const [roomsPasswordInput, setRoomsPasswordInput] = useState("");
  const [unlockingRooms, setUnlockingRooms] = useState(false);
  const [roomsUnlockError, setRoomsUnlockError] = useState("");

  useEffect(() => {
    fetch("/api/rooms/auth")
      .then((r) => r.json())
      .then((data) => setRoomsUnlocked(Boolean(data.unlocked)))
      .catch(() => setRoomsUnlocked(false))
      .finally(() => setCheckingRoomsAuth(false));
  }, []);

  async function unlockRooms() {
    if (!roomsPasswordInput) {
      setRoomsUnlockError(t("rooms.err.enterPasswordFirst"));
      return;
    }
    setUnlockingRooms(true);
    setRoomsUnlockError("");
    try {
      const res = await fetch("/api/rooms/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: roomsPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoomsUnlockError(data.errorCode ? t(`rooms.errCode.${data.errorCode}`) : t("rooms.err.wrongPassword"));
        return;
      }
      setRoomsUnlocked(true);
      setRoomsPasswordInput("");
    } catch {
      setRoomsUnlockError(t("rooms.err.generic"));
    } finally {
      setUnlockingRooms(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
      setChecking(false);
    });
  }, [router]);

  useEffect(() => {
    if (session) loadProfile(session.user.id);
  }, [session]);

  useEffect(() => {
    if (session) loadNilechatLink(session.user.id);
  }, [session]);

  async function loadNilechatLink(userId: string) {
    const { data } = await supabase
      .from("nilechat_links")
      .select("agent_id, agent_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setNilechatLink({ agentId: data.agent_id, agentName: data.agent_name });
  }

  async function linkNilechat() {
    const trimmed = nilechatToken.trim();
    setNilechatError("");
    setNilechatMsg("");
    if (!trimmed) {
      setNilechatError(t("profile.nilechat.err.enterToken"));
      return;
    }
    setLinkingNilechat(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(t("profile.nilechat.err.generic"));

      const res = await fetch("/api/nilechat/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key =
          data.errorCode === "invalid_token" ? "profile.nilechat.err.invalidToken" : "profile.nilechat.err.generic";
        setNilechatError(t(key));
        return;
      }
      setNilechatLink({ agentId: data.agentId, agentName: data.agentName });
      setNilechatToken("");
      setNilechatMsg(t("profile.nilechat.linkedSuccess"));
    } catch {
      setNilechatError(t("profile.nilechat.err.generic"));
    } finally {
      setLinkingNilechat(false);
    }
  }

  async function unlinkNilechat() {
    setNilechatError("");
    setNilechatMsg("");
    setLinkingNilechat(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(t("profile.nilechat.err.generic"));

      const res = await fetch("/api/nilechat/link", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setNilechatError(t("profile.nilechat.err.generic"));
        return;
      }
      setNilechatLink(null);
      setNilechatMsg(t("profile.nilechat.unlinkedSuccess"));
    } catch {
      setNilechatError(t("profile.nilechat.err.generic"));
    } finally {
      setLinkingNilechat(false);
    }
  }

  async function loadProfile(userId: string) {
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, avatar_url, created_at, bio, location, timezone, skills")
      .eq("id", userId)
      .single();
    if (error) {
      const fallback = await supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url, created_at")
        .eq("id", userId)
        .single();
      if (!fallback.error && fallback.data) {
        const p = fallback.data as Profile;
        setProfile(p);
        setFullName(p.full_name || "");
        setUsername(p.username || "");
      }
    } else if (data) {
      const p = data as Profile;
      setProfile(p);
      setFullName(p.full_name || "");
      setUsername(p.username || "");
      setBio(p.bio || "");
      setLocation(p.location || "");
      setTimezone(p.timezone || "");
      setSkills(p.skills || "");
    }
    setLoadingProfile(false);
  }

  async function saveInfo() {
    if (!profile) return;
    setInfoError("");
    setInfoMsg("");

    const trimmedName = fullName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedName) {
      setInfoError(t("profile.err.enterName"));
      return;
    }
    if (!USERNAME_RE.test(normalizedUsername)) {
      setInfoError(t("profile.err.usernameFormat"));
      return;
    }

    setSavingInfo(true);
    try {
      if (normalizedUsername !== profile.username) {
        const { data: exists, error: checkError } = await supabase.rpc("username_exists", {
          check_username: normalizedUsername,
        });
        if (checkError) throw checkError;
        if (exists) {
          setInfoError(t("profile.err.usernameTaken"));
          setSavingInfo(false);
          return;
        }
      }

      const extras = {
        full_name: trimmedName,
        username: normalizedUsername,
        bio: bio.trim() || null,
        location: location.trim() || null,
        timezone: timezone.trim() || null,
        skills: skills.trim() || null,
      };
      const { error } = await supabase.from("profiles").update(extras).eq("id", profile.id);
      if (error) {
        const { error: basicError } = await supabase
          .from("profiles")
          .update({ full_name: trimmedName, username: normalizedUsername })
          .eq("id", profile.id);
        if (basicError) throw basicError;
      }

      setProfile({ ...profile, ...extras });
      setInfoMsg(t("profile.msg.infoSaved"));
    } catch (err: any) {
      setInfoError(err?.message || t("profile.err.generic"));
    } finally {
      setSavingInfo(false);
    }
  }

  function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError(t("profile.err.chooseImage"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError(t("profile.err.imageTooLarge"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadCroppedAvatar(blob: Blob) {
    if (!profile) return;
    setCropImageSrc(null);
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const path = `${profile.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, cacheControl: "3600", contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", profile.id);
      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: url });
    } catch (err: any) {
      setAvatarError(err?.message || t("profile.err.uploadFailed"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function sendPasswordReset() {
    setPasswordError("");
    setPasswordMsg("");

    const email = profile?.email || session?.user.email;
    if (!email) {
      setPasswordError(t("profile.err.verifyAccountFailed"));
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setPasswordMsg(t("profile.msg.resetEmailSent"));
    } catch {
      setPasswordError(t("profile.err.resetEmailFailed"));
    } finally {
      setSendingReset(false);
    }
  }

  async function performDeleteAccount() {
    setDeleteAccountError("");
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      setDeleteAccountError(error.message || t("profile.err.generic"));
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const joinedLabel = profile?.created_at
    ? t("profile.joined").replace("{date}", new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(profile.created_at)))
    : "";

  return (
    <>
      <AnimatePresence>
        {(checking || !session || loadingProfile || !profile) && (
          <VioraSplash key="splash" />
        )}
      </AnimatePresence>
      {session && profile && (
        <main className="min-h-screen px-4 pb-16 sm:px-6">
          <SettingsHeader title={t("profile.title")} onBack={() => router.push(HOME_PATH)} backLabel={t("profile.back")} />
          <div className="mx-auto max-w-2xl">
            {/* كارت الهوية */}
            <section className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface fade-in">
              <div className="flex flex-col items-center px-5 py-6 text-center">
                <div className="relative">
                  <Avatar name={profile.full_name || profile.username} src={profile.avatar_url} size="xl" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label={t("profile.changeAvatar")}
                    className="absolute -bottom-1 -end-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-[#2563EB] text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60"
                  >
                    {uploadingAvatar ? <VLogoLoader size={13} /> : <Camera size={13} strokeWidth={2} />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFileSelect} className="hidden" />
                </div>
                <p className="mt-3 text-[17px] font-semibold text-ink">{profile.full_name || profile.username}</p>
                {profile.username && (
                  <p className="text-sm text-inkFaint" dir="ltr">
                    @{profile.username}
                  </p>
                )}
                <p className="mt-1 text-xs text-inkFaint" dir="ltr">
                  {profile.email || session.user.email}
                </p>
                {joinedLabel && <p className="mt-2 text-[11px] text-inkFaint">{joinedLabel}</p>}
                {avatarError && <p className="mt-2 text-xs text-[#C0483B] dark:text-[#F3A99E]">{avatarError}</p>}
              </div>
            </section>

            {cropImageSrc && (
              <AvatarCropModal imageSrc={cropImageSrc} onCancel={() => setCropImageSrc(null)} onConfirm={uploadCroppedAvatar} />
            )}

            {/* البيانات الأساسية */}
            <SettingsGroupTitle>{t("profile.basicInfo")}</SettingsGroupTitle>
            <SettingsGroup>
              <FieldRow label={t("profile.name")}>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("profile.namePlaceholder")} />
              </FieldRow>
              <FieldRow label={t("profile.username")} hint={t("profile.usernameHint")}>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  dir="ltr"
                  className="font-mono"
                />
              </FieldRow>
              <FieldRow label={t("profile.email")}>
                <Input
                  value={profile.email || session.user.email || ""}
                  disabled
                  dir="ltr"
                  className="text-end opacity-70 cursor-not-allowed"
                />
              </FieldRow>
              <FieldRow label={t("profile.bio")}>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")} rows={3} />
              </FieldRow>
              <div className="grid sm:grid-cols-2">
                <FieldRow label={t("profile.location")}>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("profile.locationPlaceholder")} />
                </FieldRow>
                <FieldRow label={t("profile.timezone")}>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Cairo" dir="ltr" />
                </FieldRow>
              </div>
              <FieldRow label={t("profile.skills")} hint={t("profile.skillsHint")}>
                <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, SQL" dir="ltr" />
              </FieldRow>
              {(infoError || infoMsg) && (
                <div className="space-y-2 px-4 pb-1">
                  {infoError && <Notice kind="error" text={infoError} />}
                  {infoMsg && <Notice kind="success" text={infoMsg} />}
                </div>
              )}
              <div className="px-4 py-4">
                <Button variant="primary" fullWidth loading={savingInfo} onClick={saveInfo}>
                  {t("profile.saveChanges")}
                </Button>
              </div>
            </SettingsGroup>

            {/* الأمان */}
            <SettingsGroupTitle>{t("profile.resetPassword")}</SettingsGroupTitle>
            <SettingsGroup>
              <SettingsRow
                icon={KeyRound}
                title={t("profile.resetPasswordButton")}
                hint={t("profile.resetPasswordHint")}
                control={
                  <Button variant="secondary" size="sm" loading={sendingReset} onClick={sendPasswordReset}>
                    {t("profile.send")}
                  </Button>
                }
              />
              {(passwordError || passwordMsg) && (
                <div className="space-y-2 px-4 pb-4">
                  {passwordError && <Notice kind="error" text={passwordError} />}
                  {passwordMsg && <Notice kind="success" text={passwordMsg} />}
                </div>
              )}
            </SettingsGroup>

            {/* التفضيلات */}
            <SettingsGroupTitle>{t("profile.preferences")}</SettingsGroupTitle>
            <SettingsGroup>
              <SettingsRow
                icon={Languages}
                title={t("profile.language")}
                hint={t("profile.languageHint")}
                control={
                  <Segmented
                    value={lang}
                    onChange={(v) => setLang(v)}
                    options={[
                      { value: "en", label: "EN" },
                      { value: "ar", label: "ع" },
                    ]}
                  />
                }
              />
              <SettingsRow
                icon={theme === "dark" ? Moon : Sun}
                title={t("profile.appearance")}
                hint={t("profile.appearanceHint")}
                control={
                  <Segmented
                    value={theme}
                    onChange={(v) => handleThemeChange(v)}
                    options={[
                      { value: "light", label: <span className="inline-flex items-center gap-1"><Sun size={12} />{t("profile.light")}</span> },
                      { value: "dark", label: <span className="inline-flex items-center gap-1"><Moon size={12} />{t("profile.dark")}</span> },
                    ]}
                  />
                }
              />
            </SettingsGroup>

            {/* قسم Rooms المقفول */}
            {!checkingRoomsAuth && (roomsUnlocked ? (
              <>
                <SettingsGroupTitle>{t("profile.nilechat.title")}</SettingsGroupTitle>
                <SettingsGroup>
                  {nilechatLink ? (
                    <SettingsRow
                      icon={DoorOpen}
                      title={t("profile.nilechat.linkedAs")}
                      hint={nilechatLink.agentName}
                      control={
                        <Button variant="secondary" size="sm" loading={linkingNilechat} onClick={unlinkNilechat}>
                          {t("profile.nilechat.unlink")}
                        </Button>
                      }
                    />
                  ) : (
                    <FieldRow label={t("profile.nilechat.title")} hint={t("profile.nilechat.hint")}>
                      <div className="flex items-center gap-2">
                        <Input
                          value={nilechatToken}
                          onChange={(e) => setNilechatToken(e.target.value)}
                          placeholder={t("profile.nilechat.tokenPlaceholder")}
                          dir="ltr"
                          className="text-end flex-1"
                        />
                        <Button variant="primary" loading={linkingNilechat} onClick={linkNilechat}>
                          {t("profile.nilechat.linkButton")}
                        </Button>
                      </div>
                      {nilechatError && <p className="mt-2 text-xs text-[#C0483B] dark:text-[#F3A99E]">{nilechatError}</p>}
                      {nilechatMsg && <p className="mt-2 text-xs text-[#0F766E] dark:text-[#5EEAD4]">{nilechatMsg}</p>}
                    </FieldRow>
                  )}
                </SettingsGroup>
              </>
            ) : (
              <SettingsGroup>
                <div className="flex flex-col items-center gap-2.5 px-5 py-7 text-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                    <Lock size={18} strokeWidth={1.9} />
                  </span>
                  <p className="text-sm font-medium text-ink">{t("profile.lockedSection.title")}</p>
                  <p className="max-w-[280px] text-xs leading-relaxed text-inkFaint">{t("profile.lockedSection.hint")}</p>
                  <div className="mt-1 flex w-full max-w-[280px] items-center gap-2">
                    <Input
                      type="password"
                      value={roomsPasswordInput}
                      onChange={(e) => setRoomsPasswordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && unlockRooms()}
                      dir="ltr"
                      className="text-end flex-1"
                      placeholder="••••••••"
                    />
                    <Button variant="primary" loading={unlockingRooms} onClick={unlockRooms}>
                      <DoorOpen size={14} strokeWidth={1.75} />
                    </Button>
                  </div>
                  {roomsUnlockError && <p className="text-xs text-[#C0483B] dark:text-[#F3A99E]">{roomsUnlockError}</p>}
                </div>
              </SettingsGroup>
            ))}

            {/* منطقة الخطر */}
            <SettingsGroupTitle>{t("profile.dangerZone")}</SettingsGroupTitle>
            <SettingsGroup danger>
              <SettingsRow
                icon={DoorOpen}
                iconColor="#E85D4C"
                danger
                title={t("profile.deleteAccount")}
                hint={t("profile.deleteAccountWarning")}
                control={
                  <Button variant="danger" size="sm" onClick={() => setShowDeleteAccount(true)}>
                    {t("profile.deleteAccount")}
                  </Button>
                }
              />
              {deleteAccountError && (
                <div className="px-4 pb-4">
                  <Notice kind="error" text={deleteAccountError} />
                </div>
              )}
            </SettingsGroup>
          </div>

          {showDeleteAccount && (
            <ConfirmPasswordModal
              email={profile.email || session.user.email || ""}
              title={t("profile.deleteAccountTitle")}
              message={t("profile.deleteAccountMessage")}
              confirmLabel={t("profile.deleteAccount")}
              onCancel={() => setShowDeleteAccount(false)}
              onConfirm={performDeleteAccount}
            />
          )}
        </main>
      )}
    </>
  );
}
