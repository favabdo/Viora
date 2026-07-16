-- شغّل الكود ده في Supabase SQL Editor مرة واحدة بس (آمن يتشغل أكتر من مرة كمان)

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) profiles: بروفايل كل يوزر + اسم يوزر يونيك
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

alter table profiles
  add column if not exists username text,
  add column if not exists full_name text not null default '';

-- نتأكد إن اليوزرنيم شكله سليم (حروف/أرقام/underscore بس، من 3 لـ 20 حرف)
alter table profiles
  drop constraint if exists profiles_username_format;
alter table profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profiles_username_key on profiles (username);

-- ============================================================
-- 2) دالة + trigger بتعمل صف في profiles تلقائي أول ما يتسجل يوزر جديد
--    (شغالة بصلاحية السيرفر، فمش متأثرة بـ RLS، وبتشتغل حتى لو تأكيد الإيميل لسه ما حصلش)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', '')),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3) دالة عامة بتتأكد هل اليوزرنيم متاح ولا لأ (تستخدم قبل التسجيل)
--    آمنة تتنادى حتى من غير تسجيل دخول، وميظهرش منها أي داتا تانية
-- ============================================================
create or replace function public.username_exists(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where username = lower(check_username)
  );
$$;

grant execute on function public.username_exists(text) to anon, authenticated;

-- ============================================================
-- 4) الجداول الأساسية: projects, tasks, links
--    كل واحدة فيها user_id بيتحدد تلقائي بـ auth.uid() وقت الإضافة
-- ============================================================
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table projects
  alter column user_id set default auth.uid();
-- الصفوف القديمة (لو موجودة من قبل تفعيل تسجيل الدخول) مالهاش صاحب معروف، فبنشيلها
delete from projects where user_id is null;
alter table projects
  alter column user_id set not null;

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table tasks
  alter column user_id set default auth.uid();
delete from tasks where user_id is null;
alter table tasks
  alter column user_id set not null;

create table if not exists links (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table links
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table links
  alter column user_id set default auth.uid();
delete from links where user_id is null;
alter table links
  alter column user_id set not null;

create index if not exists tasks_project_id_idx on tasks(project_id);
create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists links_user_id_idx on links(user_id);

-- ============================================================
-- 5) RLS: كل يوزر يشوف ويعدّل بيانات نفسه بس
-- ============================================================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table links enable row level security;

drop policy if exists "profiles select own" on profiles;
create policy "profiles select own" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "public projects access" on projects;
drop policy if exists "projects owner access" on projects;
create policy "projects owner access" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "public tasks access" on tasks;
drop policy if exists "tasks owner access" on tasks;
create policy "tasks owner access" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "public links access" on links;
drop policy if exists "links owner access" on links;
create policy "links owner access" on links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
