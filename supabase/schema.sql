-- شغّل الكود ده في Supabase SQL Editor مرة واحدة بس (آمن يتشغل أكتر من مرة كمان)

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) profiles: بروفايل كل يوزر + اسم يوزر يونيك
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

alter table profiles
  add column if not exists username text,
  add column if not exists full_name text not null default '';

alter table profiles
  drop constraint if exists profiles_username_format;
alter table profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profiles_username_key on profiles (username);

-- ============================================================
-- 2) دالة + trigger بتعمل صف في profiles تلقائي أول ما يتسجل يوزر جديد
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', '')),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3) دالة عامة بتتأكد هل اليوزرنيم متاح ولا لأ
-- ============================================================
create or replace function public.username_exists(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where username = lower(check_username)
  );
$$;

grant execute on function public.username_exists(text) to anon, authenticated;

-- ============================================================
-- 4) الجداول الأساسية: projects, tasks, links
-- ============================================================
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table projects
  alter column user_id set default auth.uid();
delete from projects where user_id is null;
alter table projects
  alter column user_id set not null;

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table tasks
  alter column user_id set default auth.uid();
delete from tasks where user_id is null;
alter table tasks
  alter column user_id set not null;

create table if not exists links (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table links
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table links
  alter column user_id set default auth.uid();
delete from links where user_id is null;
alter table links
  alter column user_id set not null;

create index if not exists tasks_project_id_idx on tasks(project_id);
create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists links_user_id_idx on links(user_id);

-- ============================================================
-- 5) المشاركة في المشاريع: أعضاء، دعوات بلينك، ودعوات مباشرة باليوزرنيم
--    (بتتصل بـ profiles.id عشان PostgREST يعمل embed سهل في الفرونت)
-- ============================================================
create table if not exists project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending')),
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_id_idx on project_members(project_id);
create index if not exists project_members_user_id_idx on project_members(user_id);

create table if not exists invite_links (
  token uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete cascade,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists invite_links_project_id_idx on invite_links(project_id);

create table if not exists activity_log (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null default 'حد ما',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_project_id_idx on activity_log(project_id, created_at desc);

-- ============================================================
-- 6) دالة مساعدة: هل اليوزر عضو مقبول في المشروع ده؟ (تُستخدم في RLS)
-- ============================================================
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;

grant execute on function public.is_project_member(uuid) to authenticated;

-- ============================================================
-- 7) أول ما مشروع جديد يتعمل، صاحبه بيبقى عضو "مقبول" فيه تلقائي
-- ============================================================
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, status, invited_by)
  values (new.id, new.user_id, 'accepted', new.user_id)
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on projects;
create trigger on_project_created
  after insert on projects
  for each row execute function public.handle_new_project();

insert into project_members (project_id, user_id, status, invited_by)
select id, user_id, 'accepted', user_id from projects
on conflict (project_id, user_id) do nothing;

-- ============================================================
-- 8) الدوال اللي الفرونت بينادي عليها للدعوة والانضمام
-- ============================================================
create or replace function public.get_or_create_invite_link(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'مش عضو في المشروع ده';
  end if;

  select token into v_token
  from invite_links
  where project_id = p_project_id and revoked = false
  order by created_at asc
  limit 1;

  if v_token is null then
    v_token := gen_random_uuid();
    insert into invite_links (token, project_id, created_by)
    values (v_token, p_project_id, auth.uid());
  end if;

  return v_token;
end;
$$;

grant execute on function public.get_or_create_invite_link(uuid) to authenticated;

create or replace function public.invite_link_info(p_token uuid)
returns table(project_name text, valid boolean)
language sql
security definer
set search_path = public
stable
as $$
  select p.name, true
  from invite_links il
  join projects p on p.id = il.project_id
  where il.token = p_token and il.revoked = false;
$$;

grant execute on function public.invite_link_info(uuid) to anon, authenticated;

create or replace function public.join_project_by_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_created_by uuid;
begin
  if auth.uid() is null then
    raise exception 'لازم تسجل دخول الأول';
  end if;

  select project_id, created_by into v_project_id, v_created_by
  from invite_links
  where token = p_token and revoked = false;

  if v_project_id is null then
    raise exception 'رابط الدعوة ده مش شغال';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (v_project_id, auth.uid(), 'accepted', v_created_by)
  on conflict (project_id, user_id) do update set status = 'accepted';

  return v_project_id;
end;
$$;

grant execute on function public.join_project_by_invite(uuid) to authenticated;

create or replace function public.invite_user_by_username(p_project_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'مش عضو في المشروع ده';
  end if;

  select id into v_target from profiles where username = lower(p_username);
  if v_target is null then
    raise exception 'مفيش يوزر بالاسم ده';
  end if;

  if v_target = auth.uid() then
    raise exception 'متقدرش تدعي نفسك';
  end if;

  if exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = v_target and status = 'accepted'
  ) then
    raise exception 'اليوزر ده عضو بالفعل في المشروع';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (p_project_id, v_target, 'pending', auth.uid())
  on conflict (project_id, user_id) do update set status = 'pending', invited_by = auth.uid();
end;
$$;

grant execute on function public.invite_user_by_username(uuid, text) to authenticated;

create or replace function public.respond_to_invite(p_project_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_accept then
    update project_members
    set status = 'accepted'
    where project_id = p_project_id and user_id = auth.uid() and status = 'pending';
  else
    delete from project_members
    where project_id = p_project_id and user_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- ============================================================
-- 9) تسجيل النشاط تلقائي: أي إضافة/تعديل/حذف مهمة أو انضمام عضو
-- ============================================================
create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(full_name, ''), username, 'حد ما')
  into v_name
  from profiles
  where id = auth.uid();

  v_name := coalesce(v_name, 'حد ما');

  if tg_op = 'INSERT' then
    insert into activity_log (project_id, actor_id, actor_name, message)
    values (new.project_id, auth.uid(), v_name, v_name || ' أضاف مهمة: ' || new.title);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.is_done is distinct from old.is_done then
      insert into activity_log (project_id, actor_id, actor_name, message)
      values (
        new.project_id, auth.uid(), v_name,
        v_name || (case when new.is_done then ' خلّص مهمة: ' else ' رجّع مهمة معلّقة: ' end) || new.title
      );
    elsif new.title is distinct from old.title then
      insert into activity_log (project_id, actor_id, actor_name, message)
      values (new.project_id, auth.uid(), v_name, v_name || ' عدّل مهمة "' || old.title || '" إلى "' || new.title || '"');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into activity_log (project_id, actor_id, actor_name, message)
    values (old.project_id, auth.uid(), v_name, v_name || ' حذف مهمة: ' || old.title);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_task_change on tasks;
create trigger on_task_change
  after insert or update or delete on tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_member_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
     and new.invited_by is distinct from new.user_id
  then
    select coalesce(nullif(full_name, ''), username, 'حد ما')
    into v_name
    from profiles
    where id = new.user_id;

    insert into activity_log (project_id, actor_id, actor_name, message)
    values (new.project_id, new.user_id, coalesce(v_name, 'حد ما'), coalesce(v_name, 'حد ما') || ' انضم للمشروع');
  end if;
  return new;
end;
$$;

-- ============================================================
-- 13) البروفايل الشخصي: إيميل (للعرض فقط) + صورة، وتعديل الاسم/اليوزرنيم/الباسورد من الواجهة
-- ============================================================
alter table profiles
  add column if not exists email text,
  add column if not exists avatar_url text;

-- نخزّن الإيميل في profiles وقت التسجيل عشان يظهر في صفحة البروفايل والكارت الشخصي لأي عضو تاني بنفس المشروع
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, email)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', '')),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

-- تعبئة الإيميل لأي حساب موجود بالفعل قبل إضافة العمود ده
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- لو المستخدم غيّر إيميله من auth، نحدّث النسخة المخزّنة في profiles تلقائي
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_update();

-- ============================================================
-- 14) تخزين صور البروفايل: باكت "avatars" عام للقراءة، كل مستخدم يرفع ويعدّل بس في فولدر بمعرّفه هو
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images publicly accessible" on storage.objects;
create policy "avatar images publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop trigger if exists on_member_status_change on project_members;
create trigger on_member_status_change
  after insert or update on project_members
  for each row execute function public.log_member_join();

-- ============================================================
-- 10) RLS: تحديث سياسات المشاركة
-- ============================================================
alter table profiles enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table links enable row level security;
alter table project_members enable row level security;
alter table invite_links enable row level security;
alter table activity_log enable row level security;

drop policy if exists "profiles select own" on profiles;
drop policy if exists "profiles select shared" on profiles;
create policy "profiles select shared" on profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from project_members pm1
      join project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid()
        and pm1.status = 'accepted'
        and pm2.user_id = profiles.id
        and pm2.status = 'accepted'
    )
  );

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "public projects access" on projects;
drop policy if exists "projects owner access" on projects;
drop policy if exists "projects select related" on projects;
create policy "projects select related" on projects
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from project_members
      where project_id = projects.id and user_id = auth.uid()
    )
  );

drop policy if exists "projects insert own" on projects;
create policy "projects insert own" on projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects update own" on projects;
create policy "projects update own" on projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects delete own" on projects;
create policy "projects delete own" on projects
  for delete using (auth.uid() = user_id);

drop policy if exists "public tasks access" on tasks;
drop policy if exists "tasks owner access" on tasks;
drop policy if exists "tasks select members" on tasks;
create policy "tasks select members" on tasks
  for select using (public.is_project_member(project_id));

drop policy if exists "tasks insert members" on tasks;
create policy "tasks insert members" on tasks
  for insert with check (public.is_project_member(project_id));

drop policy if exists "tasks update members" on tasks;
create policy "tasks update members" on tasks
  for update using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

drop policy if exists "tasks delete members" on tasks;
create policy "tasks delete members" on tasks
  for delete using (public.is_project_member(project_id));

drop policy if exists "public links access" on links;
drop policy if exists "links owner access" on links;
create policy "links owner access" on links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "project_members select" on project_members;
create policy "project_members select" on project_members
  for select using (
    user_id = auth.uid() or public.is_project_member(project_id)
  );

drop policy if exists "invite_links select members" on invite_links;
create policy "invite_links select members" on invite_links
  for select using (public.is_project_member(project_id));

drop policy if exists "activity_log select members" on activity_log;
create policy "activity_log select members" on activity_log
  for select using (public.is_project_member(project_id));

-- ============================================================
-- 11) سجل خاص بكل عنصر لوحده: كل مهمة وكل لينك ليهم تسلسل أحداث خاص بيهم
--     يتعرض جوه الكارت بتاعهم نفسه، مش بس في فيد المشروع العام
-- ============================================================

-- نربط سجل النشاط الحالي بالمهمة نفسها (nullable + on delete set null
-- عشان حذف المهمة يفضل مسجل في فيد المشروع من غير ما يكسر الـ foreign key)
alter table activity_log
  add column if not exists task_id uuid references tasks(id) on delete set null;

create index if not exists activity_log_task_id_idx on activity_log(task_id, created_at asc);

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(full_name, ''), username, 'حد ما')
  into v_name
  from profiles
  where id = auth.uid();

  v_name := coalesce(v_name, 'حد ما');

  if tg_op = 'INSERT' then
    insert into activity_log (project_id, task_id, actor_id, actor_name, message)
    values (new.project_id, new.id, auth.uid(), v_name, v_name || ' أضاف مهمة: ' || new.title);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.is_done is distinct from old.is_done then
      insert into activity_log (project_id, task_id, actor_id, actor_name, message)
      values (
        new.project_id, new.id, auth.uid(), v_name,
        v_name || (case when new.is_done then ' خلّص المهمة' else ' رجّع المهمة معلّقة' end)
      );
    elsif new.title is distinct from old.title then
      insert into activity_log (project_id, task_id, actor_id, actor_name, message)
      values (new.project_id, new.id, auth.uid(), v_name, v_name || ' عدّل عنوان المهمة إلى "' || new.title || '"');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- مالهاش task_id لأن المهمة نفسها هتتمسح، فبيفضل السطر ده في فيد المشروع بس
    insert into activity_log (project_id, actor_id, actor_name, message)
    values (old.project_id, auth.uid(), v_name, v_name || ' حذف مهمة: ' || old.title);
    return old;
  end if;
  return null;
end;
$$;

-- سجل مستقل للينكات (شخصية، مش مشروع)، كل لينك ليه تسلسل أحداثه بس
create table if not exists link_activity_log (
  id uuid primary key default uuid_generate_v4(),
  link_id uuid not null references links(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists link_activity_log_link_id_idx on link_activity_log(link_id, created_at asc);

alter table link_activity_log enable row level security;

drop policy if exists "link_activity_log owner access" on link_activity_log;
create policy "link_activity_log owner access" on link_activity_log
  for select using (auth.uid() = user_id);

create or replace function public.log_link_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into link_activity_log (link_id, user_id, message)
    values (new.id, auth.uid(), 'تمت إضافة الرابط');
    return new;
  elsif tg_op = 'UPDATE' then
    if new.url is distinct from old.url and new.description is distinct from old.description then
      insert into link_activity_log (link_id, user_id, message)
      values (new.id, auth.uid(), 'تم تعديل الرابط والوصف');
    elsif new.url is distinct from old.url then
      insert into link_activity_log (link_id, user_id, message)
      values (new.id, auth.uid(), 'تم تعديل الرابط');
    elsif new.description is distinct from old.description then
      insert into link_activity_log (link_id, user_id, message)
      values (new.id, auth.uid(), 'تم تعديل الوصف');
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists on_link_change on links;
create trigger on_link_change
  after insert or update on links
  for each row execute function public.log_link_activity();

-- ============================================================
-- 12) الاسم الكامل (full_name) هو اللي بيتسجل في كل حدث، وليس اسم المستخدم
--     وربط tasks.user_id بـ profiles حتى تستطيع الواجهة عرض اسم صاحب المهمة مباشرة
-- ============================================================
alter table tasks
  drop constraint if exists tasks_user_id_fkey;
alter table tasks
  add constraint tasks_user_id_fkey foreign key (user_id) references profiles(id) on delete cascade;

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(full_name, ''), username, 'مستخدم') into v_name from profiles where id = auth.uid();
  v_name := coalesce(v_name, 'مستخدم');

  if tg_op = 'INSERT' then
    insert into activity_log (project_id, task_id, actor_id, actor_name, message)
    values (new.project_id, new.id, auth.uid(), v_name, v_name || ' أضاف مهمة جديدة: ' || new.title);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.is_done is distinct from old.is_done then
      insert into activity_log (project_id, task_id, actor_id, actor_name, message)
      values (
        new.project_id, new.id, auth.uid(), v_name,
        v_name || (case when new.is_done then ' أكمل المهمة' else ' أعاد فتح المهمة' end)
      );
    elsif new.title is distinct from old.title then
      insert into activity_log (project_id, task_id, actor_id, actor_name, message)
      values (new.project_id, new.id, auth.uid(), v_name, v_name || ' عدّل عنوان المهمة إلى "' || new.title || '"');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into activity_log (project_id, actor_id, actor_name, message)
    values (old.project_id, auth.uid(), v_name, v_name || ' حذف مهمة: ' || old.title);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.log_member_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
     and new.invited_by is distinct from new.user_id
  then
    select coalesce(nullif(full_name, ''), username, 'مستخدم') into v_name from profiles where id = new.user_id;
    v_name := coalesce(v_name, 'مستخدم');
    insert into activity_log (project_id, actor_id, actor_name, message)
    values (new.project_id, new.user_id, v_name, v_name || ' انضم إلى المشروع');
  end if;
  return new;
end;
$$;
