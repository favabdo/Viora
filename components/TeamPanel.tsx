"use client";

import { useEffect, useState } from "react";
import { supabase, ProjectMember } from "@/lib/supabase";

export default function TeamPanel({
  projectId,
  currentUserId,
  onClose,
}: {
  projectId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviting, setInviting] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");
  const [copyingLink, setCopyingLink] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  async function loadMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_members")
      .select("id, project_id, user_id, status, invited_by, created_at, profiles!project_members_user_id_fkey(username, full_name)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (!error && data) setMembers(data as unknown as ProjectMember[]);
    setLoading(false);
  }

  async function inviteByUsername() {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    setInviteError("");
    setInviteMsg("");
    const { error } = await supabase.rpc("invite_user_by_username", {
      p_project_id: projectId,
      p_username: trimmed,
    });
    if (error) {
      setInviteError(error.message || "حصل خطأ، حاول تاني");
    } else {
      setInviteMsg(`تم إرسال دعوة لـ ${trimmed}`);
      setUsername("");
      loadMembers();
    }
    setInviting(false);
  }

  async function copyInviteLink() {
    setCopyingLink(true);
    setLinkMsg("");
    const { data, error } = await supabase.rpc("get_or_create_invite_link", {
      p_project_id: projectId,
    });
    if (!error && data) {
      const url = `${window.location.origin}/join/${data}`;
      try {
        await navigator.clipboard.writeText(url);
        setLinkMsg("تم نسخ رابط الدعوة! ابعته لأي حد عايز يشاركك المشروع");
      } catch {
        setLinkMsg(url);
      }
    } else {
      setLinkMsg("حصل خطأ في إنشاء اللينك");
    }
    setCopyingLink(false);
  }

  const accepted = members.filter((m) => m.status === "accepted");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50 fade-in">
      <div className="bg-paper border border-line rounded-2xl shadow-card max-w-md w-full p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold">فريق المشروع</h3>
          <button
            onClick={onClose}
            className="text-inkSoft hover:text-clay w-7 h-7 flex items-center justify-center rounded transition-colors"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        <div className="mb-5">
          <button
            onClick={copyInviteLink}
            disabled={copyingLink}
            className="w-full bg-ink text-paper px-4 py-2.5 rounded text-sm hover:bg-tealDark transition-colors disabled:opacity-60"
          >
            {copyingLink ? "لحظة..." : "نسخ رابط دعوة للمشروع"}
          </button>
          {linkMsg && <p className="text-xs text-inkSoft mt-1.5">{linkMsg}</p>}
        </div>

        <div className="mb-5 border-t border-line pt-4">
          <label className="block text-sm font-medium text-inkSoft mb-1.5">
            ادعِ حد باسم اليوزر بتاعه
          </label>
          <div className="flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && inviteByUsername()}
              placeholder="username"
              dir="ltr"
              className="flex-1 bg-white border border-line rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-teal text-left"
            />
            <button
              onClick={inviteByUsername}
              disabled={inviting}
              className="bg-teal text-paper px-4 py-2 rounded text-sm hover:bg-tealDark transition-colors disabled:opacity-60"
            >
              دعوة
            </button>
          </div>
          {inviteError && <p className="text-clay text-xs mt-1.5">{inviteError}</p>}
          {inviteMsg && <p className="text-sage text-xs mt-1.5">{inviteMsg}</p>}
        </div>

        <div className="border-t border-line pt-4">
          <h4 className="text-sm font-medium text-inkSoft mb-2">الأعضاء</h4>
          {loading ? (
            <p className="text-inkSoft text-sm">بتحمّل...</p>
          ) : (
            <ul className="space-y-1.5">
              {accepted.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between bg-white border border-line rounded px-3 py-2 text-sm"
                >
                  <span dir="ltr" className="font-mono">
                    @{m.profiles?.username || "?"}
                    {m.user_id === currentUserId && (
                      <span className="text-inkSoft text-xs font-sans"> (إنت)</span>
                    )}
                  </span>
                  <span className="text-xs text-sage">عضو</span>
                </li>
              ))}
            </ul>
          )}

          {pending.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-inkSoft mt-4 mb-2">دعوات معلّقة</h4>
              <ul className="space-y-1.5">
                {pending.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between bg-white border border-line rounded px-3 py-2 text-sm"
                  >
                    <span dir="ltr" className="font-mono">@{m.profiles?.username || "?"}</span>
                    <span className="text-xs text-clay">في الانتظار</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
