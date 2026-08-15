/** فرق الوقت من الآن، بصياغة موجزة مترجمة حسب لغة الواجهة الحالية (t من useTranslation) */
export function timeAgo(iso: string, t: (key: string) => string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t("time.now");
  if (mins < 60) return t("time.minutesAgo").replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("time.hoursAgo").replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  if (days < 30) return t("time.daysAgo").replace("{n}", String(days));
  const months = Math.floor(days / 30);
  return t("time.monthsAgo").replace("{n}", String(months));
}
