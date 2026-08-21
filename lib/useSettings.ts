"use client";

import { useCallback, useEffect, useState } from "react";

export type WeekStart = "sunday" | "monday";
export type DefaultView = "list" | "board" | "calendar" | "timeline";
export type DateFormat = "MMM_D_YYYY" | "DD_MM_YYYY" | "YYYY_MM_DD";
export type TimeFormat = "12h" | "24h";

export type VioraSettings = {
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  defaultView: DefaultView;
  archiveCompletedTasks: boolean;
  moveTasksToTrash: boolean;
};

const STORAGE_KEY = "viora-settings";

const DEFAULT_SETTINGS: VioraSettings = {
  timezone: "auto",
  dateFormat: "MMM_D_YYYY",
  timeFormat: "12h",
  weekStart: "sunday",
  defaultView: "list",
  archiveCompletedTasks: false,
  moveTasksToTrash: false,
};

function loadSettings(): VioraSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * تفضيلات عامة للتطبيق متخزنة محليًا (localStorage) - مش مرتبطة بحساب معيّن.
 * بعض القيم شغالة فعليًا في التطبيق (weekStart, defaultView, timeFormat في الأماكن اللي
 * بتعرض تاريخ/وقت)، وبعضها لسه بس متخزنة كتفضيل مبدئي لحد ما نربطها بمكان استخدام حقيقي
 * (timezone, dateFormat, archiveCompletedTasks, moveTasksToTrash).
 */
export function useSettings() {
  const [settings, setSettings] = useState<VioraSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const updateSetting = useCallback(<K extends keyof VioraSettings>(key: K, value: VioraSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // تجاهل لو localStorage مش متاح
      }
      return next;
    });
  }, []);

  return { settings, updateSetting };
}

/** بيرجع الإعدادات المخزّنة مباشرة (من غير hook) - يفيد في مكوّنات بتحتاج القيمة أول ما تفتح بس */
export function getStoredSettings(): VioraSettings {
  return loadSettings();
}
