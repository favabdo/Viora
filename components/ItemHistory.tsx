"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { renderActivity } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import ClickableName from "./ClickableName";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Entry = {
  id: string;
  message: string;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action?: string | null;
  action_params?: Record<string, string> | null;
};

export default function ItemHistory({
  table,
  column,
  id,
  currentUserId,
  alwaysOpen = false,
}: {
  table: "activity_log" | "link_activity_log";
  column: "task_id" | "link_id";
  id: string;
  currentUserId?: string;
  alwaysOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(alwaysOpen);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const columns =
      table === "activity_log"
        ? "id, actor_id, actor_name, message, action, action_params, created_at"
        : "id, message, action, action_params, created_at";
    const fallbackColumns =
      table === "activity_log" ? "id, actor_id, actor_name, message, created_at" : "id, message, created_at";
    const primary = await supabase
      .from(table)
      .select(columns)
      .eq(column, id)
      .order("created_at", { ascending: true });
    let rows: Entry[] | null = !primary.error && primary.data ? (primary.data as unknown as Entry[]) : null;
    if (!rows) {
      const fallback = await supabase
        .from(table)
        .select(fallbackColumns)
        .eq(column, id)
        .order("created_at", { ascending: true });
      if (!fallback.error && fallback.data) rows = fallback.data as unknown as Entry[];
    }
    if (rows) setEntries(rows);
    setLoaded(true);
    setLoading(false);
  }, [column, id, table]);

  useEffect(() => {
    setLoaded(false);
    setEntries([]);
    if (alwaysOpen) void fetchEntries();
  }, [alwaysOpen, fetchEntries]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await fetchEntries();
  }

  const list = (
    <div className={alwaysOpen ? "space-y-2" : "mt-1.5 border-s-2 border-line ps-3 space-y-1 fade-in"}>
      {loading ? (
        <p className="text-xs text-inkFaint">{t("common.loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-inkFaint">{t("itemHistory.noHistory")}</p>
      ) : (
        entries.map((e) => {
          const { label, rest, actorId } = renderActivity(e, t, currentUserId, table === "activity_log");
          return (
            <p key={e.id} className={`leading-relaxed ${alwaysOpen ? "text-xs text-inkSoft" : "text-2xs text-inkSoft"}`}>
              {label && (
                <>
                  <ClickableName previewCard={column === "task_id"} userId={actorId} className="text-ink font-medium">
                    {label}
                  </ClickableName>{" "}
                </>
              )}
              {label ? rest.trimStart() : rest}{" "}
              <span className="text-inkFaint">— {timeAgo(e.created_at, t)}</span>
            </p>
          );
        })
      )}
    </div>
  );

  if (alwaysOpen) return <div>{list}</div>;

  return (
    <div className="mt-1">
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-2xs text-inkFaint hover:text-teal transition-colors"
      >
        <ChevronDown
          size={11}
          strokeWidth={2}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
        {t("itemHistory.log")}
      </button>
      {open && list}
    </div>
  );
}
