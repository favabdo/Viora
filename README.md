# الدفتر — مهام وروابط

موقع بسيط فيه سيكشنين:
- **المهام**: كل مشروع ليه مهامه، وأي مهمة تعملها صح بتتشطب.
- **الروابط**: تحفظ لينك وتكتبله وصف يفكرك ليه سيبته.

مبني بـ Next.js + Tailwind، والداتا بيز Supabase.

## 1. جهّز Supabase

1. افتح مشروعك في supabase.com (أو اعمل مشروع جديد).
2. روح على **SQL Editor** وشغّل محتوى ملف `supabase/schema.sql` اللي في المشروع ده (نسخ/لصق وRun). ده هيعمل جدول `profiles` (فيه اسم اليوزر اليونيك) بالإضافة للجداول التلاتة: `projects`, `tasks`, `links`.
3. من **Authentication → Providers → Email**، سيب "Confirm email" شغالة أو اقفلها حسب رغبتك (لو قافلها، اليوزر هيقدر يسجّل دخول على طول من غير تأكيد إيميل).
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

## ملاحظة عن الحماية (RLS) وتعدد المستخدمين

كل يوزر بيسجل حساب باسم مستخدم (username) لازم يكون يونيك — الجدول `profiles` فيه constraint بيمنع تكراره، وفي دالة `username_exists` بتتأكد إنه متاح قبل ما يخلّص التسجيل.

كل صف في `projects` و`tasks` و`links` مربوط بـ `user_id` بيتحدد تلقائي بـ `auth.uid()` وقت الإضافة، وسياسات RLS بتمنع أي يوزر يشوف أو يعدّل داتا يوزر تاني. يعني كل شخص بيدخل بحسابه بيشوف مشاريعه ومهامه ولينكاته هو بس، وكأنه بدأ من الصفر لما يسجل حساب جديد.

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
