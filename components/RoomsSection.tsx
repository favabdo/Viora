"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck, DoorOpen, CheckCircle2, XCircle } from "lucide-react";
import Button from "./ui/Button";
import { Input } from "./ui/Input";
import { SkeletonList } from "./ui/Skeleton";

type ConnectionStatus =
  | { checked: false }
  | { checked: true; connected: true; serverTime: string; database: string }
  | { checked: true; connected: false; error: string };

export default function RoomsSection() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>({ checked: false });

  // أول ما الصفحة تفتح: نشوف لو معاه كوكي سيشن سليم بالفعل عشان ما نسألوش الباسورد تاني
  useEffect(() => {
    fetch("/api/rooms/auth")
      .then((r) => r.json())
      .then((data) => setUnlocked(Boolean(data.unlocked)))
      .catch(() => setUnlocked(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setStatus({ checked: true, connected: true, serverTime: data.serverTime, database: data.database });
        } else {
          setStatus({ checked: true, connected: false, error: data.error || "فشل الاتصال" });
        }
      })
      .catch(() => setStatus({ checked: true, connected: false, error: "فشل الاتصال" }));
  }, [unlocked]);

  async function handleUnlock() {
    if (!password) {
      setError("اكتب كلمة المرور الأول");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/rooms/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "كلمة المرور غير صحيحة");
        return;
      }
      setUnlocked(true);
    } catch {
      setError("حصل خطأ، حاول تاني");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="py-10">
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-4">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-paperDark text-inkSoft">
          <Lock size={19} strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-lg font-medium text-ink mb-1.5">قسم Rooms مميز 🔒</h2>
        <p className="text-sm text-inkSoft leading-relaxed max-w-xs mb-5">
          السيكشن ده Premium ومحتاج كلمة مرور خاصة عشان تدخله. اطلبها من صاحب الموقع.
        </p>

        <div className="w-full max-w-xs text-right">
          <label className="block text-sm font-medium text-inkSoft mb-1.5">كلمة المرور</label>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            dir="ltr"
            className="text-left"
            placeholder="••••••••"
          />
          {error && <p className="text-clay text-xs mt-2">{error}</p>}

          <Button variant="primary" fullWidth loading={submitting} onClick={handleUnlock} className="mt-4">
            <DoorOpen size={15} strokeWidth={1.75} />
            دخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-5">
        <ShieldCheck size={17} strokeWidth={1.75} className="text-teal" />
        <h2 className="font-display text-lg font-medium text-ink">Rooms</h2>
      </div>

      {/* حالة الاتصال بقاعدة بيانات SQL Server - دي خطوة تأكيد الاتصال بس، لسه هنبني عليها عرض الـ Rooms الفعلي */}
      {!status.checked && (
        <div className="py-6">
          <SkeletonList rows={2} />
        </div>
      )}

      {status.checked && status.connected && (
        <div className="flex items-start gap-2.5 rounded-md border border-line bg-sageSoft/40 p-3.5 text-sm">
          <CheckCircle2 size={16} strokeWidth={1.75} className="text-[#3F6136] mt-0.5 shrink-0" />
          <div>
            <p className="text-ink font-medium">الاتصال بقاعدة بيانات Rooms شغال ✅</p>
            <p className="text-inkSoft text-xs mt-1">
              قاعدة البيانات: <span dir="ltr">{status.database}</span> — وقت السيرفر:{" "}
              <span dir="ltr">{new Date(status.serverTime).toLocaleString("ar-EG")}</span>
            </p>
          </div>
        </div>
      )}

      {status.checked && !status.connected && (
        <div className="flex items-start gap-2.5 rounded-md border border-clay/30 bg-claySoft p-3.5 text-sm">
          <XCircle size={16} strokeWidth={1.75} className="text-clay mt-0.5 shrink-0" />
          <div>
            <p className="text-ink font-medium">مش قادر يتصل بقاعدة بيانات Rooms</p>
            <p className="text-inkSoft text-xs mt-1">{status.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
