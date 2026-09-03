-- شغّل الملف مرة في Supabase SQL Editor.
-- أيقونة المشروع وصورته وإعدادات الشكل على الداتابيز عشان تظهر لكل الأعضاء والأجهزة.

create extension if not exists "uuid-ossp";

create table if not exists project_settings (
  project_id uuid primary key references projects(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  image_path text,
  updated_at timestamptz not null default now()
);

alter table project_settings enable row level security;

drop policy if exists "project_settings members select" on project_settings;
create policy "project_settings members select" on project_settings
  for select using (public.is_project_member(project_id));

drop policy if exists "project_settings members insert" on project_settings;
create policy "project_settings members insert" on project_settings
  for insert with check (public.is_project_member(project_id));

drop policy if exists "project_settings members update" on project_settings;
create policy "project_settings members update" on project_settings
  for update using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "project_settings members delete" on project_settings;
create policy "project_settings members delete" on project_settings
  for delete using (public.is_project_member(project_id));

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', false)
on conflict (id) do nothing;

drop policy if exists "project images select members" on storage.objects;
create policy "project images select members" on storage.objects
  for select using (
    bucket_id = 'project-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "project images insert members" on storage.objects;
create policy "project images insert members" on storage.objects
  for insert with check (
    bucket_id = 'project-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "project images update members" on storage.objects;
create policy "project images update members" on storage.objects
  for update using (
    bucket_id = 'project-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "project images delete members" on storage.objects;
create policy "project images delete members" on storage.objects
  for delete using (
    bucket_id = 'project-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );
