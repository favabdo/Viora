-- Migration: أضف is_archived للمشاريع
-- شغّل هذا في Supabase SQL Editor

alter table projects
  add column if not exists is_archived boolean not null default false;

-- Index عشان الفلترة تبقى سريعة
create index if not exists projects_is_archived_idx on projects(is_archived);
