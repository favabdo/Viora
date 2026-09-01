-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
-- جداول الأفكار منفصلة عن المشاريع: الفكرة مسودة، والمشروع يتخلق عند التحويل.

create extension if not exists "uuid-ossp";

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists ideas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  title text not null,
  description text not null default '',
  icon text not null default 'sparkles',
  color text not null default '#6C5CE7',
  category text not null default 'Product',
  tags text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'implemented', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  project_id uuid references projects(id) on delete set null,
  converted_project_id uuid references projects(id) on delete set null,
  favorite boolean not null default false,
  progress integer not null default 10 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ideas_user_id_idx on ideas(user_id, updated_at desc);
create index if not exists ideas_status_idx on ideas(user_id, status);

drop trigger if exists ideas_touch_updated_at on ideas;
create trigger ideas_touch_updated_at
  before update on ideas
  for each row execute function public.touch_updated_at();

create table if not exists idea_notes (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idea_notes_idea_id_idx on idea_notes(idea_id, created_at);

create table if not exists idea_attachments (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  name text not null,
  size integer not null default 0,
  mime_type text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists idea_attachments_idea_id_idx on idea_attachments(idea_id);

create table if not exists idea_activity (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idea_activity_idea_id_idx on idea_activity(idea_id, created_at desc);

create or replace function public.is_idea_owner(p_idea_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from ideas
    where id = p_idea_id
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_idea_owner(uuid) to authenticated;

alter table ideas enable row level security;
alter table idea_notes enable row level security;
alter table idea_attachments enable row level security;
alter table idea_activity enable row level security;

drop policy if exists "ideas owner access" on ideas;
create policy "ideas owner access" on ideas
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "idea_notes owner access" on idea_notes;
create policy "idea_notes owner access" on idea_notes
  for all
  using (public.is_idea_owner(idea_id))
  with check (public.is_idea_owner(idea_id) and user_id = auth.uid());

drop policy if exists "idea_attachments owner access" on idea_attachments;
create policy "idea_attachments owner access" on idea_attachments
  for all
  using (public.is_idea_owner(idea_id))
  with check (public.is_idea_owner(idea_id) and user_id = auth.uid());

drop policy if exists "idea_activity owner access" on idea_activity;
create policy "idea_activity owner access" on idea_activity
  for all
  using (public.is_idea_owner(idea_id))
  with check (public.is_idea_owner(idea_id));

insert into storage.buckets (id, name, public)
values ('idea-files', 'idea-files', false)
on conflict (id) do nothing;

drop policy if exists "idea files select own" on storage.objects;
create policy "idea files select own" on storage.objects
  for select using (
    bucket_id = 'idea-files' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "idea files insert own" on storage.objects;
create policy "idea files insert own" on storage.objects
  for insert with check (
    bucket_id = 'idea-files' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "idea files update own" on storage.objects;
create policy "idea files update own" on storage.objects
  for update using (
    bucket_id = 'idea-files' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "idea files delete own" on storage.objects;
create policy "idea files delete own" on storage.objects
  for delete using (
    bucket_id = 'idea-files' and auth.uid()::text = (storage.foldername(name))[1]
  );
