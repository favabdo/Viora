import dict from "./i18n/dictionary";

/** إعادة صياغة الجمل العامية المخزّنة في سجل النشاط إلى فصحى رسمية عند العرض */
export function formalizeStoredArabic(text: string): string {
  return text
    .replaceAll("حد ما", "أحد المستخدمين")
    .replaceAll(" خلّص المهمة", " أتمّ المهمة")
    .replaceAll(" خلّص مهمة: ", " أتمّ المهمة: ")
    .replaceAll(" رجّع المهمة معلّقة", " أعاد فتح المهمة")
    .replaceAll(" رجّع مهمة معلّقة: ", " أعاد فتح المهمة: ")
    .replaceAll(" أكمل المهمة", " أتمّ المهمة")
    .replaceAll(" أضاف مهمة جديدة: ", " قام بإضافة مهمة جديدة: ")
    .replaceAll(" أضاف مهمة: ", " قام بإضافة مهمة جديدة: ")
    .replaceAll(" انضم للمشروع", " انضم إلى المشروع")
    .replaceAll(" علّق على المهمة", " أضاف تعليقًا على المهمة")
    .replaceAll("تمت إضافة الرابط", "أُضيف الرابط")
    .replaceAll("تم تعديل الرابط والوصف", "عُدّل الرابط والوصف")
    .replaceAll("تم تعديل الرابط", "عُدّل الرابط")
    .replaceAll("تم تعديل الوصف", "عُدّل الوصف")
    .replace(/ دعا (.+) إلى المشروع$/, " وجّه دعوة إلى $1 للانضمام إلى المشروع");
}

function formalActorName(name: string | null | undefined, fallback: string): string {
  if (!name || name === "حد ما" || name === "مستخدم") return fallback;
  return name;
}

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
    return formalizeStoredArabic(entry.message);
  }
  const name = entry.actor_name;
  if (entry.message.startsWith(`@${name}`)) {
    return formalizeStoredArabic(`${youLabel}${entry.message.slice(name.length + 1)}`);
  }
  if (entry.message.startsWith(name)) {
    return formalizeStoredArabic(`${youLabel}${entry.message.slice(name.length)}`);
  }
  return formalizeStoredArabic(entry.message);
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
  const message = entry.message;

  if (name && message.startsWith(`@${name}`)) {
    return {
      label: isSelf ? youLabel : formalActorName(name, youLabel),
      rest: formalizeStoredArabic(message.slice(name.length + 1)),
      actorId,
    };
  }
  if (name && message.startsWith(name)) {
    return {
      label: isSelf ? youLabel : formalActorName(name, youLabel),
      rest: formalizeStoredArabic(message.slice(name.length)),
      actorId,
    };
  }
  return { label: "", rest: formalizeStoredArabic(message), actorId };
}

const STORED_PHRASES: { ar: string; en: string }[] = [
  { ar: " قام بإضافة مهمة جديدة:", en: " added a new task:" },
  { ar: " أضاف مهمة جديدة:", en: " added a new task:" },
  { ar: " أضاف مهمة:", en: " added a new task:" },
  { ar: " أتمّ المهمة: ", en: " completed the task: " },
  { ar: " أتمّ المهمة", en: " completed the task" },
  { ar: " أكمل المهمة", en: " completed the task" },
  { ar: " خلّص المهمة", en: " completed the task" },
  { ar: " أعاد فتح المهمة", en: " reopened the task" },
  { ar: " رجّع المهمة معلّقة", en: " reopened the task" },
  { ar: ' عدّل عنوان المهمة إلى "', en: ' changed the task title to "' },
  { ar: " حذف مهمة: ", en: " deleted a task: " },
  { ar: " غيّر حالة المهمة إلى ", en: " changed the status to " },
  { ar: " غيّر الحالة إلى ", en: " changed the status to " },
  { ar: " أزال موعد التسليم", en: " removed the due date" },
  { ar: " عدّل موعد التسليم إلى ", en: " changed the due date to " },
  { ar: " عدّل موعد التسليم", en: " changed the due date" },
  { ar: " عدّل تاريخ البداية إلى ", en: " changed the start date to " },
  { ar: " عدّل تاريخ البدء", en: " changed the start date" },
  { ar: " عدّل أولوية المهمة", en: " changed the task priority" },
  { ar: " أسند المهمة إلى ", en: " assigned the task to " },
  { ar: " أزال المسؤول عن المهمة", en: " removed the assignee" },
  { ar: " أضاف تعليقًا على المهمة", en: " commented on the task" },
  { ar: " علّق على المهمة", en: " commented on the task" },
  { ar: " حذف تعليقًا", en: " deleted a comment" },
  { ar: " انضم إلى المشروع", en: " joined the project" },
  { ar: " انضم للمشروع", en: " joined the project" },
  { ar: " وجّه دعوة إلى ", en: " invited " },
  { ar: " للانضمام إلى المشروع", en: " to the project" },
  { ar: " أعاد تسمية المشروع إلى ", en: " renamed the project to " },
  { ar: " رفع ملفًا: ", en: " uploaded a file: " },
  { ar: " حذف ملفًا: ", en: " removed a file: " },
  { ar: "أُضيف الرابط", en: "Link added" },
  { ar: "عُدّل الرابط والوصف", en: "Link and description updated" },
  { ar: "عُدّل الرابط", en: "Link updated" },
  { ar: "عُدّل الوصف", en: "Description updated" },
  { ar: "أحد المستخدمين", en: "Someone" },
].sort((a, b) => b.ar.length - a.ar.length);

function fillParams(template: string, params: Record<string, string | number | boolean | null>) {
  let text = template;
  for (const [key, value] of Object.entries(params)) {
    text = text.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return text;
}

function langFromT(t: (key: string) => string): "en" | "ar" {
  return t("common.you") === dict["common.you"].ar ? "ar" : "en";
}

function localizeStoredBody(text: string, lang: "en" | "ar"): string {
  let out = formalizeStoredArabic(text);
  for (const phrase of STORED_PHRASES) {
    out = lang === "en" ? out.split(phrase.ar).join(phrase.en) : out.split(phrase.en).join(phrase.ar);
  }
  return out;
}

export function inferActivityAction(message: string): string | null {
  const msg = message || "";
  const lower = msg.toLowerCase();
  const hit = (ar: string, en?: string) => msg.includes(ar) || (en ? lower.includes(en.toLowerCase()) : false);

  if (hit("الرابط والوصف", "link and description")) return "link_url_and_description_changed";
  if (hit("أُضيف الرابط", "link added") || hit("تمت إضافة الرابط")) return "link_added";
  if (hit("عُدّل الرابط", "link updated") || hit("تم تعديل الرابط")) return "link_url_changed";
  if (hit("عُدّل الوصف", "description updated") || hit("تم تعديل الوصف")) return "link_description_changed";
  if (hit("رفع ملف") || hit("أرفق") || lower.includes("uploaded a file")) return "file_uploaded";
  if (hit("حذف ملف") || lower.includes("removed a file")) return "file_deleted";
  if (hit("حذف تعليق") || lower.includes("deleted a comment")) return "comment_deleted";
  if (hit("أضاف تعليق") || hit("علّق") || lower.includes("commented")) return "comment_added";
  if (hit("وجّه دعوة") || / دعا .+إلى المشروع/.test(msg) || lower.includes("invited")) return "member_invited";
  if (hit("انضم") || lower.includes("joined the project")) return "member_joined";
  if (hit("أعاد تسمية") || lower.includes("renamed the project")) return "project_renamed";
  if (hit("قام بإضافة مهمة") || hit("أضاف مهمة") || lower.includes("added a new task")) return "task_created";
  if (hit("حذف مهمة") || lower.includes("deleted a task")) return "task_deleted";
  if (hit("أعاد فتح") || hit("رجّع") || lower.includes("reopened")) return "task_reopened";
  if (hit("أتمّ") || hit("أكمل") || hit("خلّص") || lower.includes("completed the task")) return "task_completed";
  if (hit("عنوان المهمة") || lower.includes("changed the task title")) return "task_title_changed";
  if (hit("أزال موعد") || lower.includes("removed the due")) return "task_due_cleared";
  if (hit("موعد التسليم") || lower.includes("due date")) return "task_due_changed";
  if (hit("تاريخ البدء") || hit("تاريخ البداية") || lower.includes("start date")) return "task_start_changed";
  if (hit("أولوية") || lower.includes("priority")) return "task_priority_changed";
  if (hit("أزال المسؤول") || lower.includes("removed the assignee")) return "task_unassigned";
  if (hit("أسند المهمة") || lower.includes("assigned the task")) return "task_assignee_changed";
  if (hit("غيّر حالة") || hit("غيّر الحالة") || lower.includes("changed the status")) return "task_status_changed";
  return null;
}

function activityTemplate(action: string, lang: "en" | "ar"): string | null {
  const entry = dict[`activity.${action}`];
  return entry ? entry[lang] : null;
}

/**
 * يعرض سجل النشاط حسب لغة الواجهة: نسخة إنجليزي كاملة أو نسخة عربي كاملة.
 * الصفوف الجديدة تستخدم action + القاموس. الصفوف القديمة تُستنتج من النص المخزّن.
 */
export function renderActivity(
  entry: {
    actor_id?: string | null;
    actor_name?: string | null;
    message: string;
    action?: string | null;
    action_params?: Record<string, string | number | boolean | null> | null;
  },
  t: (key: string) => string,
  currentUserId?: string,
  hasActor: boolean = true
): { label: string; rest: string; actorId: string | null } {
  const actorId = entry.actor_id ?? null;
  const lang = langFromT(t);
  const action =
    (entry.action && activityTemplate(entry.action, lang) ? entry.action : null) ||
    inferActivityAction(entry.message || "") ||
    (entry.action ? entry.action : null);
  const template = action ? activityTemplate(action, lang) : null;

  if (template) {
    const raw = entry.action_params;
    const params = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const text = fillParams(template, params);

    if (!hasActor) {
      return { label: "", rest: text, actorId: null };
    }

    const isSelf = !!currentUserId && !!actorId && actorId === currentUserId;
    const label = isSelf ? t("common.you") : formalActorName(entry.actor_name, t("common.someone"));
    return { label, rest: ` ${text}`, actorId };
  }

  const split = splitActorMessage(entry, currentUserId, t("common.you"));
  return { ...split, rest: localizeStoredBody(split.rest, lang) };
}
