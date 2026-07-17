"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ArrowRight, Camera, Loader2 } from "lucide-react";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");
  const [infoError, setInfoError] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

  async function loadProfile(userId: string) {
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, avatar_url, created_at")
      .eq("id", userId)
      .single();
    if (!error && data) {
      const p = data as Profile;
      setProfile(p);
      setFullName(p.full_name || "");
      setUsername(p.username || "");
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
      setInfoError("يُرجى إدخال اسمك");
      return;
    }
    if (!USERNAME_RE.test(normalizedUsername)) {
      setInfoError(
        "اسم المستخدم يجب أن يكون من 3 إلى 20 حرفًا، ويُسمح فقط بأحرف إنجليزية صغيرة أو أرقام أو الشرطة السفلية (_)"
      );
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
          setInfoError("اسم المستخدم هذا مسجّل بالفعل، يُرجى تجربة اسم آخر");
          setSavingInfo(false);
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: trimmedName, username: normalizedUsername })
        .eq("id", profile.id);
      if (error) throw error;

      setProfile({ ...profile, full_name: trimmedName, username: normalizedUsername });
      setInfoMsg("تم حفظ التغييرات بنجاح");
    } catch (err: any) {
      setInfoError(err?.message || "حدث خطأ، يُرجى المحاولة مرة أخرى");
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("يُرجى اختيار ملف صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("حجم الصورة كبير جدًا (الحد الأقصى 5 ميجابايت)");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
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
      setAvatarError(err?.message || "تعذّر رفع الصورة، يُرجى المحاولة مرة أخرى");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function changePassword() {
    setPasswordError("");
    setPasswordMsg("");

    if (!currentPassword) {
      setPasswordError("يُرجى إدخال كلمة المرور الحالية");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("كلمة المرور الجديدة غير مطابقة للتأكيد");
      return;
    }
    if (!session?.user.email) {
      setPasswordError("تعذّر التحقق من الحساب");
      return;
    }

    setChangingPassword(true);
    try {
      // بنتأكد إن كلمة المرور الحالية صح قبل ما نغيّرها
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setPasswordError("كلمة المرور الحالية غير صحيحة");
        setChangingPassword(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setPasswordMsg("تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err?.message || "حدث خطأ، يُرجى المحاولة مرة أخرى");
    } finally {
      setChangingPassword(false);
    }
  }

  if (checking || !session || loadingProfile || !profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-line border-t-teal animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-8">
      <div className="max-w-lg mx-auto">
        <header className="mb-7 flex items-center gap-3">
          <IconButton aria-label="رجوع" onClick={() => router.push("/")}>
            <ArrowRight size={16} strokeWidth={1.75} />
          </IconButton>
          <h1 className="font-display text-xl font-medium">الملف الشخصي</h1>
        </header>

        {/* الصورة الشخصية */}
        <section className="flex flex-col items-center mb-8 fade-in">
          <div className="relative">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name || profile.username}
                className="h-24 w-24 rounded-full object-cover border border-line"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-tealSoft text-tealDark flex items-center justify-center font-display text-3xl font-medium">
                {(profile.full_name || profile.username || "?").trim().charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="تغيير الصورة الشخصية"
              className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full bg-teal text-paper flex items-center justify-center border-2 border-paper hover:bg-tealDark transition-colors disabled:opacity-60"
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
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          {avatarError && <p className="text-clay text-xs mt-2 text-center max-w-xs">{avatarError}</p>}
        </section>

        {/* البيانات الأساسية */}
        <section className="bg-surface border border-line rounded-lg p-5 mb-5 fade-in">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-4">
            البيانات الأساسية
          </h2>

          <div className="space-y-3.5">
            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">الاسم</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك" />
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">اسم المستخدم</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                dir="ltr"
                className="font-mono text-left"
              />
              <p className="text-xs text-inkFaint mt-1">
                يُسمح فقط بأحرف إنجليزية صغيرة أو أرقام أو الشرطة السفلية (_)، من 3 إلى 20 حرفًا
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">البريد الإلكتروني</label>
              <Input
                value={profile.email || session.user.email || ""}
                disabled
                dir="ltr"
                className="text-left opacity-70 cursor-not-allowed"
              />
            </div>

            {infoError && <p className="text-sm text-clay bg-claySoft rounded-md px-3 py-2">{infoError}</p>}
            {infoMsg && <p className="text-sm text-[#4B6640] bg-sageSoft rounded-md px-3 py-2">{infoMsg}</p>}

            <Button variant="primary" loading={savingInfo} onClick={saveInfo}>
              حفظ التغييرات
            </Button>
          </div>
        </section>

        {/* تغيير كلمة المرور */}
        <section className="bg-surface border border-line rounded-lg p-5 fade-in">
          <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-4">
            تغيير كلمة المرور
          </h2>

          <div className="space-y-3.5">
            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">كلمة المرور الحالية</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                dir="ltr"
                className="text-left"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">كلمة المرور الجديدة</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                dir="ltr"
                className="text-left"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-inkSoft mb-1.5">تأكيد كلمة المرور الجديدة</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                dir="ltr"
                className="text-left"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {passwordError && <p className="text-sm text-clay bg-claySoft rounded-md px-3 py-2">{passwordError}</p>}
            {passwordMsg && <p className="text-sm text-[#4B6640] bg-sageSoft rounded-md px-3 py-2">{passwordMsg}</p>}

            <Button variant="secondary" loading={changingPassword} onClick={changePassword}>
              تغيير كلمة المرور
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
