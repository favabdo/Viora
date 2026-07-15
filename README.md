# الدفتر — مهام وروابط

موقع بسيط فيه سيكشنين:
- **المهام**: كل مشروع ليه مهامه، وأي مهمة تعملها صح بتتشطب.
- **الروابط**: تحفظ لينك وتكتبله وصف يفكرك ليه سيبته.

مبني بـ Next.js + Tailwind، والداتا بيز Supabase.

## 1. جهّز Supabase

1. افتح مشروعك في supabase.com (أو اعمل مشروع جديد).
2. روح على **SQL Editor** وشغّل محتوى ملف `supabase/schema.sql` اللي في المشروع ده (نسخ/لصق وRun). ده هيعمل الجداول التلاتة: `projects`, `tasks`, `links`.
3. من **Project Settings → API** خد:
   - `Project URL`
   - `anon public key`

## 2. شغّل المشروع محليًا

```bash
npm install
cp .env.local.example .env.local
```

افتح `.env.local` وحط فيه القيم اللي جبتها من Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
```

بعدين:

```bash
npm run dev
```

افتح http://localhost:3000

## 3. الرفع على Vercel

1. ارفع المشروع على GitHub (repo جديد).
2. من Vercel، اعمل **Import Project** واختار الـ repo.
3. في **Environment Variables** ضيف نفس المتغيرين اللي في `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy، وخلاص هيشتغل.

## ملاحظة عن الحماية (RLS)

الـ SQL بيفعّل Row Level Security بس بسياسة مفتوحة (public access) عشان الموقع شخصي بدون تسجيل دخول. لو حبيت تأمينه أكتر بعدين (تسجيل دخول بالإيميل مثلاً)، قولّي وأظبطلك auth + سياسات مربوطة بـ `auth.uid()`.

## البنية

```
app/
  layout.tsx      # الفونتات والـ RTL
  page.tsx        # الصفحة الرئيسية (تابز مهام/روابط)
  globals.css      # تصميم الورقة والـ checkbox
components/
  TasksSection.tsx # المشاريع + المهام
  LinksSection.tsx # الروابط والوصف
lib/
  supabase.ts      # الاتصال بالداتا بيز + الأنواع
supabase/
  schema.sql        # السكريبت اللي بتشغله في Supabase
```
