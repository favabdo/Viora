"use client";

import { useEffect, useState } from "react";
import { supabase, ProjectMember } from "@/lib/supabase";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Badge from "./ui/Badge";
import { Input } from "./ui/Input";
import { Link2, X } from "lucide-react";

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
      setInviteError(error.message || "حدث خطأ، يُرجى المحاولة مرة أخرى");
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
        setLinkMsg("تم نسخ رابط الدعوة، يمكنك إرساله إلى أي شخص تريد مشاركته المشروع");
      } catch {
        setLinkMsg(url);
      }
    } else {
      setLinkMsg("حدث خطأ أثناء إنشاء الرابط");
    }
    setCopyingLink(false);
  }

  const accepted = members.filter((m) => m.status === "accepted");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div
      className="fixed inset-0 bg-ink/45 flex items-center justify-center p-4 z-50 fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-line rounded-lg shadow-modal max-w-md w-full p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-medium">فريق المشروع</h3>
          <IconButton aria-label="إغلاق" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="mb-5">
          <Button variant="secondary" fullWidth loading={copyingLink} onClick={copyInviteLink}>
            <Link2 size={14} strokeWidth={1.75} />
            نسخ رابط دعوة للمشروع
          </Button>
          {linkMsg && <p className="text-xs text-inkSoft mt-1.5">{linkMsg}</p>}
        </div>

        <div className="mb-5 border-t border-line pt-4">
          <label className="block text-sm font-medium text-inkSoft mb-1.5">
            ادعُ عضوًا باسم المستخدم الخاص به
          </label>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && inviteByUsername()}
              placeholder="username"
              dir="ltr"
              className="font-mono text-left"
            />
            <Button variant="primary" loading={inviting} onClick={inviteByUsername}>
              دعوة
            </Button>
          </div>
          {inviteError && <p className="text-clay text-xs mt-1.5">{inviteError}</p>}
          {inviteMsg && <p className="text-[#4B6640] text-xs mt-1.5">{inviteMsg}</p>}
        </div>

        <div className="border-t border-line pt-4">
          <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-2">الأعضاء</h4>
          {loading ? (
            <div className="space-y-1.5">
              {[0, 1].map((i) => (
                <div key={i} className="skeleton h-8 rounded-md" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {accepted.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span dir="ltr" className="font-mono">
                    @{m.profiles?.username || "?"}
                    {m.user_id === currentUserId && (
                      <span className="text-inkFaint text-xs font-sans"> (أنت)</span>
                    )}
                  </span>
                  <Badge tone="sage">عضو</Badge>
                </li>
              ))}
            </ul>
          )}

          {pending.length > 0 && (
            <>
              <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mt-4 mb-2">
                دعوات معلّقة
              </h4>
              <ul className="divide-y divide-line">
                {pending.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span dir="ltr" className="font-mono">@{m.profiles?.username || "?"}</span>
                    <Badge tone="clay">في الانتظار</Badge>
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
