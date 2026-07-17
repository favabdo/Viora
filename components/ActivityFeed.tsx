"use client";

import { useEffect, useState } from "react";
import { supabase, ActivityEntry } from "@/lib/supabase";

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

export default function ActivityFeed({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
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

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <div className="mt-8 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-inkSoft mb-2.5">النشاط الأخير</h3>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-ink">{e.message}</span>
            <span className="text-xs text-inkSoft whitespace-nowrap shrink-0">{timeAgo(e.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
