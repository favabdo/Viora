-- شغّل الملف مرة واحدة في Supabase SQL Editor.
-- مرفقات المهام على Storage عشان تظهر على كل الأجهزة.

create extension if not exists "uuid-ossp";

create table if not exists task_attachments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  name text not null,
  size integer not null default 0,
  mime_type text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_id_idx on task_attachments(task_id);
create index if not exists task_attachments_project_id_idx on task_attachments(project_id);

alter table task_attachments enable row level security;

drop policy if exists "task_attachments members access" on task_attachments;
create policy "task_attachments members access" on task_attachments
  for all
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id) and user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do nothing;

drop policy if exists "task files select members" on storage.objects;
create policy "task files select members" on storage.objects
  for select using (
    bucket_id = 'task-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "task files insert members" on storage.objects;
create policy "task files insert members" on storage.objects
  for insert with check (
    bucket_id = 'task-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "task files update members" on storage.objects;
create policy "task files update members" on storage.objects
  for update using (
    bucket_id = 'task-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "task files delete members" on storage.objects;
create policy "task files delete members" on storage.objects
  for delete using (
    bucket_id = 'task-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );
