"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import dict from "./dictionary";

export type Lang = "en" | "ar";

const STORAGE_KEY = "viora-lang";

type LanguageContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // الإنجليزية هي الافتراضية دايمًا في أول رندر (سيرفر وكلاينت) عشان نتجنب hydration mismatch،
  // وبعدين لو المستخدم كان مخزّن عربي في localStorage بنطبقه فورًا بعد mount (والسكريبت في layout.tsx
  // بيطبق dir/lang على <html> قبل أول رسم أصلاً عشان يمنع الوميض).
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") setLangState(stored);
    } catch {
      // localStorage مش متاح - نفضل على الإنجليزية
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // تجاهل لو localStorage مش متاح
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === "en" ? "ar" : "en")), []);

  const t = useCallback(
    (key: string) => {
      const entry = dict[key];
      if (!entry) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing translation key: ${key}`);
        return key;
      }
      return entry[lang];
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage لازم يتستخدم جوه LanguageProvider");
  return ctx;
}

/** اختصار مباشر بس لدالة الترجمة، عشان الاستخدام يبقى مختصر: const { t } = useTranslation(); */
export function useTranslation() {
  const { t, lang, dir, setLang, toggleLang } = useLanguage();
  return { t, lang, dir, setLang, toggleLang };
}
