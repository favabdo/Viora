-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
-- عمود إضافي اختياري لتاريخ بداية المهمة، عشان عرض Timeline يقدر يرسم شريط
-- من تاريخ البداية لتاريخ التسليم (due_date) بدل نقطة واحدة بس.

alter table tasks
  add column if not exists start_date date;
