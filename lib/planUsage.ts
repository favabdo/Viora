"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/*
 * حدود الخطط + حساب الاستخدام الفعلي.
 * مهام الباك لوج متخزنة في localStorage (مش في Supabase) فلازم تتعد مع
 * مهام المشاريع عشان توصل للعدد الكلي ضمن حد الخطة.
 */

export type Plan = "free" | "pro" | "team";

export type PlanLimits = {
  projects: number | null; // null = بلا حد
  tasks: number | null;
  ideas: number | null;
  storageBytes: number | null;
  historyDays: number | null;
};

const GB = 1024 * 1024 * 1024;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { projects: 3, tasks: 100, ideas: 10, storageBytes: 1 * GB, historyDays: 7 },
  pro: { projects: null, tasks: null, ideas: null, storageBytes: 20 * GB, historyDays: null },
  team: { projects: null, tasks: null, ideas: null, storageBytes: 100 * GB, historyDays: null },
};

export function limitsFor(plan: Plan | string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan as Plan) || "free"] ?? PLAN_LIMITS.free;
}

// خطة المستخدم الحالي من profiles
export async function getMyPlan(): Promise<Plan> {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) return "free";
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", uid)
    .single();
  return ((profile as { plan?: Plan } | null)?.plan || "free") as Plan;
}

// كاش على مستوى السيشن — بيمنع ارتداد الحالة بعد أول جلب (تنقل بين الصفحات من غير reflash)
let cachedPlan: Plan | null = null;

/** القيمة الكاشلة فورًا (null لو لسه متجلبتش) — للاستخدام في الفلاتر وقت التحميل */
export function getCachedPlan(): Plan | null {
  return cachedPlan;
}

// هوك React — بيرجع null لحد ما الخطة تتأكد فعلًا، فالرسائل التحذيرية
// الخاصة بفري ما تظهرش لثواني للمستخدمين المدفوعين وقت الريفريش
export function usePlan(): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(cachedPlan);
  useEffect(() => {
    let alive = true;
    getMyPlan().then((p) => {
      cachedPlan = p;
      if (alive) setPlan(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return plan;
}

/**
 * حد السجل حسب الخطة: التاريخ الفاصل (null = بلا حد) + هل الخطة اتأكدت.
 * بيصفّي السجلات الأقدم من historyDays من العرض فقط — البيانات بتفضل في
 * القاعدة، فلما المستخدم يترقى للبروه كل السجل القديم بيرجع ظاهر.
 */
export function useHistoryCutoff(): { cutoff: string | null; loading: boolean; historyDays: number | null } {
  const plan = usePlan();
  const days = limitsFor(plan).historyDays;
  // ثابتة طالما الخطة نفسها ما اتغيرتش — لو اتحسبت من جديد في كل render
  // هتبقى قيمة مختلفة كل مرة، وأي useEffect بيحطها في deps هيعيد الجلب بلا نهاية.
  const cutoff = useMemo(
    () => (plan !== null && days !== null ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null),
    [plan, days]
  );
  return { cutoff, loading: plan === null, historyDays: days };
}

// —— عدّادات الاستخدام ——

export async function countUserProjects(): Promise<number> {
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function countUserTasks(): Promise<number> {
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export async function countUserIdeas(): Promise<number> {
  const { count } = await supabase
    .from("ideas")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

const BACKLOG_KEY = "viora-backlog";

// مهام الباك لوج النشطة (بدون المؤرشفة) من localStorage
export function countBacklogItems(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BACKLOG_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((item) => item?.stage !== "archived").length;
  } catch {
    return 0;
  }
}

// إجمالي مهام المستخدم = مهام المشاريع + مهام الباك لوج النشطة
export async function countTotalTasks(): Promise<number> {
  const dbTasks = await countUserTasks();
  return dbTasks + countBacklogItems();
}

// التخزين المستخدم: من القاعدة نفسها (كل الباكِتات) لو الدالة متفعلة،
// وإلا رجوع لعدّ الجدولَين القديم لحد ما migration plans-enforcement-v2.sql يتشغّل
export async function getUsedStorageBytes(): Promise<number> {
  const { data, error } = await supabase.rpc("my_storage_used");
  if (!error && typeof data === "number") return data;
  const [attachRes, libraryRes] = await Promise.all([
    supabase.from("task_attachments").select("size"),
    supabase.from("library_files").select("size"),
  ]);
  const sum = (rows: { size: number | null }[] | null) =>
    (rows || []).reduce((s, r) => s + (r.size || 0), 0);
  return sum(attachRes.data) + sum(libraryRes.data);
}
