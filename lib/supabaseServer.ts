import { createClient } from "@supabase/supabase-js";

/**
 * بيرجع Supabase client بس متسجّل بتوكن المستخدم الحالي (JWT بتاعه من الجلسة)،
 * عشان أي عملية insert/update/select تتنفذ "كأنها منه هو" وتحترم RLS عادي
 * (auth.uid() هيرجع الـ id بتاعه صح جوه الـ policies).
 *
 * الفرق عن lib/supabase.ts (الكلاينت العادي في المتصفح): ده بيتستخدم بس جوه
 * ملفات سيرفر (app/api/.../route.ts)، وبياخد التوكن كـ parameter بدل ما يقراه
 * من localStorage (اللي مش متاح على السيرفر أصلًا).
 */
export function supabaseForToken(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
