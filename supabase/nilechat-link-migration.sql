-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
--
-- الهدف: ربط حساب المستخدم في Viora بحسابه كـ agent في NileChat، عن طريق access_token
-- بياخده المستخدم من صفحة البروفايل بتاعته في NileChat ويحطه في بروفايله في فيورا.
--
-- ملحوظة أمان مهمة: جدول profiles عنده RLS policy اسمها "profiles select shared" بتسمح
-- لأي عضو فريق يقرا بيانات أي عضو تاني (عشان الأسماء والصور تظهر في كل مكان). access_token
-- ده بيوصّل لحساب حقيقي في نايل شات، فمينفعش نحطه في عمود جوه profiles - بيتحط في جدول
-- منفصل كل يوزر يشوف صفه بس.

create table if not exists nilechat_links (
  user_id uuid primary key references profiles(id) on delete cascade,
  access_token text not null,
  agent_id bigint not null,
  agent_name text not null,
  linked_at timestamptz not null default now()
);

alter table nilechat_links enable row level security;

drop policy if exists "nilechat_links own row" on nilechat_links;
create policy "nilechat_links own row" on nilechat_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
