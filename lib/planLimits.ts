import { supabase } from "@/lib/supabase";
import {
  countUserProjects,
  countTotalTasks,
  countUserIdeas,
  getUsedStorageBytes,
  getMyPlan,
  limitsFor,
} from "@/lib/planUsage";

/*
 * فحوصات حدود الخطة قبل الإنشاء/الرفع — العد هنا شامل:
 * مهام المشاريع + مهام الباك لوج (localStorage).
 * وفوقيه شبكة أمان (triggers) في القاعدة نفسها للمشاريع والمهام.
 * لو الفحص فشل لأي سبب بيرجع "مسموح" عشان مايحرمش المستخدم.
 */

function planAllows(plan: string, used: number, limit: number | null): boolean {
  if (limit === null) return true;
  if (plan !== "free") return true;
  return used < limit;
}

export async function checkProjectLimit(): Promise<boolean> {
  try {
    const [plan, used] = await Promise.all([getMyPlan(), countUserProjects()]);
    return planAllows(plan, used, limitsFor(plan).projects);
  } catch {
    return true;
  }
}

export async function checkTaskLimit(): Promise<boolean> {
  try {
    const [plan, used] = await Promise.all([getMyPlan(), countTotalTasks()]);
    return planAllows(plan, used, limitsFor(plan).tasks);
  } catch {
    return true;
  }
}

export async function checkIdeaLimit(): Promise<boolean> {
  try {
    const [plan, used] = await Promise.all([getMyPlan(), countUserIdeas()]);
    return planAllows(plan, used, limitsFor(plan).ideas);
  } catch {
    return true;
  }
}

export async function checkStorageUpload(fileSizeBytes: number): Promise<boolean> {
  try {
    const [plan, used] = await Promise.all([getMyPlan(), getUsedStorageBytes()]);
    const cap = limitsFor(plan).storageBytes;
    if (plan !== "free") return true;
    if (cap === null) return true;
    return used + fileSizeBytes <= cap;
  } catch {
    return true;
  }
}

export function isPlanLimitError(error: { message?: string } | null): boolean {
  return !!error && /PLAN_LIMIT/i.test(error.message ?? "");
}
