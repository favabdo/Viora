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

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  is_deleted?: boolean;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  is_done: boolean;
  position: number;
  created_at: string;
  profiles?: { username: string; full_name: string } | null;
};

export type LinkItem = {
  id: string;
  user_id: string;
  url: string;
  description: string;
  is_done: boolean;
  created_at: string;
};

export type MemberStatus = "accepted" | "pending";

export type ProjectMember = {
  id: string;
  project_id: string;
  user_id: string;
  status: MemberStatus;
  invited_by: string | null;
  created_at: string;
  profiles?: { username: string; full_name: string } | null;
};

export type PendingInvite = {
  id: string;
  project_id: string;
  status: MemberStatus;
  invited_by: string | null;
  created_at: string;
  projects?: { name: string } | null;
};

export type ActivityEntry = {
  id: string;
  project_id: string;
  task_id: string | null;
  actor_id: string | null;
  actor_name: string;
  message: string;
  created_at: string;
};

export type LinkLogEntry = {
  id: string;
  link_id: string;
  user_id: string;
  message: string;
  created_at: string;
};
