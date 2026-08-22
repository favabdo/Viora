-- تاريخ إنهاء المهمة: بيتسجل تلقائي لما is_done يبقى true، وبيتمسح لو رجعت مفتوحة
alter table tasks add column if not exists completed_at timestamptz;

create or replace function public.sync_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_done and (old.is_done is distinct from true) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif not new.is_done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_sync_completed_at on tasks;
create trigger tasks_sync_completed_at
  before update of is_done on tasks
  for each row execute function public.sync_task_completed_at();
