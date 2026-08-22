"use client";

import { useEffect, useState } from "react";
import { supabase, ActivityEntry } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { renderActivity } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import ClickableName from "./ClickableName";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function ActivityFeed({
  projectId,
  currentUserId,
  variant = "default",
}: {
  projectId: string;
  currentUserId: string;
  variant?: "default" | "panel";
}) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(variant === "panel");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOpen(variant === "panel");
    supabase
      .from("activity_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(25)
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setEntries(data as ActivityEntry[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`activity-${projectId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setEntries((prev) => [payload.new as ActivityEntry, ...prev].slice(0, 25));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const list = (
    <ul className="space-y-2.5 fade-in">
      {entries.slice(0, variant === "panel" ? 6 : 25).map((e) => {
        const { label, rest, actorId } = renderActivity(e, t, currentUserId, true);
        return (
          <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-inkSoft min-w-0">
              {label && (
                <>
                  <ClickableName userId={actorId} className="text-ink">
                    {label}
                  </ClickableName>{" "}
                </>
              )}
              {label ? rest.trimStart() : rest}
            </span>
            <span className="text-2xs text-inkFaint whitespace-nowrap shrink-0 font-mono tabular-nums pt-0.5">
              {timeAgo(e.created_at, t)}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "panel") {
    return (
      <div className="bg-surface border border-line rounded-lg p-4 h-full">
        <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">{t("activity.recent")}</h4>
        {loading ? (
          <p className="text-sm text-inkFaint">{t("common.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-inkFaint">{t("workspace.noActivity")}</p>
        ) : (
          list
        )}
      </div>
    );
  }

  if (loading || entries.length === 0) return null;

  return (
    <div className="mt-9 border-t border-line pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-inkFaint hover:text-teal uppercase transition-colors"
      >
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
        {t("activity.recent")}
      </button>
      {open && <div className="mt-3">{list}</div>}
    </div>
  );
}
