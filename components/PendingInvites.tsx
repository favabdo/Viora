"use client";

import { useEffect, useState } from "react";
import { supabase, PendingInvite } from "@/lib/supabase";

export default function PendingInvites({ userId }: { userId: string }) {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [userId]);

  async function load() {
    const { data, error } = await supabase
      .from("project_members")
      .select("id, project_id, status, invited_by, created_at, projects(name)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (!error && data) setInvites(data as unknown as PendingInvite[]);
  }

  async function respond(projectId: string, accept: boolean) {
    setResponding(projectId);
    await supabase.rpc("respond_to_invite", { p_project_id: projectId, p_accept: accept });
    setInvites((prev) => prev.filter((i) => i.project_id !== projectId));
    setResponding(null);
    if (accept) window.location.reload();
  }

  if (invites.length === 0) return null;

  return (
    <div className="mb-6 space-y-2 fade-in">
      {invites.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between gap-3 bg-white border border-teal/40 rounded-lg px-4 py-3 shadow-card"
        >
          <p className="text-sm text-ink">
            عندك دعوة تنضم لمشروع <span className="font-medium">{inv.projects?.name || "مشروع"}</span>
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => respond(inv.project_id, true)}
              disabled={responding === inv.project_id}
              className="bg-sage text-paper px-3 py-1.5 rounded text-xs hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              قبول
            </button>
            <button
              onClick={() => respond(inv.project_id, false)}
              disabled={responding === inv.project_id}
              className="border border-line text-inkSoft px-3 py-1.5 rounded text-xs hover:text-clay hover:border-clay transition-colors disabled:opacity-60"
            >
              رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
