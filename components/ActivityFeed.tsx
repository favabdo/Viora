"use client";

import { useEffect, useState } from "react";
import { supabase, ActivityEntry } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { toDisplayMessage } from "@/lib/displayName";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function ActivityFeed({
  projectId,
  currentUserId,
}: {
  projectId: string;
  currentUserId: string;
}) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOpen(false);
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
      .channel(`activity-${projectId}`)
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
        النشاط الأخير
      </button>
      {open && (
        <ul className="space-y-2.5 mt-3 fade-in">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-inkSoft">{toDisplayMessage(e, currentUserId)}</span>
              <span className="text-2xs text-inkFaint whitespace-nowrap shrink-0 font-mono tabular-nums pt-0.5">
                {timeAgo(e.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
