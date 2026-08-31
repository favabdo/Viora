-- شغّل الملف مرة في Supabase SQL Editor.
-- 1) يعيد صياغة الجمل العربية المخزّنة في سجل النشاط إلى فصحى رسمية.
-- 2) يحدّث رسائل الأخطاء التي تُعرض للمستخدم من الدوال.
-- 3) يضبط النصوص الافتراضية في الـ triggers للتسجيلات الجديدة.

alter table activity_log
  alter column actor_name set default 'أحد المستخدمين';

update activity_log
set actor_name = 'أحد المستخدمين'
where actor_name in ('حد ما', 'مستخدم');

update activity_log set message = replace(message, 'حد ما', 'أحد المستخدمين');
update activity_log set message = replace(message, ' خلّص المهمة', ' أتمّ المهمة');
update activity_log set message = replace(message, ' خلّص مهمة: ', ' أتمّ المهمة: ');
update activity_log set message = replace(message, ' رجّع المهمة معلّقة', ' أعاد فتح المهمة');
update activity_log set message = replace(message, ' رجّع مهمة معلّقة: ', ' أعاد فتح المهمة: ');
update activity_log set message = replace(message, ' أكمل المهمة', ' أتمّ المهمة');
update activity_log set message = replace(message, ' أضاف مهمة جديدة: ', ' قام بإضافة مهمة جديدة: ');
update activity_log set message = replace(message, ' أضاف مهمة: ', ' قام بإضافة مهمة جديدة: ');
update activity_log set message = replace(message, ' انضم للمشروع', ' انضم إلى المشروع');
update activity_log set message = replace(message, ' علّق على المهمة', ' أضاف تعليقًا على المهمة');
update activity_log set message = regexp_replace(
  message,
  ' دعا (.+) إلى المشروع$',
  ' وجّه دعوة إلى \1 للانضمام إلى المشروع'
);

update link_activity_log set message = replace(message, 'تمت إضافة الرابط', 'أُضيف الرابط');
update link_activity_log set message = replace(message, 'تم تعديل الرابط والوصف', 'عُدّل الرابط والوصف');
update link_activity_log set message = replace(message, 'تم تعديل الرابط', 'عُدّل الرابط');
update link_activity_log set message = replace(message, 'تم تعديل الوصف', 'عُدّل الوصف');

create or replace function public.write_activity_log(
  p_project_id uuid,
  p_task_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_message text,
  p_action text,
  p_params jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_log (project_id, task_id, actor_id, actor_name, message, action, action_params)
  values (
    p_project_id,
    p_task_id,
    p_actor_id,
    coalesce(nullif(p_actor_name, ''), 'أحد المستخدمين'),
    p_message,
    p_action,
    coalesce(p_params, '{}'::jsonb)
  );
end;
$$;

create or replace function public.current_actor_name()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(full_name, ''), username) into v_name from profiles where id = auth.uid();
  return coalesce(v_name, 'أحد المستخدمين');
end;
$$;

create or replace function public.profile_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(full_name, ''), username, 'أحد المستخدمين') from profiles where id = p_user_id;
$$;

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_actor uuid;
  v_old_col text;
  v_new_col text;
  v_old_col_color text;
  v_new_col_color text;
  v_assignee text;
  v_old_assignee text;
begin
  v_actor := auth.uid();
  v_name := public.current_actor_name();

  if tg_op = 'INSERT' then
    perform public.write_activity_log(
      new.project_id, new.id, v_actor, v_name,
      v_name || ' قام بإضافة مهمة جديدة: ' || new.title,
      'task_created',
      jsonb_build_object(
        'title', new.title,
        'due', coalesce(new.due_date::text, ''),
        'color', coalesce(new.color, ''),
        'assignee_id', coalesce(new.user_id::text, '')
      )
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.is_done is distinct from old.is_done then
      if new.column_id is not null then
        select name, color into v_new_col, v_new_col_color from board_columns where id = new.column_id;
      end if;
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        v_name || (case when new.is_done then ' أتمّ المهمة' else ' أعاد فتح المهمة' end),
        case when new.is_done then 'task_completed' else 'task_reopened' end,
        jsonb_build_object(
          'title', new.title,
          'status', coalesce(v_new_col, case when new.is_done then 'Done' else 'To Do' end),
          'status_color', coalesce(v_new_col_color, case when new.is_done then '#22C55E' else '#F59E0B' end)
        )
      );
    elsif new.column_id is distinct from old.column_id then
      if old.column_id is not null then
        select name, color into v_old_col, v_old_col_color from board_columns where id = old.column_id;
      end if;
      if new.column_id is not null then
        select name, color into v_new_col, v_new_col_color from board_columns where id = new.column_id;
      end if;
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        v_name || ' غيّر حالة المهمة إلى ' || coalesce(v_new_col, 'بلا حالة'),
        'task_status_changed',
        jsonb_build_object(
          'title', new.title,
          'status', coalesce(v_new_col, ''),
          'status_color', coalesce(v_new_col_color, '#6C5CE7'),
          'old_status', coalesce(v_old_col, '')
        )
      );
    end if;

    if new.title is distinct from old.title then
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        v_name || ' عدّل عنوان المهمة إلى "' || new.title || '"',
        'task_title_changed',
        jsonb_build_object('title', new.title, 'old_title', coalesce(old.title, ''))
      );
    end if;

    if new.due_date is distinct from old.due_date then
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        case
          when new.due_date is null then v_name || ' أزال موعد التسليم'
          else v_name || ' عدّل موعد التسليم'
        end,
        case when new.due_date is null then 'task_due_cleared' else 'task_due_changed' end,
        jsonb_build_object(
          'title', new.title,
          'due', coalesce(new.due_date::text, ''),
          'old_due', coalesce(old.due_date::text, '')
        )
      );
    end if;

    if new.start_date is distinct from old.start_date then
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        v_name || ' عدّل تاريخ البدء',
        'task_start_changed',
        jsonb_build_object(
          'title', new.title,
          'start', coalesce(new.start_date::text, ''),
          'old_start', coalesce(old.start_date::text, '')
        )
      );
    end if;

    if new.color is distinct from old.color then
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        v_name || ' عدّل أولوية المهمة',
        'task_priority_changed',
        jsonb_build_object(
          'title', new.title,
          'color', coalesce(new.color, ''),
          'old_color', coalesce(old.color, '')
        )
      );
    end if;

    if new.user_id is distinct from old.user_id then
      v_assignee := public.profile_display_name(new.user_id);
      v_old_assignee := public.profile_display_name(old.user_id);
      perform public.write_activity_log(
        new.project_id, new.id, v_actor, v_name,
        case
          when new.user_id is null then v_name || ' أزال المسؤول عن المهمة'
          else v_name || ' أسند المهمة إلى ' || coalesce(v_assignee, 'أحد المستخدمين')
        end,
        case when new.user_id is null then 'task_unassigned' else 'task_assignee_changed' end,
        jsonb_build_object(
          'title', new.title,
          'assignee', coalesce(v_assignee, ''),
          'old_assignee', coalesce(v_old_assignee, '')
        )
      );
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    perform public.write_activity_log(
      old.project_id, null, v_actor, v_name,
      v_name || ' حذف مهمة: ' || old.title,
      'task_deleted',
      jsonb_build_object('title', old.title)
    );
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
  v_actor_name text;
  v_invitee text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    v_actor_name := coalesce(public.profile_display_name(new.invited_by), public.current_actor_name());
    v_invitee := public.profile_display_name(new.user_id);
    perform public.write_activity_log(
      new.project_id, null, new.invited_by, v_actor_name,
      v_actor_name || ' وجّه دعوة إلى ' || coalesce(v_invitee, 'عضو') || ' للانضمام إلى المشروع',
      'member_invited',
      jsonb_build_object('member', coalesce(v_invitee, ''))
    );
  end if;

  if new.status = 'accepted'
     and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
     and new.invited_by is distinct from new.user_id
  then
    v_name := public.profile_display_name(new.user_id);
    perform public.write_activity_log(
      new.project_id, null, new.user_id, v_name,
      coalesce(v_name, 'أحد المستخدمين') || ' انضم إلى المشروع',
      'member_joined',
      '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace function public.log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_title text;
  v_snippet text;
begin
  if tg_op = 'INSERT' then
    v_name := public.profile_display_name(new.user_id);
    select title into v_title from tasks where id = new.task_id;
    v_snippet := left(new.message, 140);
    perform public.write_activity_log(
      new.project_id, new.task_id, new.user_id, v_name,
      coalesce(v_name, 'أحد المستخدمين') || ' أضاف تعليقًا على المهمة',
      'comment_added',
      jsonb_build_object(
        'title', coalesce(v_title, ''),
        'snippet', coalesce(v_snippet, '')
      )
    );
    return new;
  elsif tg_op = 'DELETE' then
    v_name := public.profile_display_name(old.user_id);
    select title into v_title from tasks where id = old.task_id;
    perform public.write_activity_log(
      old.project_id, old.task_id, old.user_id, v_name,
      coalesce(v_name, 'أحد المستخدمين') || ' حذف تعليقًا',
      'comment_deleted',
      jsonb_build_object('title', coalesce(v_title, ''))
    );
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.log_link_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into link_activity_log (link_id, user_id, message, action, action_params)
    values (new.id, auth.uid(), 'أُضيف الرابط', 'link_added', '{}'::jsonb);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.url is distinct from old.url and new.description is distinct from old.description then
      insert into link_activity_log (link_id, user_id, message, action, action_params)
      values (new.id, auth.uid(), 'عُدّل الرابط والوصف', 'link_url_and_description_changed', '{}'::jsonb);
    elsif new.url is distinct from old.url then
      insert into link_activity_log (link_id, user_id, message, action, action_params)
      values (new.id, auth.uid(), 'عُدّل الرابط', 'link_url_changed', '{}'::jsonb);
    elsif new.description is distinct from old.description then
      insert into link_activity_log (link_id, user_id, message, action, action_params)
      values (new.id, auth.uid(), 'عُدّل الوصف', 'link_description_changed', '{}'::jsonb);
    end if;
    return new;
  end if;
  return null;
end;
$$;

create or replace function public.invite_user_to_project(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'ليس لديك عضوية في هذا المشروع';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'لا يجوز دعوة نفسك إلى المشروع';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and coalesce(is_deleted, false) = false) then
    raise exception 'لا يوجد مستخدم مطابق لهذا المعرّف';
  end if;
  if exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = p_user_id and status = 'accepted'
  ) then
    raise exception 'هذا المستخدم عضو في المشروع بالفعل';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (p_project_id, p_user_id, 'pending', auth.uid())
  on conflict (project_id, user_id) do update set status = 'pending', invited_by = auth.uid();
end;
$$;

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
    raise exception 'ليس لديك عضوية في هذا المشروع';
  end if;

  select id into v_target from profiles where username = lower(p_username);
  if v_target is null then
    raise exception 'لا يوجد مستخدم بهذا الاسم';
  end if;

  if v_target = auth.uid() then
    raise exception 'لا يجوز دعوة نفسك إلى المشروع';
  end if;

  if exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = v_target and status = 'accepted'
  ) then
    raise exception 'هذا المستخدم عضو في المشروع بالفعل';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (p_project_id, v_target, 'pending', auth.uid())
  on conflict (project_id, user_id) do update set status = 'pending', invited_by = auth.uid();
end;
$$;

create or replace function public.set_invite_link_enabled(p_project_id uuid, p_enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'ليس لديك عضوية في هذا المشروع';
  end if;

  if p_enabled then
    return public.get_or_create_invite_link(p_project_id);
  end if;

  update invite_links
  set revoked = true
  where project_id = p_project_id and revoked = false;

  return null;
end;
$$;

create or replace function public.update_invite_link_settings(
  p_project_id uuid,
  p_access_role text,
  p_expires_at timestamptz,
  p_max_uses integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'ليس لديك عضوية في هذا المشروع';
  end if;

  update invite_links
  set
    access_role = coalesce(nullif(p_access_role, ''), access_role),
    expires_at = p_expires_at,
    max_uses = p_max_uses
  where project_id = p_project_id and revoked = false;
end;
$$;

create or replace function public.join_project_by_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_created_by uuid;
  v_expires timestamptz;
  v_max integer;
  v_count integer;
  v_revoked boolean;
begin
  if auth.uid() is null then
    raise exception 'يُرجى تسجيل الدخول أولًا';
  end if;

  select project_id, created_by, expires_at, max_uses, use_count, revoked
    into v_project_id, v_created_by, v_expires, v_max, v_count, v_revoked
  from invite_links
  where token = p_token;

  if v_project_id is null or v_revoked then
    raise exception 'رابط الدعوة غير صالح أو انتهت صلاحيته';
  end if;
  if v_expires is not null and v_expires <= now() then
    raise exception 'رابط الدعوة غير صالح أو انتهت صلاحيته';
  end if;
  if v_max is not null and v_count >= v_max then
    raise exception 'رابط الدعوة غير صالح أو انتهت صلاحيته';
  end if;

  insert into project_members (project_id, user_id, status, invited_by)
  values (v_project_id, auth.uid(), 'accepted', v_created_by)
  on conflict (project_id, user_id) do update set status = 'accepted';

  update invite_links
  set use_count = use_count + 1
  where token = p_token;

  return v_project_id;
end;
$$;

create or replace function public.leave_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'يُرجى تسجيل الدخول أولًا';
  end if;

  select user_id into v_owner from projects where id = p_project_id;
  if v_owner is null then
    raise exception 'المشروع غير موجود';
  end if;

  if v_owner = auth.uid() then
    raise exception 'أنت صاحب هذا المشروع، ولا يجوز مغادرته؛ ويمكنك حذفه بدلًا من ذلك';
  end if;

  delete from project_members
  where project_id = p_project_id and user_id = auth.uid();
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'يُرجى تسجيل الدخول أولًا';
  end if;

  update profiles
  set is_deleted = true,
      full_name = '',
      avatar_url = null
  where id = auth.uid();
end;
$$;
