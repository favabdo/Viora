-- ============================================================
-- إعدادات اليوزر على الحساب: أي يوزر يفتح من أي جهاز يلاقي نفس
-- اللغة والمظهر وصيغة التاريخ/الوقت وبداية الأسبوع والعرض الافتراضي
-- وخيارات الأرشفة والسلة بالظبط.
-- (آمن يتشغل أكتر من مرة)
-- ============================================================

create table if not exists user_settings (
  user_id uuid primary key references profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_updated_at_idx on user_settings(updated_at);

alter table user_settings enable row level security;

-- اليوزر الوحيد اللي يشوف ويعدّل إعدادات نفسه
drop policy if exists "user_settings owner select" on user_settings;
create policy "user_settings owner select" on user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "user_settings owner insert" on user_settings;
create policy "user_settings owner insert" on user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_settings owner update" on user_settings;
create policy "user_settings owner update" on user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_settings owner delete" on user_settings;
create policy "user_settings owner delete" on user_settings
  for delete using (auth.uid() = user_id);

-- updated_at يتحدّث آليًا مع كل حفظ
create or replace function public.touch_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_user_settings_update on user_settings;
create trigger on_user_settings_update
  before update on user_settings
  for each row execute function public.touch_user_settings_updated_at();
