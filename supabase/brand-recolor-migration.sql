-- توحيد الهوية اللونية: إزالة البنفسجي من البيانات المحفوظة
-- النسخ القديمة (بنفسجي/نيلي) → الخلفية النحاسية الجديدة Ember & Sand

begin;

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#EA580C'),
    ('#7C5CFF', '#EA580C'),
    ('#8B5CF6', '#F97316'),
    ('#7C3AED', '#C2410C'),
    ('#8C3AED', '#EA580C'),
    ('#A855F7', '#EC4899'),
    ('#6366F1', '#C2410C'),
    ('#4F46E5', '#9A3412'),
    ('#A78BFA', '#FDBA74'),
    ('#C4B5FD', '#FDBA74')
)
update tasks t
set color = m.new_color
from map m
where lower(t.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#EA580C'),
    ('#7C5CFF', '#EA580C'),
    ('#8B5CF6', '#F97316'),
    ('#7C3AED', '#C2410C'),
    ('#8C3AED', '#EA580C'),
    ('#A855F7', '#EC4899'),
    ('#6366F1', '#C2410C'),
    ('#4F46E5', '#9A3412'),
    ('#A78BFA', '#FDBA74'),
    ('#C4B5FD', '#FDBA74')
)
update links l
set color = m.new_color
from map m
where lower(l.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#EA580C'),
    ('#7C5CFF', '#EA580C'),
    ('#8B5CF6', '#F97316'),
    ('#7C3AED', '#C2410C'),
    ('#8C3AED', '#EA580C'),
    ('#A855F7', '#EC4899'),
    ('#6366F1', '#C2410C'),
    ('#4F46E5', '#9A3412'),
    ('#A78BFA', '#FDBA74'),
    ('#C4B5FD', '#FDBA74')
)
update ideas i
set color = m.new_color
from map m
where lower(i.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#EA580C'),
    ('#7C5CFF', '#EA580C'),
    ('#8B5CF6', '#F97316'),
    ('#7C3AED', '#C2410C'),
    ('#8C3AED', '#EA580C'),
    ('#A855F7', '#EC4899'),
    ('#6366F1', '#C2410C'),
    ('#4F46E5', '#9A3412'),
    ('#A78BFA', '#FDBA74'),
    ('#C4B5FD', '#FDBA74')
)
update board_columns b
set color = m.new_color
from map m
where lower(b.color) = lower(m.old_color);

alter table ideas alter column color set default '#EA580C';

commit;
