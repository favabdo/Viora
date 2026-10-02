"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { applyTheme, type Theme } from "./theme";

export type WeekStart = "sunday" | "monday";
export type DefaultView = "list" | "board" | "calendar" | "timeline";
export type DateFormat = "MMM_D_YYYY" | "DD_MM_YYYY" | "YYYY_MM_DD";
export type TimeFormat = "12h" | "24h";
export type Lang = "en" | "ar";

/** الجزء الخاص بالإعدادات فقط (بدون اللغة والمظهر) */
export type VioraSettings = {
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  defaultView: DefaultView;
  archiveCompletedTasks: boolean;
  moveTasksToTrash: boolean;
};

/** الإعدادات اللي بتتخزّن على الحساب — نفس القيم على أي جهاز بنفس اليوزر */
export type UserPreferences = VioraSettings & {
  language: Lang;
  theme: Theme;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  theme: "dark",
  timezone: "auto",
  dateFormat: "MMM_D_YYYY",
  timeFormat: "12h",
  weekStart: "sunday",
  defaultView: "list",
  archiveCompletedTasks: false,
  moveTasksToTrash: false,
};

const LEGACY_SETTINGS_KEY = "viora-settings";
const LEGACY_LANG_KEY = "viora-lang";
// أول حساب يتزامن على الجهاز بيرث لغة/مظهر الجهاز، والحسابات التانية
// بعدها تبدأ من الافتراضي — عشان إعدادات حساب ما تسرّبش لحساب تاني
const DEVICE_CLAIMED_KEY = "viora-prefs-claimed";
const cacheKey = (userId: string) => `viora-settings:${userId}`;

let activeUserId: string | null = null;
let current: UserPreferences = DEFAULT_PREFERENCES;
let hydrated = false;
const listeners = new Set<() => void>();

// في المتصفح بس: نبدأ من كاش الجهاز عشان أول رسم يطلع باللغة والمظبط
if (typeof window !== "undefined") current = readLocal(null);

/** يشترك في أي تغيير في الإعدادات (بيستعمله LanguageProvider ومكانه) */
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((fn) => fn());
}

function readJSON(raw: string | null): Partial<UserPreferences> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<UserPreferences>) : {};
  } catch {
    return {};
  }
}

function deviceTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_PREFERENCES.theme;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function deviceLanguage(): Lang {
  try {
    const stored = localStorage.getItem(LEGACY_LANG_KEY);
    return stored === "ar" || stored === "en" ? stored : DEFAULT_PREFERENCES.language;
  } catch {
    return DEFAULT_PREFERENCES.language;
  }
}

/** يقرأ التخزين المحلي لهذا اليوزر (أو إعدادات الجهاز قبل ما يبقى فيه حساب) */
function readLocal(userId: string | null): UserPreferences {
  try {
    // الكاش القديم كان بيحتوي language/theme من حساب سابق — دول ميورّثوش أبدًا
    const { language: _language, theme: _theme, ...legacySettings } = readJSON(
      localStorage.getItem(LEGACY_SETTINGS_KEY)
    ) as Partial<UserPreferences>;

    if (!userId) {
      return { ...DEFAULT_PREFERENCES, ...legacySettings, language: deviceLanguage(), theme: deviceTheme() };
    }

    const stored = readJSON(localStorage.getItem(cacheKey(userId))) as Partial<UserPreferences>;
    if (Object.keys(stored).length) return { ...DEFAULT_PREFERENCES, ...stored };

    if (localStorage.getItem(DEVICE_CLAIMED_KEY) === "1") {
      // حساب تاني على نفس الجهاز: لغة ومظهر الجهاز مش بتورّث
      return { ...DEFAULT_PREFERENCES, ...legacySettings };
    }
    try {
      localStorage.setItem(DEVICE_CLAIMED_KEY, "1");
    } catch {
      // تجاهل
    }
    // أول حساب على الجهاز: يرث لغة الجهاز ومظهره، وبعدين دول بيبقوا تبع الحساب نفسه
    return { ...DEFAULT_PREFERENCES, ...legacySettings, language: deviceLanguage(), theme: deviceTheme() };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeLocal(prefs: UserPreferences) {
  try {
    const payload = JSON.stringify(prefs);
    localStorage.setItem(activeUserId ? cacheKey(activeUserId) : LEGACY_SETTINGS_KEY, payload);
    // مرآة الجهاز: بيقرأها السكريبت اللي قبل أول رسم في layout.tsx
    localStorage.setItem(LEGACY_LANG_KEY, prefs.language);
  } catch {
    // localStorage مش متاح — الحالة لسه في الميموري
  }
}

/** يطبّق الآثار الجانبية للقيم الجديدة على الـDOM */
function applySideEffects(prefs: UserPreferences) {
  applyTheme(prefs.theme);
  document.documentElement.lang = prefs.language;
  document.documentElement.dir = prefs.language === "ar" ? "rtl" : "ltr";
}

function commit(next: UserPreferences, persist: boolean) {
  current = next;
  writeLocal(next);
  if (typeof document !== "undefined") applySideEffects(next);
  notify();
  if (persist) schedulePersist();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (!activeUserId) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, 500);
}

async function persistNow() {
  if (!activeUserId) return;
  const userId = activeUserId;
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, payload: current, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

/** يحفظ من الواجهة — بيكتب محليًا فورًا وعلى الحساب خلفيًا */
export function setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
  if (current[key] === value) return;
  commit({ ...current, [key]: value }, true);
}

/** نفس setPreference بس بمفاتيح الإعدادات فقط (بدون اللغة/المظهر) */
export function setSetting<K extends keyof VioraSettings>(key: K, value: VioraSettings[K]) {
  // TS ما يقدرش يربط VioraSettings[K] بـ UserPreferences[K] عبر generic،
  // والمفاتيح المشتركة أنواعها متطابقة فعلًا
  setPreference(key as keyof UserPreferences, value as never);
}

export function getStoredPreferences(): UserPreferences {
  return current;
}

/**
 * يجلب إعدادات اليوزر من الحساب. بيبدأ من الكاش المحلي للعرض الفوري،
 * وبعدين الخادم هو المرجع؛ ولو مفيش صف لليوزر بيرفع الإعدادات الحالية مرة واحدة.
 */
export async function hydrateUserSettings(userId: string): Promise<UserPreferences> {
  if (activeUserId !== userId) {
    activeUserId = userId;
    hydrated = false;
    current = readLocal(userId);
    if (typeof document !== "undefined") applySideEffects(current);
    notify();
  }
  if (hydrated) return current;
  hydrated = true;

  const { data, error } = await supabase.from("user_settings").select("payload").eq("user_id", userId).maybeSingle();

  if (error || !data) {
    // مفيش صف بعد (أو الجدول مش متشغّل) — ارفع الموجود عشان الجهاز التاني يلاقيه
    if (!error) void persistNow();
    return current;
  }

  const remote = { ...DEFAULT_PREFERENCES, ...(readJSON(JSON.stringify(data.payload ?? {}))) };
  const same = (Object.keys(DEFAULT_PREFERENCES) as (keyof UserPreferences)[]).every(
    (key) => JSON.stringify(remote[key]) === JSON.stringify(current[key])
  );
  if (!same) commit(remote, false);
  return current;
}

/** المظهر مربوط بالإعدادات المحفوظة على الحساب */
export function useThemePreference(): [Theme, (next: Theme) => void] {
  const { prefs } = usePreferences();
  const setTheme = useCallback((next: Theme) => setPreference("theme", next), []);
  return [prefs.theme, setTheme];
}

export function usePreferences(): { prefs: UserPreferences; setPref: typeof setPreference } {
  const [value, setValue] = useState<UserPreferences>(current);

  useEffect(() => {
    const sync = () => setValue(current);
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  return { prefs: value, setPref: setPreference };
}
