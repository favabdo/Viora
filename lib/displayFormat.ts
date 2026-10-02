"use client";

import { useMemo } from "react";
import type { DateFormat, VioraSettings } from "./useSettings";
import { useSettings } from "./useSettings";
import { useTranslation } from "./i18n/LanguageContext";

export type DateStyle = "short" | "medium" | "numeric" | "iso";

/** صيغة التاريخ المختصرة المناسبة لإعداد dateFormat */
export function dateStyleFor(format: DateFormat): DateStyle {
  if (format === "DD_MM_YYYY") return "numeric";
  if (format === "YYYY_MM_DD") return "iso";
  return "medium";
}

export type DisplayOpts = {
  locale: string;
  timeZone?: string;
  timeFormat: "12h" | "24h";
};

export function displayOptsFrom(settings: VioraSettings, lang: "en" | "ar"): DisplayOpts {
  return {
    locale: lang === "ar" ? "ar-EG" : "en-US",
    timeZone: settings.timezone === "auto" ? undefined : settings.timezone,
    timeFormat: settings.timeFormat,
  };
}

function resolveTimeZone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

function fmt(o: DisplayOpts, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(o.locale, { ...opts, timeZone: resolveTimeZone(o.timeZone) });
}

/** التاريخ بصيغة المستخدم المختارة (short للعرض المختصر مثل 17 أغسطس) */
export function fmtDate(value: Date | string, o: DisplayOpts, style: DateStyle = "medium"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  if (style === "iso") {
    try {
      const parts = fmt(o, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
      const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }
  let opts: Intl.DateTimeFormatOptions;
  if (style === "numeric") {
    // ترتيب يوم/شهر/سنة ثابت (en-GB) لأن الصيغة المعروضة في الإعدادات هي 17/08/2026
    try {
      return new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: resolveTimeZone(o.timeZone),
      }).format(d);
    } catch {
      opts = { year: "numeric", month: "2-digit", day: "2-digit" };
    }
  } else if (style === "short") opts = { day: "numeric", month: "short" };
  else opts = { year: "numeric", month: "short", day: "numeric" };
  try {
    return fmt(o, opts).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function fmtTime(value: Date | string, o: DisplayOpts): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return fmt(o, { hour: "2-digit", minute: "2-digit", hour12: o.timeFormat === "12h" }).format(d);
  } catch {
    return "";
  }
}

export function fmtDateTime(value: Date | string, o: DisplayOpts, style: DateStyle = "medium"): string {
  const date = fmtDate(value, o, style);
  const time = fmtTime(value, o);
  return time ? `${date} ${time}` : date;
}

export function weekdayLabel(value: Date | string, o: DisplayOpts, width: "short" | "long" = "short"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return fmt(o, { weekday: width }).format(d);
}

export function monthLabel(value: Date | string, o: DisplayOpts): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return fmt(o, { month: "long", year: "numeric" }).format(d);
}

/** "الآن" بتوقيت المنطقة الزمنية المختارة — يُستخدم لحساب الفروق النسبية */
export function zonedNow(o: DisplayOpts): Date {
  if (!o.timeZone) return new Date();
  const parts = fmt(o, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "0";
  const h = Number(get("hour")) % 24;
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    h,
    Number(get("minute")),
    Number(get("second"))
  );
}

/** الإعدادات الحية للعرض: locale + timezone + صيغة الوقت + صيغة التاريخ المختارة */
export function useDisplay() {
  const { lang } = useTranslation();
  const { settings } = useSettings();
  return useMemo(
    () => ({
      opts: displayOptsFrom(settings, lang),
      dateStyle: dateStyleFor(settings.dateFormat),
      weekStartMonday: settings.weekStart === "monday",
    }),
    [settings, lang]
  );
}
