-- ============================================================
-- رفع حساب إلى Pro أو Team (تشغيل في Supabase SQL Editor)
-- ============================================================
-- هذا السكربت يُنفَّذ مرة واحدة على مستوى القاعدة بواسطة المستخدم
-- الـ admin (service role) فقط — لأن trigger profiles_block_plan_self_update
-- يمنع المستخدم نفسه من تغيير خطة حسابه.
--
-- الاستخدام: غيّر القيم في المتغيرين `target_email` و`target_plan` ثم شغّل.
-- ============================================================

do $$
declare
  target_email text := 'USER_EMAIL_HERE';  -- ← غيّر للإيميل المطلوب
  target_plan  text := 'pro';              -- ← 'pro' أو 'team'
  target_id    uuid;
  current_plan text;
begin
  -- تحقّق إن الإيميل موجود في profiles
  select id, plan into target_id, current_plan
  from public.profiles
  where id in (
    select id from auth.users where email = target_email
  );

  if target_id is null then
    raise notice 'الحساب غير موجود: %', target_email;
  else
    -- تحقّق إن الخطة الجديدة صحيحة
    if target_plan not in ('free', 'pro', 'team') then
      raise exception 'قيمة خطة غير صحيحة: % (المتوقع: free | pro | team)', target_plan;
    end if;

    -- تحديث الخطة (admin/service_role فقط)
    update public.profiles
    set plan = target_plan
    where id = target_id;

    raise notice '✅ تم تغيير خطة الحساب % من % → %', target_email, current_plan, target_plan;
    raise notice '   user_id = %', target_id;
  end if;
end $$;

-- ============================================================
-- بديل: رفع عبر user_id مباشرة
-- ============================================================
-- update public.profiles set plan = 'pro' where id = 'USER_UUID_HERE';
-- update public.profiles set plan = 'team' where id = 'USER_UUID_HERE';
-- update public.profiles set plan = 'free' where id = 'USER_UUID_HERE';

-- ============================================================
-- بعد تشغيل السكربت: حدّث جلسة المستخدم (refresh) عشان الواجهة تشوف التغيير.
-- على الـclient: ضغط Ctrl+Shift+R أو عمل logout/login.
-- ============================================================
