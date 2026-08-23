"use client";

import { useState } from "react";
import { supabase, TaskComment } from "@/lib/supabase";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { displayName } from "@/lib/displayName";
import { timeAgo } from "@/lib/timeAgo";
import ClickableName from "./ClickableName";
import { Textarea } from "./ui/Input";
import IconButton from "./ui/IconButton";
import Avatar from "./ui/Avatar";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * تعليقات المهمة: زرار بيعرض عدد التعليقات، ولو دُس عليه بيفتح كل التعليقات
 * كاملة (مين كتبها وامتا) مع حقل لإضافة تعليق جديد.
 */
export default function TaskComments({
  taskId,
  projectId,
  currentUserId,
  count,
  onCountChange,
}: {
  taskId: string;
  projectId: string;
  currentUserId: string;
  count: number;
  onCountChange: (taskId: string, delta: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, profiles!task_comments_user_id_fkey(username, full_name, avatar_url)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (!error && data) setComments(data as unknown as TaskComment[]);
      setLoaded(true);
      setLoading(false);
    }
  }

  async function addComment() {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("task_comments")
      .insert({ task_id: taskId, project_id: projectId, message, user_id: currentUserId })
      .select("*, profiles!task_comments_user_id_fkey(username, full_name, avatar_url)")
      .single();
    if (!error && data) {
      setComments((prev) => [...prev, data as unknown as TaskComment]);
      setDraft("");
      setLoaded(true);
      onCountChange(taskId, 1);
    } else if (error) {
      console.error("addComment failed:", error);
    }
    setSending(false);
  }

  return (
    <div className="mt-1">
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-2xs text-inkFaint hover:text-teal transition-colors"
      >
        <ChevronDown size={11} strokeWidth={2} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        <MessageCircle size={11} strokeWidth={2} />
        {count > 0 ? `${count} ${count === 1 ? t("comments.one") : t("comments.many")}` : t("comments.one")}
      </button>

      {open && (
        <div className="mt-1.5 border-s-2 border-line ps-3 space-y-2 fade-in">
          {loading ? (
            <p className="text-2xs text-inkFaint">{t("common.loading")}</p>
          ) : comments.length === 0 ? (
            <p className="text-2xs text-inkFaint">{t("comments.empty")}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-1.5 text-2xs">
                <Avatar name={displayName(c.user_id, c.profiles, currentUserId, t("common.you"))} src={c.profiles?.avatar_url} size="xs" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <ClickableName userId={c.user_id} className="text-inkSoft">
                    {displayName(c.user_id, c.profiles, currentUserId, t("common.you"))}
                  </ClickableName>{" "}
                  <span className="opacity-70">— {timeAgo(c.created_at, t)}</span>
                  <p className="text-inkFaint mt-0.5 break-words leading-relaxed">{c.message}</p>
                </div>
              </div>
            ))
          )}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
              placeholder={t("comments.addPlaceholder")}
              className="text-2xs py-1.5"
            />
            <IconButton
              size="sm"
              tone="active"
              aria-label={t("comments.send")}
              onClick={addComment}
              disabled={sending || !draft.trim()}
            >
              <Send size={12} strokeWidth={2} />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}
