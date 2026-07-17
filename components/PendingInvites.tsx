"use client";

import { useEffect, useState } from "react";
import { supabase, PendingInvite } from "@/lib/supabase";
import Button from "./ui/Button";
import { Mail } from "lucide-react";

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
          className="flex items-center justify-between gap-3 bg-tealSoft border border-teal/25 rounded-md px-3.5 py-2.5"
        >
          <p className="flex items-center gap-2 text-sm text-ink min-w-0">
            <Mail size={14} strokeWidth={1.75} className="text-teal shrink-0" />
            <span className="truncate">
              لديك دعوة للانضمام إلى مشروع{" "}
              <span className="font-medium">{inv.projects?.name || "مشروع"}</span>
            </span>
          </p>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              loading={responding === inv.project_id}
              onClick={() => respond(inv.project_id, true)}
            >
              قبول
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={responding === inv.project_id}
              onClick={() => respond(inv.project_id, false)}
            >
              رفض
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
