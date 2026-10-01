"use client";

let mql: MediaQueryList | null = null;

/** كروت الـ hover بتظهر بس مع ماوس حقيقي — اللمس بيختار المهمة من غير كارت */
export function canHover(): boolean {
  if (typeof window === "undefined") return false;
  if (!mql) mql = window.matchMedia("(hover: hover) and (pointer: fine)");
  return mql.matches;
}
