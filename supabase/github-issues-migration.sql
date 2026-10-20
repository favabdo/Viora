-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
--
-- الهدف: الإيشوز المفتوحة من جيت هب تظهر في عمود To Do جوه البورد،
-- زي ما الكوميتات بتظهر في عمود Done بالظبط.
-- لازم يكون supabase/github-migration.sql متشغّل قبله (جدول github_repos).

create table if not exists github_issues (
  id uuid primary key default uuid_generate_v4(),
  repo_row uuid not null references github_repos(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  issue_number integer not null,
  title text not null,
  state text not null default 'open',
  author_login text,
  avatar_url text,
  html_url text,
  opened_at timestamptz not null,
  updated_at timestamptz not null default now(),
  pulled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (repo_row, issue_number)
);

create index if not exists github_issues_project_idx on github_issues(project_id, updated_at desc);

alter table github_issues enable row level security;

-- أي عضو في المشروع يقدر يشوف إيشوزاته
drop policy if exists "github_issues select members" on github_issues;
create policy "github_issues select members" on github_issues
  for select using (public.is_project_member(project_id));

-- الكتابة بصاحب الربط بس
drop policy if exists "github_issues write owner" on github_issues;
create policy "github_issues write owner" on github_issues
  for insert with check (
    exists (
      select 1 from github_repos g
      where g.id = github_issues.repo_row and g.user_id = auth.uid()
    )
  );

drop policy if exists "github_issues update owner" on github_issues;
create policy "github_issues update owner" on github_issues
  for update using (
    exists (
      select 1 from github_repos g
      where g.id = github_issues.repo_row and g.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from github_repos g
      where g.id = github_issues.repo_row and g.user_id = auth.uid()
    )
  );

drop policy if exists "github_issues delete owner" on github_issues;
create policy "github_issues delete owner" on github_issues
  for delete using (
    exists (
      select 1 from github_repos g
      where g.id = github_issues.repo_row and g.user_id = auth.uid()
    )
  );

-- أول ما إيشو يتخزّن أو يتقفل، البورد يتحدّث من غير ريفريش
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'github_issues'
  ) then
    alter publication supabase_realtime add table github_issues;
  end if;
end $$;
