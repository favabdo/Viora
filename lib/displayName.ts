export function resolveName(
  profile: { username?: string | null; full_name?: string | null } | null | undefined
) {
  return (profile?.full_name && profile.full_name.trim()) || profile?.username || "مستخدم";
}

/** اسم الشخص، أو "أنت" لو هو المستخدم الحالي نفسه */
export function displayName(
  personId: string | null | undefined,
  profile: { username?: string | null; full_name?: string | null } | null | undefined,
  currentUserId: string
) {
  if (personId && personId === currentUserId) return "أنت";
  return resolveName(profile);
}

/**
 * سجل النشاط بيخزّن الجملة كاملة جاهزة من السيرفر (مثلاً "سارة أضافت مهمة: كذا").
 * لو صاحب الحدث هو المستخدم الحالي، بنستبدل اسمه في بداية الجملة بكلمة "أنت".
 */
export function toDisplayMessage(
  entry: { actor_id?: string | null; actor_name?: string | null; message: string },
  currentUserId: string
) {
  if (!entry.actor_id || entry.actor_id !== currentUserId || !entry.actor_name) {
    return entry.message;
  }
  const name = entry.actor_name;
  if (entry.message.startsWith(`@${name}`)) {
    return `أنت${entry.message.slice(name.length + 1)}`;
  }
  if (entry.message.startsWith(name)) {
    return `أنت${entry.message.slice(name.length)}`;
  }
  return entry.message;
}
