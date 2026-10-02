"use client";

import {
  DEFAULT_PREFERENCES,
  getStoredPreferences,
  setSetting,
  usePreferences,
  type DateFormat,
  type DefaultView,
  type TimeFormat,
  type VioraSettings,
  type WeekStart,
} from "./userSettings";

export type { DateFormat, DefaultView, TimeFormat, WeekStart };
export type { VioraSettings };
export type { UserPreferences } from "./userSettings";

/**
 * الإعدادات العامة للتطبيق — بقت مرتبطة بالحساب: نفس القيم بتترجع لأي جهاز
 * بنفس اليوزر (التخزين على user_settings في القاعدة، والكاش المحلي للسرعة).
 * كل القيم شغالة فعليًا: timezone/dateFormat/timeFormat عبر lib/displayFormat،
 * weekStart في التقاويم وشريط الرئيسية، defaultView في projectPath،
 * وarchiveCompletedTasks/moveTasksToTrash في lib/taskExtras.
 */
export function useSettings() {
  const { prefs } = usePreferences();
  const settings: VioraSettings = {
    timezone: prefs.timezone,
    dateFormat: prefs.dateFormat,
    timeFormat: prefs.timeFormat,
    weekStart: prefs.weekStart,
    defaultView: prefs.defaultView,
    archiveCompletedTasks: prefs.archiveCompletedTasks,
    moveTasksToTrash: prefs.moveTasksToTrash,
  };

  function updateSetting<K extends keyof VioraSettings>(key: K, value: VioraSettings[K]) {
    setSetting(key, value);
  }

  return { settings, updateSetting };
}

/** بيرجع الإعدادات المخزّنة مباشرة (من غير hook) - للمكوّنات اللي محتاجاها أول ما تفتح */
export function getStoredSettings(): VioraSettings {
  return getStoredPreferences();
}

export { DEFAULT_PREFERENCES };
