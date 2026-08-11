"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck, DoorOpen, XCircle, ListChecks, RefreshCw } from "lucide-react";
import Button from "./ui/Button";
import { Input } from "./ui/Input";
import { SkeletonList } from "./ui/Skeleton";

type ScheduledTask = {
  id: string;
  createdBy: string;
  assignedTo: string;
  text: string;
  done: boolean;
};

export default function RoomsSection() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [doneEditable, setDoneEditable] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // أول ما الصفحة تفتح: نشوف لو معاه كوكي سيشن سليم بالفعل عشان ما نسألوش الباسورد تاني
  useEffect(() => {
    fetch("/api/rooms/auth")
      .then((r) => r.json())
      .then((data) => setUnlocked(Boolean(data.unlocked)))
      .catch(() => setUnlocked(false))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (unlocked) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  async function loadTasks() {
    setLoadingTasks(true);
    setTasksError("");
    try {
      const res = await fetch("/api/rooms/tasks");
      const data = await res.json();
      if (!res.ok) {
        setTasksError(data.error || "فشل تحميل المهام");
        setTasks([]);
        return;
      }
      setTasks(data.tasks as ScheduledTask[]);
      setDoneEditable(Boolean(data.doneEditable));
    } catch {
      setTasksError("حصل خطأ أثناء تحميل المهام");
    } finally {
      setLoadingTasks(false);
    }
  }

  async function toggleDone(task: ScheduledTask) {
    if (!doneEditable || togglingId) return;
    const nextDone = !task.done;
    setTogglingId(task.id);
    // تحديث فوري في الواجهة، ولو فشل التحديث في السيرفر بنرجّعه زي ما كان
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t)));
    try {
      const res = await fetch("/api/rooms/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, done: nextDone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTasksError(data.error || "فشل تحديث حالة المهمة");
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
      }
    } catch {
      setTasksError("حصل خطأ أثناء التحديث");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
    } finally {
      setTogglingId(null);
    }
  }

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

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={17} strokeWidth={1.75} className="text-teal" />
          <h2 className="font-display text-lg font-medium text-ink">NIle Chat Scheduled Tasks</h2>
        </div>
        <button
          onClick={loadTasks}
          disabled={loadingTasks}
          className="flex items-center gap-1 text-xs text-inkSoft hover:text-teal transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} strokeWidth={1.75} className={loadingTasks ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      {tasksError && (
        <div className="flex items-start gap-2.5 rounded-md border border-clay/30 bg-claySoft p-3 mb-4 text-sm">
          <XCircle size={16} strokeWidth={1.75} className="text-clay mt-0.5 shrink-0" />
          <p className="text-ink text-xs">{tasksError}</p>
        </div>
      )}

      {loadingTasks && tasks.length === 0 ? (
        <SkeletonList rows={4} />
      ) : tasks.length === 0 && !tasksError ? (
        <div className="flex flex-col items-center text-center py-10 text-inkSoft text-sm">
          <ListChecks size={20} strokeWidth={1.75} className="mb-2 opacity-60" />
          مفيش مهام دلوقتي في الجدول
        </div>
      ) : (
        <>
          {tasks.length > 0 && (
            <p className="text-xs text-inkSoft mb-3">
              {doneCount} من {tasks.length} خلصوا
            </p>
          )}
          <ul className="space-y-2">
            {[...tasks]
              .sort((a, b) => Number(a.done) - Number(b.done))
              .map((task) => (
                <li
                  key={task.id}
                  className={`rounded-md border border-line p-3 text-sm transition-opacity ${
                    task.done ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => toggleDone(task)}
                      disabled={!doneEditable || togglingId === task.id}
                      title={doneEditable ? "علّم كخلصت/معلقة" : "التعديل مش متاح - عمود الحالة نصي"}
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${
                        task.done ? "bg-teal border-teal" : "border-inkFaint"
                      } ${doneEditable ? "cursor-pointer" : "cursor-not-allowed"}`}
                    >
                      {task.done && <span className="h-1.5 w-1.5 rounded-full bg-paper" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-ink ${task.done ? "line-through" : ""}`}>{task.text}</p>
                      <p className="text-2xs text-inkFaint mt-1">
                        من: <span className="text-inkSoft">{task.createdBy}</span> ← إلى:{" "}
                        <span className="text-inkSoft">{task.assignedTo}</span>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
