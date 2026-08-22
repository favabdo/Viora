-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
-- بيصلح رواسب آخر تعديلين على الأعمدة من غير ما يمسح مهام أو مشاريع:
--   1) board_columns + tasks.column_id + tasks.due_date
--   2) activity_log.action + activity_log.action_params
-- كمان بيربط أي مهمة عمودها اتمسح (orphaned column_id) ويرجع أعمدة قياسية
-- لأي مشروع بيتحمّل فاضي.

-- 1) أعمدة البورد + ربط المهام
create table if not exists board_columns (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  position double precision not null default 0,
  is_done_column boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tasks
  add column if not exists column_id uuid references board_columns(id) on delete set null,
  add column if not exists due_date date;

-- due_date لازم يفضل date؛ لو اتسجل كنص فاضي نمسحه عشان الفرونت ما يقعش وهو بيحوّله
update tasks set due_date = null where due_date is not null and due_date::text !~ '^\d{4}-\d{2}-\d{2}';

-- 2) سجل النشاط متعدد اللغات
alter table activity_log
  add column if not exists action text,
  add column if not exists action_params jsonb;

alter table link_activity_log
  add column if not exists action text,
  add column if not exists action_params jsonb;

update activity_log
  set action_params = '{}'::jsonb
  where action_params is not null and jsonb_typeof(action_params) <> 'object';

update link_activity_log
  set action_params = '{}'::jsonb
  where action_params is not null and jsonb_typeof(action_params) <> 'object';

-- 3) أعمدة قياسية لأي مشروع من غير أعمدة + إعادة ربط المهام اليتيمة
create or replace function public.seed_default_columns(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into board_columns (project_id, name, color, position, is_done_column)
  select p_project_id, v.name, v.color, v.position, v.is_done_column
  from (values
    ('To Do', '#3b82f6', 0, false),
    ('In Progress', '#a855f7', 1, false),
    ('Review', '#eab308', 2, false),
    ('Done', '#22c55e', 3, true)
  ) as v(name, color, position, is_done_column)
  where not exists (
    select 1 from board_columns c
    where c.project_id = p_project_id and c.name = v.name
  );
end;
$$;

do $$
declare
  proj record;
  v_todo uuid;
  v_done uuid;
begin
  for proj in select id from projects loop
    if not exists (select 1 from board_columns where project_id = proj.id) then
      perform public.seed_default_columns(proj.id);
    end if;

    select id into v_todo from board_columns
      where project_id = proj.id and is_done_column = false
      order by position asc limit 1;
    select id into v_done from board_columns
      where project_id = proj.id and is_done_column = true
      limit 1;

    update tasks t
    set column_id = case when t.is_done then v_done else v_todo end
    where t.project_id = proj.id
      and (
        t.column_id is null
        or not exists (select 1 from board_columns c where c.id = t.column_id)
      );
  end loop;
end $$;
