import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase env vars are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
  );
}

// فولباك وهمي عشان الـ build المحلي/prerender ما يفشلش لو المتغيرات مش موجودة لسه
// في وقت التشغيل الفعلي المتصفح هيستخدم القيم الحقيقية من .env.local أو Vercel env vars
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

export type Project = {
  id: string;
  name: string;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  is_done: boolean;
  created_at: string;
};

export type LinkItem = {
  id: string;
  url: string;
  description: string;
  created_at: string;
};
