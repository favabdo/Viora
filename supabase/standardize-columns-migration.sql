-- شغّل الملف ده مرة واحدة في Supabase SQL Editor، بعد ما تكون شغّلت board-columns-migration.sql.
--
-- الهدف: أي عمود مخصّص (custom) كان اتعمل قبل كده لأي مشروع بيتوحّد على 4 أعمدة قياسية بس:
-- To Do / In Progress / Review / Done - بالظبط زي التصميم الجديد.
--
-- ضمان عدم فقد أي بيانات: مفيش أي مهمة أو تعليق أو سجل بيتحذف خالص. كل اللي بيحصل إن
-- "عمود" كل مهمة (column_id) بيتغيّر بس حسب حالتها الحالية:
--   - المهام المفتوحة (is_done = false) → عمود "To Do"
--   - المهام المنجزة (is_done = true)   → عمود "Done"
-- وبعدين أي عمود قديم مش من الأربعة القياسيين (زي أعمدة كانت اتسمّت يدويًا قبل كده)
-- بيتحذف نفسه بس بعد ما يبقى فاضي تمامًا (كل مهامه اتنقلت للأعمدة القياسية فوق).

do $$
declare
  proj record;
  v_todo_id uuid;
  v_inprogress_id uuid;
  v_review_id uuid;
  v_done_id uuid;
begin
  for proj in select id from projects loop

    -- تأكد إن الأعمدة الأربعة القياسية موجودة (لو المشروع أصلاً معندوش أعمدة خالص)
    if not exists (select 1 from board_columns where project_id = proj.id) then
      perform public.seed_default_columns(proj.id);
    end if;

    -- لو الأعمدة القياسية بالاسم ده مش موجودة (كان فيه تسمية تانية)، ضيفها
    if not exists (select 1 from board_columns where project_id = proj.id and name = 'To Do') then
      insert into board_columns (project_id, name, color, position, is_done_column)
        values (proj.id, 'To Do', '#3b82f6', 0, false);
    end if;
    if not exists (select 1 from board_columns where project_id = proj.id and name = 'In Progress') then
      insert into board_columns (project_id, name, color, position, is_done_column)
        values (proj.id, 'In Progress', '#a855f7', 1, false);
    end if;
    if not exists (select 1 from board_columns where project_id = proj.id and name = 'Review') then
      insert into board_columns (project_id, name, color, position, is_done_column)
        values (proj.id, 'Review', '#eab308', 2, false);
    end if;
    if not exists (select 1 from board_columns where project_id = proj.id and name = 'Done') then
      insert into board_columns (project_id, name, color, position, is_done_column)
        values (proj.id, 'Done', '#22c55e', 3, true);
    end if;

    select id into v_todo_id from board_columns where project_id = proj.id and name = 'To Do' limit 1;
    select id into v_inprogress_id from board_columns where project_id = proj.id and name = 'In Progress' limit 1;
    select id into v_review_id from board_columns where project_id = proj.id and name = 'Review' limit 1;
    select id into v_done_id from board_columns where project_id = proj.id and name = 'Done' limit 1;

    -- كل مهمة مفتوحة → To Do، وكل مهمة منجزة → Done (حسب طلبك بالظبط)
    update tasks set column_id = v_todo_id where project_id = proj.id and is_done = false;
    update tasks set column_id = v_done_id where project_id = proj.id and is_done = true;

    -- دلوقتي أي عمود قديم غير الأربعة القياسيين بقى فاضي أكيد - نحذفه
    delete from board_columns
      where project_id = proj.id
        and id not in (v_todo_id, v_inprogress_id, v_review_id, v_done_id);

  end loop;
end $$;
