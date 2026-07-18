"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { splitActorMessage } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import ClickableName from "./ClickableName";

type Entry = {
  id: string;
  message: string;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
};

export default function ItemHistory({
  table,
  column,
  id,
  currentUserId,
}: {
  table: "activity_log" | "link_activity_log";
  column: "task_id" | "link_id";
  id: string;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      const columns =
        table === "activity_log" ? "id, actor_id, actor_name, message, created_at" : "id, message, created_at";
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq(column, id)
        .order("created_at", { ascending: true });
      if (!error && data) setEntries(data as unknown as Entry[]);
      setLoaded(true);
      setLoading(false);
    }
  }

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
        السجل
      </button>
      {open && (
        <div className="mt-1.5 border-r-2 border-line pr-3 space-y-1 fade-in">
          {loading ? (
            <p className="text-2xs text-inkFaint">جارٍ التحميل...</p>
          ) : entries.length === 0 ? (
            <p className="text-2xs text-inkFaint">لا يوجد سجل بعد</p>
          ) : (
            entries.map((e) => {
              const { label, rest, actorId } = splitActorMessage(e, currentUserId);
              return (
                <p key={e.id} className="text-2xs text-inkFaint">
                  {label && (
                    <>
                      <ClickableName userId={actorId} className="text-inkSoft">
                        {label}
                      </ClickableName>{" "}
                    </>
                  )}
                  {label ? rest.trimStart() : rest}{" "}
                  <span className="opacity-70">— {timeAgo(e.created_at)}</span>
                </p>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
