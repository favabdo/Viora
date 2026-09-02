-- شغّل الملف مرة في Supabase SQL Editor.
-- مكتبة ملفات حرّة / مربوطة بمشروع أو مهمة، مع وصف.

create extension if not exists "uuid-ossp";

create table if not exists library_files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade default auth.uid(),
  project_id uuid references projects(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  name text not null,
  size integer not null default 0,
  mime_type text not null default '',
  storage_path text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists library_files_user_id_idx on library_files(user_id);
create index if not exists library_files_project_id_idx on library_files(project_id);
create index if not exists library_files_task_id_idx on library_files(task_id);

alter table library_files enable row level security;

drop policy if exists "library_files access" on library_files;
create policy "library_files access" on library_files
  for all
  using (
    user_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
  )
  with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', false)
on conflict (id) do nothing;

drop policy if exists "library files select" on storage.objects;
create policy "library files select" on storage.objects
  for select using (
    bucket_id = 'library-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.library_files f
        where f.storage_path = name
          and (
            f.user_id = auth.uid()
            or (f.project_id is not null and public.is_project_member(f.project_id))
          )
      )
    )
  );

drop policy if exists "library files insert" on storage.objects;
create policy "library files insert" on storage.objects
  for insert with check (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "library files update" on storage.objects;
create policy "library files update" on storage.objects
  for update using (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "library files delete" on storage.objects;
create policy "library files delete" on storage.objects
  for delete using (
    bucket_id = 'library-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.library_files f
        where f.storage_path = name and f.user_id = auth.uid()
      )
    )
  );
