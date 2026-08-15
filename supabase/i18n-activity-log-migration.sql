-- شغّل الملف ده مرة واحدة في Supabase SQL Editor عشان سجل الأنشطة (activity_log و
-- link_activity_log) يبقى قابل للترجمة حسب لغة الواجهة، بدل ما يفضل مسجّل بالعربي دايمًا.
--
-- الفكرة: بدل ما الـ trigger يبني جملة عربية جاهزة ويحطها في عمود message، بقى يسجّل
-- "مفتاح الحدث" (action) + بياناته (action_params بصيغة JSON)، والواجهة هي اللي بتترجم
-- المفتاح ده للغة المعروضة حاليًا وقت العرض. عمود message فضل موجود كـ fallback عربي
-- (مفيد لو حصل استدعاء قديم من مكان تاني لسه بيعتمد عليه، وعشان يفضل NOT NULL).
--
-- ملحوظة: الصفوف القديمة اللي اتسجلت قبل الـ migration ده هتفضل من غير action (null)،
-- فالواجهة هتعرضها زي ما هي (بالعربي) كـ fallback، وأي صف جديد بعد كده هيتترجم ديناميكيًا.

alter table activity_log
  add column if not exists action text,
  add column if not exists action_params jsonb;

alter table link_activity_log
  add column if not exists action text,
  add column if not exists action_params jsonb;

-- ============================================================
-- سجل نشاط المهام (activity_log) - النسخة النهائية القابلة للترجمة
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
  select coalesce(nullif(full_name, ''), username, 'مستخدم') into v_name from profiles where id = auth.uid();
  v_name := coalesce(v_name, 'مستخدم');

  if tg_op = 'INSERT' then
    insert into activity_log (project_id, task_id, actor_id, actor_name, message, action, action_params)
    values (
      new.project_id, new.id, auth.uid(), v_name,
      v_name || ' أضاف مهمة جديدة: ' || new.title,
      'task_created', jsonb_build_object('title', new.title)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.is_done is distinct from old.is_done then
      insert into activity_log (project_id, task_id, actor_id, actor_name, message, action, action_params)
      values (
        new.project_id, new.id, auth.uid(), v_name,
        v_name || (case when new.is_done then ' أكمل المهمة' else ' أعاد فتح المهمة' end),
        case when new.is_done then 'task_completed' else 'task_reopened' end,
        '{}'::jsonb
      );
    elsif new.title is distinct from old.title then
      insert into activity_log (project_id, task_id, actor_id, actor_name, message, action, action_params)
      values (
        new.project_id, new.id, auth.uid(), v_name,
        v_name || ' عدّل عنوان المهمة إلى "' || new.title || '"',
        'task_title_changed', jsonb_build_object('title', new.title)
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into activity_log (project_id, actor_id, actor_name, message, action, action_params)
    values (
      old.project_id, auth.uid(), v_name,
      v_name || ' حذف مهمة: ' || old.title,
      'task_deleted', jsonb_build_object('title', old.title)
    );
    return old;
  end if;
  return null;
end;
$$;

-- ============================================================
-- سجل انضمام الأعضاء (activity_log) - النسخة النهائية القابلة للترجمة
-- ============================================================
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
    insert into activity_log (project_id, actor_id, actor_name, message, action, action_params)
    values (
      new.project_id, new.user_id, v_name,
      v_name || ' انضم إلى المشروع',
      'member_joined', '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

-- ============================================================
-- سجل نشاط الروابط (link_activity_log) - النسخة النهائية القابلة للترجمة
-- ============================================================
create or replace function public.log_link_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into link_activity_log (link_id, user_id, message, action, action_params)
    values (new.id, auth.uid(), 'تمت إضافة الرابط', 'link_added', '{}'::jsonb);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.url is distinct from old.url and new.description is distinct from old.description then
      insert into link_activity_log (link_id, user_id, message, action, action_params)
      values (new.id, auth.uid(), 'تم تعديل الرابط والوصف', 'link_url_and_description_changed', '{}'::jsonb);
    elsif new.url is distinct from old.url then
      insert into link_activity_log (link_id, user_id, message, action, action_params)
      values (new.id, auth.uid(), 'تم تعديل الرابط', 'link_url_changed', '{}'::jsonb);
    elsif new.description is distinct from old.description then
      insert into link_activity_log (link_id, user_id, message, action, action_params)
      values (new.id, auth.uid(), 'تم تعديل الوصف', 'link_description_changed', '{}'::jsonb);
    end if;
    return new;
  end if;
  return null;
end;
$$;
