-- Replace stored legacy colors (purple/indigo/copper) with the Sea & Sage palette.
-- Run once in the Supabase SQL Editor.

begin;

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#2563EB'),
    ('#7C5CFF', '#2563EB'),
    ('#8C3AED', '#2563EB'),
    ('#EA580C', '#2563EB'),
    ('#8B5CF6', '#3B82F6'),
    ('#7C3AED', '#1D4ED8'),
    ('#6366F1', '#1D4ED8'),
    ('#C2410C', '#1D4ED8'),
    ('#4F46E5', '#1E40AF'),
    ('#6D28D9', '#1E40AF'),
    ('#5B4BD6', '#1E40AF'),
    ('#9A3412', '#1E40AF'),
    ('#A78BFA', '#BFDBFE'),
    ('#C4B5FD', '#BFDBFE'),
    ('#8B7CFF', '#93C5FD'),
    ('#FB923C', '#93C5FD'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#059669'),
    ('#E11D48', '#059669')
)
update tasks t
set color = m.new_color
from map m
where lower(t.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#2563EB'),
    ('#7C5CFF', '#2563EB'),
    ('#8C3AED', '#2563EB'),
    ('#EA580C', '#2563EB'),
    ('#8B5CF6', '#3B82F6'),
    ('#7C3AED', '#1D4ED8'),
    ('#6366F1', '#1D4ED8'),
    ('#C2410C', '#1D4ED8'),
    ('#4F46E5', '#1E40AF'),
    ('#6D28D9', '#1E40AF'),
    ('#5B4BD6', '#1E40AF'),
    ('#9A3412', '#1E40AF'),
    ('#A78BFA', '#BFDBFE'),
    ('#C4B5FD', '#BFDBFE'),
    ('#8B7CFF', '#93C5FD'),
    ('#FB923C', '#93C5FD'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#059669'),
    ('#E11D48', '#059669')
)
update links l
set color = m.new_color
from map m
where lower(l.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#2563EB'),
    ('#7C5CFF', '#2563EB'),
    ('#8C3AED', '#2563EB'),
    ('#EA580C', '#2563EB'),
    ('#8B5CF6', '#3B82F6'),
    ('#7C3AED', '#1D4ED8'),
    ('#6366F1', '#1D4ED8'),
    ('#C2410C', '#1D4ED8'),
    ('#4F46E5', '#1E40AF'),
    ('#6D28D9', '#1E40AF'),
    ('#5B4BD6', '#1E40AF'),
    ('#9A3412', '#1E40AF'),
    ('#A78BFA', '#BFDBFE'),
    ('#C4B5FD', '#BFDBFE'),
    ('#8B7CFF', '#93C5FD'),
    ('#FB923C', '#93C5FD'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#059669'),
    ('#E11D48', '#059669')
)
update ideas i
set color = m.new_color
from map m
where lower(i.color) = lower(m.old_color);

with map(old_color, new_color) as (
  values
    ('#6C5CE7', '#2563EB'),
    ('#7C5CFF', '#2563EB'),
    ('#8C3AED', '#2563EB'),
    ('#EA580C', '#2563EB'),
    ('#8B5CF6', '#3B82F6'),
    ('#7C3AED', '#1D4ED8'),
    ('#6366F1', '#1D4ED8'),
    ('#C2410C', '#1D4ED8'),
    ('#4F46E5', '#1E40AF'),
    ('#6D28D9', '#1E40AF'),
    ('#5B4BD6', '#1E40AF'),
    ('#9A3412', '#1E40AF'),
    ('#A78BFA', '#BFDBFE'),
    ('#C4B5FD', '#BFDBFE'),
    ('#8B7CFF', '#93C5FD'),
    ('#FB923C', '#93C5FD'),
    ('#A855F7', '#0891B2'),
    ('#EC4899', '#0891B2'),
    ('#D946EF', '#059669'),
    ('#E11D48', '#059669')
)
update board_columns b
set color = m.new_color
from map m
where lower(b.color) = lower(m.old_color);

alter table ideas alter column color set default '#2563EB';

commit;
