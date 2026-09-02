-- تشغيل مرة في Supabase SQL Editor.
-- يصلح فشل حذف المهام/المشاريع بسبب تريجر سجل النشاط وقيود المفاتيح الأجنبية.

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
declare
  v_task uuid;
begin
  if current_setting('viora.skip_activity', true) = 'on' then
    return;
  end if;
  if p_project_id is null or not exists (select 1 from projects where id = p_project_id) then
    return;
  end if;
  v_task := p_task_id;
  if v_task is not null and not exists (select 1 from tasks where id = v_task) then
    v_task := null;
  end if;
  insert into activity_log (project_id, task_id, actor_id, actor_name, message, action, action_params)
  values (
    p_project_id,
    v_task,
    p_actor_id,
    coalesce(nullif(p_actor_name, ''), 'أحد المستخدمين'),
    p_message,
    p_action,
    coalesce(p_params, '{}'::jsonb)
  );
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'activity_log'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%task_id%'
  loop
    execute format('alter table public.activity_log drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.activity_log
  add constraint activity_log_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete set null;

create or replace function public.delete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_title text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'يلزم تسجيل الدخول';
  end if;

  select project_id, title into v_project, v_title from tasks where id = p_task_id;
  if v_project is null then
    return;
  end if;
  if not public.is_project_member(v_project) then
    raise exception 'ليس لديك صلاحية حذف هذه المهمة';
  end if;

  v_name := public.current_actor_name();
  perform public.write_activity_log(
    v_project,
    null,
    auth.uid(),
    v_name,
    v_name || ' حذف مهمة: ' || coalesce(v_title, ''),
    'task_deleted',
    jsonb_build_object('title', coalesce(v_title, ''))
  );

  perform set_config('viora.skip_activity', 'on', true);
  delete from task_comments where task_id = p_task_id;
  if to_regclass('public.task_attachments') is not null then
    delete from task_attachments where task_id = p_task_id;
  end if;
  update activity_log set task_id = null where task_id = p_task_id;
  delete from tasks where id = p_task_id;
end;
$$;

create or replace function public.delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'يلزم تسجيل الدخول';
  end if;
  if not exists (select 1 from projects where id = p_project_id and user_id = auth.uid()) then
    raise exception 'لا يمكنك حذف هذا المشروع';
  end if;

  perform set_config('viora.skip_activity', 'on', true);

  if to_regclass('public.task_comments') is not null then
    delete from task_comments where project_id = p_project_id;
  end if;
  if to_regclass('public.task_attachments') is not null then
    delete from task_attachments where project_id = p_project_id;
  end if;
  delete from activity_log where project_id = p_project_id;
  if to_regclass('public.ideas') is not null then
    update ideas set project_id = null where project_id = p_project_id;
    update ideas set converted_project_id = null where converted_project_id = p_project_id;
  end if;
  delete from tasks where project_id = p_project_id;
  if to_regclass('public.board_columns') is not null then
    delete from board_columns where project_id = p_project_id;
  end if;
  if to_regclass('public.invite_links') is not null then
    delete from invite_links where project_id = p_project_id;
  end if;
  delete from project_members where project_id = p_project_id;
  delete from projects where id = p_project_id and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_task(uuid) to authenticated;
grant execute on function public.delete_project(uuid) to authenticated;

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
    if not exists (select 1 from projects where id = old.project_id) then
      return old;
    end if;
    v_name := public.profile_display_name(old.user_id);
    select title into v_title from tasks where id = old.task_id;
    perform public.write_activity_log(
      old.project_id, null, old.user_id, v_name,
      coalesce(v_name, 'أحد المستخدمين') || ' حذف تعليقًا',
      'comment_deleted',
      jsonb_build_object('title', coalesce(v_title, ''))
    );
    return old;
  end if;
  return null;
end;
$$;
