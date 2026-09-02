"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { fileKind, previewUrl } from "@/lib/taskAttachments";
import type { TaskAttachment } from "@/lib/taskExtras";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export function formatFileBytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export default function FilePreview({ file, onClose }: { file: TaskAttachment; onClose: () => void }) {
  const { t } = useTranslation();
  const url = previewUrl(file);
  const kind = fileKind(file);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "text" || !url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => res.text())
      .then((value) => {
        if (!cancelled) setText(value);
      })
      .catch(() => {
        if (!cancelled) setText("");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, url]);

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
            >
              <ExternalLink size={14} />
              {t("taskDetail.openFile")}
            </a>
          )}
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-white/10" aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {!url && <p className="text-sm text-white/70">{t("taskDetail.previewUnavailable")}</p>}
        {url && kind === "image" && (
          <img src={url} alt={file.name} className="max-h-full max-w-full mx-auto object-contain rounded-lg" />
        )}
        {url && kind === "video" && <video src={url} controls autoPlay className="max-h-full w-full rounded-lg bg-black" />}
        {url && kind === "audio" && <audio src={url} controls autoPlay className="w-full mt-12" />}
        {url && kind === "pdf" && (
          <iframe src={url} title={file.name} className="w-full h-full min-h-[70vh] rounded-lg bg-white" />
        )}
        {url && kind === "text" && (
          <pre className="h-full overflow-auto rounded-lg bg-paperDark text-ink text-xs p-4 whitespace-pre-wrap">
            {text ?? "…"}
          </pre>
        )}
        {url && kind === "other" && (
          <iframe src={url} title={file.name} className="w-full h-full min-h-[70vh] rounded-lg bg-white" />
        )}
      </div>
    </div>
  );
}
