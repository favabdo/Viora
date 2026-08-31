-- شغّل الملف مرة في Supabase SQL Editor.
-- بيوسّع سجل النشاط عشان كل تغيير على المهمة (حتى الصغير) يتسجل.

alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists start_date date;
alter table activity_log add column if not exists action text;
alter table activity_log add column if not exists action_params jsonb;
alter table activity_log add column if not exists task_id uuid references tasks(id) on delete set null;


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
    coalesce(nullif(p_actor_name, ''), 'مستخدم'),
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
  return coalesce(v_name, 'مستخدم');
end;
$$;

create or replace function public.profile_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(full_name, ''), username, 'مستخدم') from profiles where id = p_user_id;
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
      v_name || ' أضاف مهمة جديدة: ' || new.title,
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
        v_name || (case when new.is_done then ' أكمل المهمة' else ' أعاد فتح المهمة' end),
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
        v_name || ' عدّل تاريخ البداية',
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
          else v_name || ' أسند المهمة إلى ' || coalesce(v_assignee, 'مستخدم')
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
      v_actor_name || ' دعا ' || coalesce(v_invitee, 'عضو') || ' إلى المشروع',
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
      coalesce(v_name, 'مستخدم') || ' انضم إلى المشروع',
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
      coalesce(v_name, 'مستخدم') || ' علّق على المهمة',
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
      coalesce(v_name, 'مستخدم') || ' حذف تعليقًا',
      'comment_deleted',
      jsonb_build_object('title', coalesce(v_title, ''))
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_comment_activity on task_comments;
create trigger on_comment_activity
  after insert or delete on task_comments
  for each row execute function public.log_comment_activity();

create or replace function public.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.name is distinct from old.name then
    v_name := public.current_actor_name();
    perform public.write_activity_log(
      new.id, null, auth.uid(), v_name,
      v_name || ' أعاد تسمية المشروع إلى ' || new.name,
      'project_renamed',
      jsonb_build_object('name', new.name, 'old_name', old.name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_activity on projects;
create trigger on_project_activity
  after update on projects
  for each row execute function public.log_project_activity();
