"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import dict from "./dictionary";
import { getStoredPreferences, setPreference, subscribePreferences } from "../userSettings";

export type Lang = "en" | "ar";

type TranslateVars = Record<string, string | number | boolean | null | undefined>;

function fillVars(text: string, vars?: TranslateVars) {
  if (!vars) return text;
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(value ?? ""));
  }
  return out;
}

type LanguageContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string, vars?: TranslateVars) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // الإنجليزية في أول رندر (سيرفر وكلاينت) عشان ما يحصلش hydration mismatch،
  // وبعدين المتجر (lib/userSettings) بيدي اللغة المحفوظة على الحساب أو كاش الجهاز.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const sync = () => setLangState(getStoredPreferences().language);
    sync();
    return subscribePreferences(sync);
  }, []);

  const setLang = useCallback((next: Lang) => setPreference("language", next), []);
  const toggleLang = useCallback(
    () => setPreference("language", getStoredPreferences().language === "ar" ? "en" : "ar"),
    []
  );

  const t = useCallback(
    (key: string, vars?: TranslateVars) => {
      const entry = dict[key];
      if (!entry) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing translation key: ${key}`);
        return fillVars(key, vars);
      }
      return fillVars(entry[lang], vars);
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
