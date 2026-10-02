-- ============================================================
-- تشديد حدود الخطة المجانية (المرحلة الثانية) — آمن يتشغل أكتر من مرة
--
-- بيغطي اللي كان بيتطبق في المتصفح بس:
--   1) حد الأفكار (10) بقى trigger في القاعدة زي المشاريع والمهام.
--   2) حد التخزين (1 جيجابايت) بقى policy على storage.objects لكل الباكِتات،
--      بيحسب الاستخدام الفعلي من storage.objects بدل عدّ جدولَين فقط.
--   3) نافذة السجل (7 أيام للفري) اتوسّعت لـ idea_activity و
--      link_activity_log و task_comments (كانت على activity_log بس).
--   4) ثغرة can_create_task لما project_id فاضي.
--   5) سقف حجم ملف واحد لكل باكِت (حماية إساءة استخدام — لكل الخطط).
--
-- ملاحظة: البيانات القديمة مش بتتمسح — التصفية في القراءة فقط، فلما
-- المستخدم يترقى للبروه كل سجله القديم بيرجع ظاهر فورًا.
-- ============================================================

-- ------------------------------------------------------------
-- 1) حد الأفكار: 10 في الخطة المجانية
-- ------------------------------------------------------------
create or replace function public.can_create_idea()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.my_plan() <> 'free'
  or (
    select count(*) from ideas where user_id = auth.uid()
  ) < 10
$$;

create or replace function public.enforce_free_idea_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id = auth.uid() and not public.can_create_idea() then
    raise exception 'PLAN_LIMIT: free ideas limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists on_idea_insert_limit on ideas;
create trigger on_idea_insert_limit
  before insert on ideas
  for each row execute function public.enforce_free_idea_limit();

-- ------------------------------------------------------------
-- 2) التخزين: الحساب من storage.objects (كل الباكِتات) ونسبة
--    المساحة لصاحب المشروع في الباكِتات المرتبطة بمشروع.
-- ------------------------------------------------------------

-- مين اللي بيُحاسب على المساحة دي؟
create or replace function public.storage_quota_owner(p_bucket text, p_name text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_bucket in ('task-files', 'project-images') then (
      select p.user_id from projects p
      where p.id = (storage.foldername(p_name))[1]::uuid
    )
    else auth.uid()
  end
$$;

-- إجمالي بايتات المستخدم داخل كل الباكِتات المقاسة
create or replace function public.storage_bytes_used(p_owner uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(size_bytes), 0)::bigint from (
    select coalesce((o.metadata->>'size')::bigint, 0) as size_bytes
    from storage.objects o
    where o.bucket_id in ('avatars', 'idea-files', 'library-files')
      and (storage.foldername(o.name))[1] = p_owner::text
    union all
    select coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
    join projects p on p.id = (storage.foldername(o.name))[1]::uuid
    where o.bucket_id in ('task-files', 'project-images')
      and p.user_id = p_owner
  ) used
$$;

-- للاستخدام في الواجهة: مساحة المستخدم الحالي بالبايت
create or replace function public.my_storage_used()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select public.storage_bytes_used(auth.uid())
$$;

-- الفحص الأساسي: هل الرفع ده داخل سقف الخطة؟
create or replace function public.free_storage_ok(p_bucket text, p_name text, p_size bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.my_plan(), 'free') <> 'free'
  or coalesce(p_size, 0) <= 0
  or public.storage_bytes_used(public.storage_quota_owner(p_bucket, p_name))
     + coalesce(p_size, 0) <= 1073741824 -- 1 GB
$$;

-- النسخة القديمة كانت معرّفة بلا استخدام — بقت تمرّر للدالة الجديدة
drop function if exists public.can_upload_file(bigint);

-- سياسات الإدراج بعد إضافة فحص السقف (نفس شروط الأمان القديمة + السقف)
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.free_storage_ok(bucket_id, name, coalesce((metadata->>'size')::bigint, 0))
  );

drop policy if exists "idea files insert own" on storage.objects;
create policy "idea files insert own" on storage.objects
  for insert with check (
    bucket_id = 'idea-files'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.free_storage_ok(bucket_id, name, coalesce((metadata->>'size')::bigint, 0))
  );

drop policy if exists "library files insert" on storage.objects;
create policy "library files insert" on storage.objects
  for insert with check (
    bucket_id = 'library-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.free_storage_ok(bucket_id, name, coalesce((metadata->>'size')::bigint, 0))
  );

drop policy if exists "task files insert members" on storage.objects;
create policy "task files insert members" on storage.objects
  for insert with check (
    bucket_id = 'task-files'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
    and public.free_storage_ok(bucket_id, name, coalesce((metadata->>'size')::bigint, 0))
  );

drop policy if exists "project images insert members" on storage.objects;
create policy "project images insert members" on storage.objects
  for insert with check (
    bucket_id = 'project-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
    and public.free_storage_ok(bucket_id, name, coalesce((metadata->>'size')::bigint, 0))
  );

-- سقف حجم الملف الواحد (لكل الخطط — حماية من إساءة الاستخدام)
update storage.buckets set file_size_limit = 10485760  where id = 'avatars';        -- 10 MB، زي فحص الواجهة
update storage.buckets set file_size_limit = 52428800  where id = 'idea-files';     -- 50 MB
update storage.buckets set file_size_limit = 52428800  where id = 'library-files';  -- 50 MB
update storage.buckets set file_size_limit = 52428800  where id = 'task-files';     -- 50 MB
update storage.buckets set file_size_limit = 10485760  where id = 'project-images'; -- 10 MB

-- ------------------------------------------------------------
-- 3) ثغرة can_create_task: لو project_id فاضي أو مش موجود كانت
--    بترجع true دايماً (العدّ على مشروع مجهول = 0 < 100).
--    بقى الحساب على مهام المستخدم نفسه في الحالة دي.
-- ------------------------------------------------------------
create or replace function public.can_create_task(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_project_id is null then
      public.my_plan() <> 'free'
      or (select count(*) from tasks t
          join projects p on p.id = t.project_id
          where p.user_id = auth.uid()) < 100
    else
      (
        select coalesce(pr.plan, 'free')
        from projects p
        join profiles pr on pr.id = p.user_id
        where p.id = p_project_id
      ) <> 'free'
      or (
        select count(*)
        from tasks t
        join projects p on p.id = t.project_id
        where p.user_id = (select user_id from projects where id = p_project_id)
      ) < 100
  end
$$;

-- ------------------------------------------------------------
-- 4) نافذة السجل (7 أيام للفري) على باقي جداول السجل
-- ------------------------------------------------------------

-- idea_activity: كانت for all → لازم تتقسم، لأن for all بيسمح بالقراءة
-- القديمة حتى لو أضفنا سياسة select مقيدة (السياسات مسموحة بالـ OR).
drop policy if exists "idea_activity owner access" on idea_activity;

create policy "idea_activity owner select" on idea_activity
  for select using (
    public.is_idea_owner(idea_id)
    and (
      created_at > now() - interval '7 days'
      or public.my_plan() <> 'free'
    )
  );

create policy "idea_activity owner write" on idea_activity
  for insert with check (public.is_idea_owner(idea_id));

create policy "idea_activity owner modify" on idea_activity
  for update using (public.is_idea_owner(idea_id))
  with check (public.is_idea_owner(idea_id));

create policy "idea_activity owner delete" on idea_activity
  for delete using (public.is_idea_owner(idea_id));

-- link_activity_log
drop policy if exists "link_activity_log owner access" on link_activity_log;
create policy "link_activity_log owner access" on link_activity_log
  for select using (
    auth.uid() = user_id
    and (
      created_at > now() - interval '7 days'
      or public.my_plan() <> 'free'
    )
  );

-- task_comments: الخطة تُحسب على صاحب المشروع (زي activity_log)
drop policy if exists "task_comments select members" on task_comments;
create policy "task_comments select members" on task_comments
  for select using (
    public.is_project_member(project_id)
    and (
      created_at > now() - interval '7 days'
      or exists (
        select 1
        from projects p
        join profiles pr on pr.id = p.user_id
        where p.id = task_comments.project_id
          and pr.plan <> 'free'
      )
    )
  );
