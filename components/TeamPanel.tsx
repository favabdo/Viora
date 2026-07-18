"use client";

import { useEffect, useState } from "react";
import { supabase, ProjectMember } from "@/lib/supabase";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Badge from "./ui/Badge";
import Avatar from "./ui/Avatar";
import Modal from "./ui/Modal";
import { Input } from "./ui/Input";
import { Check, Link2, X } from "lucide-react";
import ClickableName from "./ClickableName";
import { resolveName } from "@/lib/displayName";

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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    loadMembers();
    prepareInviteLink();
  }, [projectId]);

  // بنجهّز رابط الدعوة مقدمًا عشان لما المستخدم يدوس "نسخ" ينسخ فورًا من أول ضغطة
  async function prepareInviteLink() {
    const { data, error } = await supabase.rpc("get_or_create_invite_link", {
      p_project_id: projectId,
    });
    if (!error && data) {
      setInviteUrl(`${window.location.origin}/join/${data}`);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // فولباك لمتصفحات/ويبفيوهات مش داعمة لـ Clipboard API
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }

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
    setLinkMsg("");
    let url = inviteUrl;

    if (!url) {
      setCopyingLink(true);
      const { data, error } = await supabase.rpc("get_or_create_invite_link", {
        p_project_id: projectId,
      });
      setCopyingLink(false);
      if (error || !data) {
        setLinkMsg("حدث خطأ أثناء إنشاء الرابط");
        return;
      }
      url = `${window.location.origin}/join/${data}`;
      setInviteUrl(url);
    }

    const ok = await copyText(url);
    if (ok) {
      setLinkMsg("تم النسخ بنجاح");
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } else {
      setLinkMsg(url);
    }
  }

  const accepted = members.filter((m) => m.status === "accepted");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-medium">فريق المشروع</h3>
        <IconButton aria-label="إغلاق" onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="mb-5">
        <Button variant="secondary" fullWidth loading={copyingLink} onClick={copyInviteLink}>
          {justCopied ? <Check size={14} strokeWidth={2} /> : <Link2 size={14} strokeWidth={1.75} />}
          {justCopied ? "تم النسخ بنجاح" : "نسخ رابط دعوة للمشروع"}
        </Button>
        {linkMsg && !justCopied && <p className="text-xs text-inkSoft mt-1.5">{linkMsg}</p>}
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
        {inviteError && <p className="text-oxblood text-xs mt-1.5">{inviteError}</p>}
        {inviteMsg && <p className="text-[#3E5A2C] text-xs mt-1.5">{inviteMsg}</p>}
      </div>

      <div className="border-t border-line pt-4">
        <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-2.5">
          الأعضاء · {accepted.length}
        </h4>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-10 rounded-md" />
            ))}
          </div>
        ) : (
          <ul className="space-y-1">
            {accepted.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                <Avatar name={resolveName(m.profiles)} size="sm" />
                <span className="flex-1 min-w-0">
                  <ClickableName userId={m.user_id} className="text-ink block truncate">
                    {resolveName(m.profiles)}
                  </ClickableName>
                  <span dir="ltr" className="font-mono text-2xs text-inkFaint">
                    @{m.profiles?.username || "?"}
                    {m.user_id === currentUserId && <span className="font-sans"> · أنت</span>}
                  </span>
                </span>
                <Badge tone="moss">عضو</Badge>
              </li>
            ))}
          </ul>
        )}

        {pending.length > 0 && (
          <>
            <h4 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mt-4 mb-2.5">
              دعوات معلّقة · {pending.length}
            </h4>
            <ul className="space-y-1">
              {pending.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                  <Avatar name={resolveName(m.profiles)} size="sm" />
                  <span dir="ltr" className="font-mono flex-1 min-w-0 truncate">
                    @{m.profiles?.username || "?"}
                  </span>
                  <Badge tone="brass">في الانتظار</Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
