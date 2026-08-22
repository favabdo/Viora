export function resolveName(
  profile: { username?: string | null; full_name?: string | null } | null | undefined,
  fallback: string = "User"
) {
  return (profile?.full_name && profile.full_name.trim()) || profile?.username || fallback;
}

/** اسم الشخص، أو ليبل "أنت"/"You" (حسب اللغة) لو هو المستخدم الحالي نفسه */
export function displayName(
  personId: string | null | undefined,
  profile: { username?: string | null; full_name?: string | null } | null | undefined,
  currentUserId: string,
  youLabel: string = "You"
) {
  if (personId && personId === currentUserId) return youLabel;
  return resolveName(profile);
}

/**
 * سجل النشاط بيخزّن الجملة كاملة جاهزة من السيرفر (مثلاً "سارة أضافت مهمة: كذا").
 * لو صاحب الحدث هو المستخدم الحالي، بنستبدل اسمه في بداية الجملة بكلمة "أنت"/"You".
 * ده مسار fallback للصفوف القديمة اللي اتسجلت قبل إضافة action/action_params.
 */
export function toDisplayMessage(
  entry: { actor_id?: string | null; actor_name?: string | null; message: string },
  currentUserId: string,
  youLabel: string = "You"
) {
  if (!entry.actor_id || entry.actor_id !== currentUserId || !entry.actor_name) {
    return entry.message;
  }
  const name = entry.actor_name;
  if (entry.message.startsWith(`@${name}`)) {
    return `${youLabel}${entry.message.slice(name.length + 1)}`;
  }
  if (entry.message.startsWith(name)) {
    return `${youLabel}${entry.message.slice(name.length)}`;
  }
  return entry.message;
}

/**
 * بيقسّم جملة السجل (القديمة، من غير action) لجزئين: اسم الفاعل (قابل للدوس عليه لفتح
 * كارت البروفايل) وباقي الجملة كنص عادي. لو معرفناش نحدد الاسم جوه الجملة، بيرجّع label
 * فاضي ووقتها العرض بيكون سطر واحد عادي زي ما كان.
 */
export function splitActorMessage(
  entry: { actor_id?: string | null; actor_name?: string | null; message: string },
  currentUserId?: string,
  youLabel: string = "You"
): { label: string; rest: string; actorId: string | null } {
  const actorId = entry.actor_id ?? null;
  const name = entry.actor_name;
  const isSelf = !!currentUserId && !!actorId && actorId === currentUserId;

  if (name && entry.message.startsWith(`@${name}`)) {
    return { label: isSelf ? youLabel : name, rest: entry.message.slice(name.length + 1), actorId };
  }
  if (name && entry.message.startsWith(name)) {
    return { label: isSelf ? youLabel : name, rest: entry.message.slice(name.length), actorId };
  }
  return { label: "", rest: entry.message, actorId };
}

/**
 * النسخة القابلة للترجمة: لو الصف فيه action (تم تسجيله بعد الـ migration الخاص بتعدد اللغات)
 * بنبني النص من قاموس الترجمة t() حسب لغة العرض الحالية. لو الصف قديم (من غير action)،
 * بنرجع لعرض الجملة المخزّنة زي ما هي (fallback) عبر splitActorMessage.
 *
 * t: دالة الترجمة من useTranslation()
 * hasActor: false لسجل الروابط (link_activity_log) اللي مفيهوش اسم فاعل خالص
 */
export function renderActivity(
  entry: {
    actor_id?: string | null;
    actor_name?: string | null;
    message: string;
    action?: string | null;
    action_params?: Record<string, string> | null;
  },
  t: (key: string) => string,
  currentUserId?: string,
  hasActor: boolean = true
): { label: string; rest: string; actorId: string | null } {
  const actorId = entry.actor_id ?? null;

  if (entry.action) {
    let text = t(`activity.${entry.action}`);
    const raw = entry.action_params;
    const params =
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(`{${key}}`, String(value ?? ""));
    }

    if (!hasActor) {
      return { label: "", rest: text, actorId: null };
    }

    const isSelf = !!currentUserId && !!actorId && actorId === currentUserId;
    const label = isSelf ? t("common.you") : entry.actor_name || t("common.someone");
    return { label, rest: ` ${text}`, actorId };
  }

  // fallback للصفوف القديمة اللي اتسجلت قبل إضافة action
  return splitActorMessage(entry, currentUserId, t("common.you"));
}
