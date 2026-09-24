-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
--
-- الهدف: ربط حساب Viora بحساب GitHub، وجعل الريبوز بتاعة المستخدم تظهر كمشاريع،
-- وكل كوميت يجي في عمود Done جوه البورد.
--
-- جزء 1 أصلح دالة إنشاء البروفايل: تسجيل Google/GitHub بيبعت يوزرنيم فيه شرطات
-- أو بيبعت إيميل بس، وده كان بيكسر قيد profiles_username_format ().

-- ============================================================
-- 1) يوزرنيم آمن لأي مزوّد تسجيل (بريد/جوجل/جيت هب) + صورة البروفايل
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text;
  base text;
  candidate text;
  n integer := 0;
begin
  raw := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'user_name', ''),  -- جيت هب بيبعت اللوجن هنا
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  );

  base := lower(regexp_replace(raw, '[^a-zA-Z0-9_]', '_', 'g'));
  base := btrim(base, '_');
  if char_length(base) < 3 then
    base := rpad(base, 3, '0');
  end if;
  base := left(base, 20);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := left(base, 20 - char_length(n::text)) || n::text;
  end loop;

  insert into public.profiles (id, username, full_name, email, avatar_url, plan)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'user_name', ''),
      ''
    ),
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      nullif(new.raw_user_meta_data->>'picture', '')
    ),
    'free'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ============================================================
-- 2) جدول الربط: كل ريبو مستوردة = مشروع في Viora
-- ============================================================
create table if not exists github_repos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  repo_id bigint not null unique,
  full_name text not null,
  owner_login text not null,
  repo_name text not null,
  html_url text not null,
  default_branch text not null default 'main',
  is_private boolean not null default false,
  description text,
  language text,
  webhook_id bigint,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists github_repos_user_id_idx on github_repos(user_id);
create index if not exists github_repos_project_id_idx on github_repos(project_id);

alter table github_repos enable row level security;

drop policy if exists "github_repos select related" on github_repos;
create policy "github_repos select related" on github_repos
  for select using (
    user_id = auth.uid()
    or public.is_project_member(project_id)
  );

drop policy if exists "github_repos insert own" on github_repos;
create policy "github_repos insert own" on github_repos
  for insert with check (auth.uid() = user_id);

drop policy if exists "github_repos update own" on github_repos;
create policy "github_repos update own" on github_repos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "github_repos delete own" on github_repos;
create policy "github_repos delete own" on github_repos
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 3) الكوميتات: بتيجي من الـ webhook (service_role) أو من مزامنة الواجهة
-- ============================================================
create table if not exists github_commits (
  id uuid primary key default uuid_generate_v4(),
  repo_row uuid not null references github_repos(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  sha text not null,
  title text not null,
  author_name text,
  author_login text,
  avatar_url text,
  branch text,
  html_url text,
  committed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (repo_row, sha)
);

create index if not exists github_commits_project_idx on github_commits(project_id, committed_at desc);

alter table github_commits enable row level security;

-- أي عضو في المشروع يقدر يشوف كوميتاته
drop policy if exists "github_commits select members" on github_commits;
create policy "github_commits select members" on github_commits
  for select using (public.is_project_member(project_id));

-- الكتابة من صاحب الربط بس (الـ webhook بيكتب بـ service_role اللي اتخطى RLS)
drop policy if exists "github_commits write owner" on github_commits;
create policy "github_commits write owner" on github_commits
  for insert with check (
    exists (
      select 1 from github_repos g
      where g.id = github_commits.repo_row and g.user_id = auth.uid()
    )
  );

drop policy if exists "github_commits delete owner" on github_commits;
create policy "github_commits delete owner" on github_commits
  for delete using (
    exists (
      select 1 from github_repos g
      where g.id = github_commits.repo_row and g.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4) Realtime: أول ما الـ webhook يخزّن كوميت، البورد يتحدّث من غير ريفريش
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'github_commits'
  ) then
    alter publication supabase_realtime add table github_commits;
  end if;
end $$;
