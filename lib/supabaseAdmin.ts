import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * كلاينت بـ service_role — بيتستخدم بس جوه الـ routes اللي ماهاش مرتبطة بجلسة
 * مستخدم (زي webhook بتاع GitHub). بيخطي RLS، فممنوع يتصدّر للعميل أو يتستخدم
 * لأي عملية اسمها مستخدم نهائي.
 */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasServiceRole(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
