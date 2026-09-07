-- ============================================================
-- الخطط (Plans): كل يوزر جديد يبدأ على الخطة المجانية (free)
-- بحدودها: 3 مشاريع، 100 مهمة، 1 جيجابايت تخزين، سجل نشاط 7 أيام
-- (آمن يتشغل أكتر من مرة)
-- ============================================================

-- 1) عمود الخطة على profiles + أعمدة أرصدة الذكاء الاصطناعي للمستقبل
alter table profiles
  add column if not exists plan text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_format'
  ) then
    alter table profiles
      add constraint profiles_plan_format check (plan in ('free', 'pro', 'team'));
  end if;
end $$;

alter table profiles
  add column if not exists ai_credits_used integer not null default 0;
alter table profiles
  add column if not exists ai_credits_period_start timestamptz not null default now();

-- أي يوزر موجود بالفعل يترجّع للخطة المجانية (قابل للتعديل يدويًا لاحقًا)
update profiles set plan = 'free' where plan is null;

-- 2) أول ما حد يسجل، البروفايل يتسجل على الخطة المجانية صراحة
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, plan)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', '')),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'free'
  );
  return new;
end;
$$;

-- 3) خطة اليوزر الحالي
create or replace function public.my_plan()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select plan from profiles where id = auth.uid()),
    'free'
  );
$$;

-- 4) فحوصات الحدود (تُستدعى من الواجهة قبل الإنشاء/الرفع)
create or replace function public.can_create_project()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.my_plan() <> 'free'
  or (
    select count(*)
    from projects
    where user_id = auth.uid()
  ) < 3
$$;

-- الحد على المهام بيتطبق حسب خطة صاحب المشروع (المالك هو صاحب الاشتراك)
create or replace function public.can_create_task(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (
    select coalesce(pr.plan, 'free')
    from projects p
    join profiles pr on pr.id = p.user_id
    where p.id = p_project_id
  ) <> 'free'
  or (
    select count(*)
    from tasks t
    join projects p on p.id = t.project_id
    where p.user_id = (
      select user_id from projects where id = p_project_id
    )
  ) < 100
$$;

-- التخزين = مرفقات المهام + ملفات المكتبة
create or replace function public.can_upload_file(p_size_bytes bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.my_plan() <> 'free'
  or (
    select coalesce(sum(size), 0) from task_attachments
    where exists (
      select 1 from projects p
      where p.id = task_attachments.project_id and p.user_id = auth.uid()
    )
  ) + (
    select coalesce(sum(size), 0) from library_files
    where user_id = auth.uid()
  ) + p_size_bytes <= 1073741824 -- 1 GB
$$;

-- 5) شبكة أمان على مستوى القاعدة: منع تجاوز الحدود حتى لو الواجهة اتخطت
create or replace function public.enforce_free_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id = auth.uid() and not public.can_create_project() then
    raise exception 'PLAN_LIMIT: free projects limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_insert_limit on projects;
create trigger on_project_insert_limit
  before insert on projects
  for each row execute function public.enforce_free_project_limit();

create or replace function public.enforce_free_task_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_create_task(new.project_id) then
    raise exception 'PLAN_LIMIT: free tasks limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists on_task_insert_limit on tasks;
create trigger on_task_insert_limit
  before insert on tasks
  for each row execute function public.enforce_free_task_limit();

-- 6) سجل النشاط: الخطة المجانية تشوف آخر 7 أيام بس
drop policy if exists "activity_log select members" on activity_log;
create policy "activity_log select members" on activity_log
  for select using (
    public.is_project_member(project_id)
    and (
      created_at > now() - interval '7 days'
      or exists (
        select 1
        from projects p
        join profiles pr on pr.id = p.user_id
        where p.id = activity_log.project_id
          and pr.plan <> 'free'
      )
    )
  );

-- ============================================================
-- 7) حماية عمود plan: المستخدم يقدر يحدّث بروفايله لكن مش يقدر
-- يغيّر خطته من الواجهة (الدفع وحده يرفعها لplan > free).
-- ============================================================
create or replace function public.prevent_plan_self_update()
returns trigger
language plpgsql
as $$
begin
  -- الخطة تتغيّر بس من service_role (الدفع/الادمن) أو من الـtrigger عند التسجيل
  if new.plan is distinct from old.plan then
    -- لو auth.uid() = id (مستخدم بيحدّث نفسه) → ارفض
    if auth.uid() = old.id then
      raise exception 'PLAN_IMMUTABLE: plan can only be changed by the system';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_plan_self_update on profiles;
create trigger profiles_block_plan_self_update
  before update on profiles
  for each row execute function public.prevent_plan_self_update();

-- ============================================================
-- 8) تعداد فتح المشاريع: آخر مرة فتح + عدد المرات
-- عشان نفتح المشروع الأكثر استخداماً افتراضياً، ونرتّب القائمة
-- ============================================================
alter table projects
  add column if not exists last_opened_at timestamptz;
alter table projects
  add column if not exists open_count integer not null default 0;

create index if not exists projects_last_opened_idx
  on projects(user_id, last_opened_at desc nulls last);
create index if not exists projects_open_count_idx
  on projects(user_id, open_count desc);
