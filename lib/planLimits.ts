import { supabase } from "@/lib/supabase";

/*
 * حدود الخطة المجانية — الفحص بيتم قبل الإنشاء/الرفع لعرض رسالة واضحة،
 * وفوقيه شبكة أمان (triggers) في القاعدة نفسها.
 * لو الـ migration لسه متطبقتش على القاعدة، الفحص بيفشل بأمان ومبيحرمش المستخدم.
 */

export const FREE_LIMITS = {
  projects: 3,
  tasks: 100,
  storageBytes: 1073741824, // 1 GB
};

function isPlanLimitError(error: { message?: string } | null): boolean {
  return !!error && /PLAN_LIMIT/i.test(error.message ?? "");
}

export async function checkProjectLimit(): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_create_project");
  if (error) return true; // القاعدة لسه مفيهاش الحدود — ممنعش
  return data === true;
}

export async function checkTaskLimit(projectId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_create_task", { p_project_id: projectId });
  if (error) return true;
  return data === true;
}

export async function checkStorageUpload(fileSizeBytes: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_upload_file", { p_size_bytes: fileSizeBytes });
  if (error) return true;
  return data === true;
}

export { isPlanLimitError };
