-- Replace stored legacy colors (purple/indigo/copper) with the Sea & Sage palette.
-- Run once in the Supabase SQL Editor.

begin;

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#3D6EA5'),
    ('#7C5CFF', '#3D6EA5'),
    ('#8C3AED', '#3D6EA5'),
    ('#EA580C', '#3D6EA5'),
    ('#8B5CF6', '#5B8FC7'),
    ('#7C3AED', '#2B5680'),
    ('#6366F1', '#2B5680'),
    ('#C2410C', '#2B5680'),
    ('#4F46E5', '#1E3F5E'),
    ('#6D28D9', '#1E3F5E'),
    ('#5B4BD6', '#1E3F5E'),
    ('#9A3412', '#1E3F5E'),
    ('#A78BFA', '#B7D5EE'),
    ('#C4B5FD', '#B7D5EE'),
    ('#8B7CFF', '#9CC3E5'),
    ('#FB923C', '#9CC3E5'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#0D9488'),
    ('#E11D48', '#0D9488')
)
update tasks t
set color = m.new_color
from map m
where lower(t.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#3D6EA5'),
    ('#7C5CFF', '#3D6EA5'),
    ('#8C3AED', '#3D6EA5'),
    ('#EA580C', '#3D6EA5'),
    ('#8B5CF6', '#5B8FC7'),
    ('#7C3AED', '#2B5680'),
    ('#6366F1', '#2B5680'),
    ('#C2410C', '#2B5680'),
    ('#4F46E5', '#1E3F5E'),
    ('#6D28D9', '#1E3F5E'),
    ('#5B4BD6', '#1E3F5E'),
    ('#9A3412', '#1E3F5E'),
    ('#A78BFA', '#B7D5EE'),
    ('#C4B5FD', '#B7D5EE'),
    ('#8B7CFF', '#9CC3E5'),
    ('#FB923C', '#9CC3E5'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#0D9488'),
    ('#E11D48', '#0D9488')
)
update links l
set color = m.new_color
from map m
where lower(l.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#3D6EA5'),
    ('#7C5CFF', '#3D6EA5'),
    ('#8C3AED', '#3D6EA5'),
    ('#EA580C', '#3D6EA5'),
    ('#8B5CF6', '#5B8FC7'),
    ('#7C3AED', '#2B5680'),
    ('#6366F1', '#2B5680'),
    ('#C2410C', '#2B5680'),
    ('#4F46E5', '#1E3F5E'),
    ('#6D28D9', '#1E3F5E'),
    ('#5B4BD6', '#1E3F5E'),
    ('#9A3412', '#1E3F5E'),
    ('#A78BFA', '#B7D5EE'),
    ('#C4B5FD', '#B7D5EE'),
    ('#8B7CFF', '#9CC3E5'),
    ('#FB923C', '#9CC3E5'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#0D9488'),
    ('#E11D48', '#0D9488')
)
update ideas i
set color = m.new_color
from map m
where lower(i.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#3D6EA5'),
    ('#7C5CFF', '#3D6EA5'),
    ('#8C3AED', '#3D6EA5'),
    ('#EA580C', '#3D6EA5'),
    ('#8B5CF6', '#5B8FC7'),
    ('#7C3AED', '#2B5680'),
    ('#6366F1', '#2B5680'),
    ('#C2410C', '#2B5680'),
    ('#4F46E5', '#1E3F5E'),
    ('#6D28D9', '#1E3F5E'),
    ('#5B4BD6', '#1E3F5E'),
    ('#9A3412', '#1E3F5E'),
    ('#A78BFA', '#B7D5EE'),
    ('#C4B5FD', '#B7D5EE'),
    ('#8B7CFF', '#9CC3E5'),
    ('#FB923C', '#9CC3E5'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#0D9488'),
    ('#E11D48', '#0D9488')
)
update board_columns b
set color = m.new_color
from map m
where lower(b.color) = lower(m.old_color);

alter table ideas alter column color set default '#3D6EA5';

commit;
