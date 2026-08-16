import webpush from "web-push";
import { supabase } from "@/lib/supabase";

/**
 * بيبعت إشعار Push حقيقي (زي أي تطبيق عادي) لكل الأجهزة/المتصفحات المشتركة، حتى لو
 * فيورا مقفولة خالص عندهم. محتاج المتغيرات دي في .env.local / إعدادات البيئة:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:you@example.com
 */
function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys مش متضافة في متغيرات البيئة - مش هيتبعت إشعار.");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendPushToAllSubscribers(title: string, body: string, url = "/"): Promise<void> {
  if (!configureWebPush()) return;

  const { data: subs, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error || !subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: any) {
        // الاشتراك بقى غير صالح (المستخدم شال الإذن أو غيّر جهاز) - نمسحه عشان منحاولش تاني في الفاضي
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[Push] فشل الإرسال لاشتراك:", sub.id, err?.message || err);
        }
      }
    })
  );
}
