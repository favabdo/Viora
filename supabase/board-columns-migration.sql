-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
--
-- الهدف: كل مشروع يبقى له أعمدة (حالات) خاصة بيه، صاحب المشروع يقدر يسميها/يضيف/يحذف
-- منها زي ما هو عايز. المهام بتتربط بعمود معين (column_id)، وأي عمود المالك يعلّمه
-- "is_done_column" بيخلي أي مهمة فيه تتحسب "منجزة" (is_done=true) تلقائيًا - عشان باقي
-- الأماكن في التطبيق اللي بتعتمد على is_done (الترتيب، الفلاتر) تفضل شغالة صح من غير
-- ما نغيّر فيها حاجة.

-- ============================================================
-- 1) جدول الأعمدة
-- ============================================================
create table if not exists board_columns (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  color text not null default '#6b7280',
  position double precision not null default 0,
  is_done_column boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists board_columns_project_id_idx on board_columns(project_id, position);

alter table board_columns enable row level security;

drop policy if exists "board_columns select members" on board_columns;
create policy "board_columns select members" on board_columns
  for select using (public.is_project_member(project_id));

drop policy if exists "board_columns insert members" on board_columns;
create policy "board_columns insert members" on board_columns
  for insert with check (public.is_project_member(project_id));

drop policy if exists "board_columns update members" on board_columns;
create policy "board_columns update members" on board_columns
  for update using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

drop policy if exists "board_columns delete members" on board_columns;
create policy "board_columns delete members" on board_columns
  for delete using (public.is_project_member(project_id));

-- ============================================================
-- 2) عمودين جداد في tasks: column_id (العمود اللي المهمة فيه) وdue_date (اختياري)
-- ============================================================
alter table tasks
  add column if not exists column_id uuid references board_columns(id) on delete set null,
  add column if not exists due_date date;

create index if not exists tasks_column_id_idx on tasks(column_id);

-- ============================================================
-- 3) تزامن is_done تلقائيًا مع عمود المهمة: لو العمود is_done_column=true
--    تبقى المهمة منجزة تلقائيًا، وأي عمود تاني تبقى مش منجزة
-- ============================================================
create or replace function public.sync_task_done_from_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_done_column boolean;
begin
  if new.column_id is null then
    return new;
  end if;
  select is_done_column into v_is_done_column from board_columns where id = new.column_id;
  new.is_done := coalesce(v_is_done_column, false);
  return new;
end;
$$;

drop trigger if exists on_task_column_change on tasks;
create trigger on_task_column_change
  before insert or update of column_id on tasks
  for each row execute function public.sync_task_done_from_column();

-- ============================================================
-- 3ب) والاتجاه العكسي: لو is_done اتغيّرت مباشرة (زي checkbox في عرض القائمة/التقويم/
--     الخط الزمني) بدل ما المهمة تتسحب لعمود تاني يدويًا، بننقلها تلقائيًا لعمود
--     "منجز" (is_done_column=true) في نفس المشروع، أو نرجّعها لأول عمود مش منجز
--     لو رجّعت "لسه مش منجزة" وكانت واقفة في عمود منجز
-- ============================================================
create or replace function public.sync_task_column_from_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done_column_id uuid;
  v_current_is_done_column boolean;
  v_first_open_column_id uuid;
begin
  if new.is_done = old.is_done then
    return new;
  end if;

  if new.is_done then
    select id into v_done_column_id from board_columns
      where project_id = new.project_id and is_done_column = true limit 1;
    if v_done_column_id is not null and new.column_id is distinct from v_done_column_id then
      new.column_id := v_done_column_id;
    end if;
  else
    if new.column_id is not null then
      select is_done_column into v_current_is_done_column from board_columns where id = new.column_id;
    end if;
    if coalesce(v_current_is_done_column, false) then
      select id into v_first_open_column_id from board_columns
        where project_id = new.project_id and is_done_column = false
        order by position asc limit 1;
      new.column_id := v_first_open_column_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_task_done_change on tasks;
create trigger on_task_done_change
  before update of is_done on tasks
  for each row execute function public.sync_task_column_from_done();

-- ============================================================
-- 4) دالة بتنشئ 3 أعمدة افتراضية (To Do / In Progress / Done) لمشروع معين
-- ============================================================
create or replace function public.seed_default_columns(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into board_columns (project_id, name, color, position, is_done_column)
  values
    (p_project_id, 'To Do', '#3b82f6', 0, false),
    (p_project_id, 'In Progress', '#a855f7', 1, false),
    (p_project_id, 'Review', '#eab308', 2, false),
    (p_project_id, 'Done', '#22c55e', 3, true);
end;
$$;

-- بتتنادى تلقائيًا لأي مشروع جديد يتعمل من دلوقتي
create or replace function public.handle_new_project_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_columns(new.id);
  return new;
end;
$$;

drop trigger if exists on_project_created_columns on projects;
create trigger on_project_created_columns
  after insert on projects
  for each row execute function public.handle_new_project_columns();

-- ============================================================
-- 5) Backfill: المشاريع القديمة (قبل الميجريشن ده) ماعندهاش أعمدة خالص -
--    ننشئلها الأعمدة الافتراضية، ونحط المهام القديمة في العمود المناسب
--    حسب is_done الحالية (منجزة → Done، غير كده → To Do)
-- ============================================================
do $$
declare
  proj record;
  v_todo_id uuid;
  v_done_id uuid;
begin
  for proj in select id from projects where not exists (
    select 1 from board_columns where board_columns.project_id = projects.id
  )
  loop
    perform public.seed_default_columns(proj.id);

    select id into v_todo_id from board_columns where project_id = proj.id and is_done_column = false order by position asc limit 1;
    select id into v_done_id from board_columns where project_id = proj.id and is_done_column = true limit 1;

    update tasks
    set column_id = case when is_done then v_done_id else v_todo_id end
    where project_id = proj.id and column_id is null;
  end loop;
end $$;
