-- شغّل الكود ده في Supabase SQL Editor مرة واحدة بس

create extension if not exists "uuid-ossp";

create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists links (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on tasks(project_id);

-- تفعيل RLS + سماح مفتوح (المشروع شخصي بدون تسجيل دخول)
-- لو عايز تأمين أكتر بعدين اربطه بـ auth.uid()
alter table projects enable row level security;
alter table tasks enable row level security;
alter table links enable row level security;

create policy "public projects access" on projects
  for all using (true) with check (true);

create policy "public tasks access" on tasks
  for all using (true) with check (true);

create policy "public links access" on links
  for all using (true) with check (true);
