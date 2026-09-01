"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Avatar from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/Input";
import { ArrowRight, Camera, Loader2 } from "lucide-react";
import AvatarCropModal from "@/components/AvatarCropModal";
import ConfirmPasswordModal from "@/components/ConfirmPasswordModal";
import { HOME_PATH } from "@/lib/appRoutes";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { applyTheme, getStoredTheme, Theme } from "@/lib/theme";
import { Languages, Sun, Moon, Lock, DoorOpen } from "lucide-react";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

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

  if (checking || !session || loadingProfile || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-teal animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-8 bg-paper">
      <div className="max-w-lg mx-auto">
        <header className="mb-7 flex items-center gap-3">
          <IconButton aria-label={t("profile.back")} onClick={() => router.push(HOME_PATH)}>
            <ArrowRight size={16} strokeWidth={1.75} />
          </IconButton>
          <h1 className="font-display text-xl font-medium">{t("profile.title")}</h1>
        </header>

        {/* الصورة الشخصية */}
        <section className="flex flex-col items-center mb-8 fade-in">
          <div className="relative">
            <Avatar name={profile.full_name || profile.username} src={profile.avatar_url} size="xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label={t("profile.changeAvatar")}
              className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full bg-teal text-white flex items-center justify-center border-2 border-paper hover:bg-tealDark transition-colors disabled:opacity-60"
            >
              {uploadingAvatar ? (
                <Loader2 size={13} strokeWidth={2.5} className="animate-spin" />
              ) : (
                <Camera size={13} strokeWidth={2} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileSelect}
              className="hidden"
            />
          </div>
          {avatarError && <p className="text-clay text-xs mt-2 text-center max-w-xs">{avatarError}</p>}
          {profile.username && (
            <p className="mt-3 text-sm text-inkSoft" dir="ltr">
              @{profile.username}
            </p>
          )}
        </section>

        {cropImageSrc && (
          <AvatarCropModal
            imageSrc={cropImageSrc}
            onCancel={() => setCropImageSrc(null)}
            onConfirm={uploadCroppedAvatar}
          />
        )}

        {/* البيانات الأساسية */}
        <section className="bg-surface border border-line rounded-lg p-5 mb-5 fade-in">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-4">
            {t("profile.basicInfo")}
          </h2>

          <div className="space-y-3.5">
            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.name")}</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("profile.namePlaceholder")} />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.username")}</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                dir="ltr"
                className="font-mono"
              />
              <p className="text-xs text-inkFaint mt-1">{t("profile.usernameHint")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.email")}</label>
              <Input
                value={profile.email || session.user.email || ""}
                disabled
                dir="ltr"
                className="text-end opacity-70 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.bio")}</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bioPlaceholder")} rows={3} />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.location")}</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("profile.locationPlaceholder")} />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.timezone")}</label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Cairo" dir="ltr" />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">{t("profile.skills")}</label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, SQL" dir="ltr" />
              <p className="text-xs text-inkFaint mt-1">{t("profile.skillsHint")}</p>
            </div>

            {infoError && <p className="text-sm text-clay bg-claySoft rounded-md px-3 py-2">{infoError}</p>}
            {infoMsg && <p className="text-sm text-[#3F6136] bg-sageSoft rounded-md px-3 py-2">{infoMsg}</p>}

            <Button variant="primary" loading={savingInfo} onClick={saveInfo}>
              {t("profile.saveChanges")}
            </Button>
          </div>
        </section>

        {/* إعادة تعيين كلمة المرور عبر البريد */}
        <section className="bg-surface border border-line rounded-lg p-5 fade-in">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-2">
            {t("profile.resetPassword")}
          </h2>
          <p className="text-sm text-inkSoft leading-relaxed mb-4">{t("profile.resetPasswordHint")}</p>

          <div className="space-y-3.5">
            {passwordError && <p className="text-sm text-clay bg-claySoft rounded-md px-3 py-2">{passwordError}</p>}
            {passwordMsg && <p className="text-sm text-[#3F6136] bg-sageSoft rounded-md px-3 py-2">{passwordMsg}</p>}

            <Button variant="secondary" loading={sendingReset} onClick={sendPasswordReset}>
              {t("profile.resetPasswordButton")}
            </Button>
          </div>
        </section>

        {/* التفضيلات: اللغة والمظهر */}
        <section className="bg-surface border border-line rounded-lg p-5 mt-5 fade-in">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-4">
            {t("profile.preferences")}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                  <Languages size={14} strokeWidth={1.75} />
                  {t("profile.language")}
                </p>
                <p className="text-xs text-inkFaint mt-0.5">{t("profile.languageHint")}</p>
              </div>
              <div className="flex items-center rounded-md border border-line p-0.5 shrink-0">
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    lang === "en" ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:text-ink"
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setLang("ar")}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    lang === "ar" ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:text-ink"
                  }`}
                >
                  العربية
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-line">
              <div>
                <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                  {theme === "dark" ? <Moon size={14} strokeWidth={1.75} /> : <Sun size={14} strokeWidth={1.75} />}
                  {t("profile.appearance")}
                </p>
                <p className="text-xs text-inkFaint mt-0.5">{t("profile.appearanceHint")}</p>
              </div>
              <div className="flex items-center rounded-md border border-line p-0.5 shrink-0">
                <button
                  onClick={() => handleThemeChange("light")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium transition-colors ${
                    theme === "light" ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:text-ink"
                  }`}
                >
                  <Sun size={13} strokeWidth={1.75} />
                  {t("profile.light")}
                </button>
                <button
                  onClick={() => handleThemeChange("dark")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium transition-colors ${
                    theme === "dark" ? "bg-tealSoft text-tealDark" : "text-inkSoft hover:text-ink"
                  }`}
                >
                  <Moon size={13} strokeWidth={1.75} />
                  {t("profile.dark")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* قسم مقفول بكلمة مرور Rooms - مفيش أي إشارة لـ NileChat خالص لحد ما يتفتح */}
        {checkingRoomsAuth ? null : roomsUnlocked ? (
          <section className="bg-surface border border-line rounded-lg p-5 mt-5 fade-in">
            <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-2">
              {t("profile.nilechat.title")}
            </h2>
            <p className="text-xs text-inkFaint mb-4 leading-relaxed">{t("profile.nilechat.hint")}</p>

            {nilechatLink ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink">
                  {t("profile.nilechat.linkedAs")}: <span className="font-medium">{nilechatLink.agentName}</span>
                </p>
                <Button variant="secondary" loading={linkingNilechat} onClick={unlinkNilechat}>
                  {t("profile.nilechat.unlink")}
                </Button>
              </div>
            ) : (
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
            )}

            {nilechatError && <p className="text-clay text-xs mt-2">{nilechatError}</p>}
            {nilechatMsg && <p className="text-teal text-xs mt-2">{nilechatMsg}</p>}
          </section>
        ) : (
          <section className="bg-surface border border-line rounded-lg p-5 mt-5 fade-in">
            <div className="flex flex-col items-center text-center gap-2.5 py-2">
              <Lock size={17} strokeWidth={1.75} className="text-inkSoft" />
              <p className="text-sm font-medium text-ink">{t("profile.lockedSection.title")}</p>
              <p className="text-xs text-inkSoft max-w-[260px] leading-relaxed">{t("profile.lockedSection.hint")}</p>
              <div className="flex items-center gap-2 w-full max-w-[260px] mt-1.5">
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
              {roomsUnlockError && <p className="text-clay text-xs">{roomsUnlockError}</p>}
            </div>
          </section>
        )}

        {/* منطقة الخطر: حذف الحساب */}
        <section className="bg-surface border border-clay/30 rounded-lg p-5 mt-5 fade-in">
          <h2 className="text-2xs font-semibold tracking-wide text-clay uppercase mb-3">{t("profile.dangerZone")}</h2>
          <p className="text-sm text-inkSoft mb-4 leading-relaxed">{t("profile.deleteAccountWarning")}</p>
          {deleteAccountError && (
            <p className="text-sm text-clay bg-claySoft rounded-md px-3 py-2 mb-3">{deleteAccountError}</p>
          )}
          <Button variant="danger" onClick={() => setShowDeleteAccount(true)}>
            {t("profile.deleteAccount")}
          </Button>
        </section>
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
  );
}
