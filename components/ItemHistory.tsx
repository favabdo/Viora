"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "دلوقتي";
  if (mins < 60) return `من ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `من ${hours} س`;
  const days = Math.floor(hours / 24);
  return `من ${days} يوم`;
}

type Entry = { id: string; message: string; created_at: string };

export default function ItemHistory({
  table,
  column,
  id,
}: {
  table: "activity_log" | "link_activity_log";
  column: "task_id" | "link_id";
  id: string;
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
      const { data, error } = await supabase
        .from(table)
        .select("id, message, created_at")
        .eq(column, id)
        .order("created_at", { ascending: true });
      if (!error && data) setEntries(data as Entry[]);
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
            <p className="text-2xs text-inkFaint">بتحمّل...</p>
          ) : entries.length === 0 ? (
            <p className="text-2xs text-inkFaint">مفيش سجل لسه</p>
          ) : (
            entries.map((e) => (
              <p key={e.id} className="text-2xs text-inkFaint">
                {e.message} <span className="opacity-70">— {timeAgo(e.created_at)}</span>
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
}
