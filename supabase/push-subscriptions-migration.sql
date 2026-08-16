-- شغّل الملف ده مرة واحدة في Supabase SQL Editor.
--
-- جدول بيخزن اشتراكات إشعارات المتصفح (Web Push) - كل جهاز/متصفح فعّل التنبيهات
-- بييجيله صف هنا، والسيرفر بيستخدمهم عشان يبعت إشعار حقيقي للجهاز حتى لو المتصفح مقفول.

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
