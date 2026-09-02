"use client";

import { useEffect, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function VioraAIAssistant() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed z-[60] bottom-5 end-4 sm:end-6 flex flex-col items-end gap-3 pointer-events-none">
      {open && (
        <div className="pointer-events-auto w-[min(92vw,380px)] h-[min(70vh,520px)] rounded-2xl border border-line bg-surface shadow-modal flex flex-col overflow-hidden fade-in viora-glass">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-gradient-to-r from-[#6C5CE7]/20 to-transparent">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#8b7cff] to-[#6C5CE7] text-white flex items-center justify-center shadow-[0_0_16px_rgba(108,92,231,0.45)]">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink leading-tight">{t("ai.panelTitle")}</p>
              <p className="text-[11px] text-inkFaint">{t("ai.panelSubtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-ink hover:bg-paperDark"
              aria-label={t("ai.close")}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto thin-scroll px-4 py-4 space-y-3">
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-[#6C5CE7]/20 text-[#a78bfa] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={12} />
              </div>
              <div className="rounded-2xl rounded-ss-md bg-paperDark border border-line px-3.5 py-2.5 text-[13px] leading-relaxed text-inkSoft max-w-[85%]">
                {t("ai.welcome")}
              </div>
            </div>
          </div>

          <form
            className="p-3 border-t border-line flex items-center gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="text"
              disabled
              placeholder={t("ai.placeholder")}
              className="flex-1 min-w-0 bg-surfaceSunken border-0 rounded-[1.75rem] px-3.5 py-2.5 text-sm text-ink placeholder:text-inkFaint"
            />
            <button
              type="submit"
              disabled
              className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-[#6C5CE7] text-white opacity-50"
              aria-label={t("ai.send")}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t("ai.open")}
          className="h-14 w-14 rounded-full bg-gradient-to-br from-[#8b7cff] to-[#5b4bd6] text-white shadow-[0_10px_30px_-8px_rgba(108,92,231,0.9)] hover:scale-[1.04] active:scale-[0.98] transition-transform flex items-center justify-center ring-2 ring-white/10"
        >
          {open ? <X size={22} /> : <Sparkles size={22} />}
        </button>
        <span className="text-[11px] font-semibold tracking-wide text-ink drop-shadow-sm">{t("ai.fabLabel")}</span>
      </div>
    </div>
  );
}
