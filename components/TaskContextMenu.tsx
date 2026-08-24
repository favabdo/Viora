"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive,
  CheckSquare,
  ChevronRight,
  Copy,
  Eye,
  Link2,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
  UserPlus,
  User,
} from "lucide-react";
import { BoardColumn, ProjectMember, Task } from "@/lib/supabase";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";

export type TaskMenuState = {
  task: Task;
  x: number;
  y: number;
};

type Submenu = "assign" | "move" | null;

export default function TaskContextMenu({
  menu,
  members,
  columns,
  currentUserId,
  pinned,
  watching,
  archived,
  onClose,
  onEdit,
  onAssign,
  onInvite,
  onMove,
  onDuplicate,
  onAddSubtask,
  onAddComment,
  onAttach,
  onCopyLink,
  onTogglePin,
  onToggleWatch,
  onToggleArchive,
  onDelete,
}: {
  menu: TaskMenuState;
  members: ProjectMember[];
  columns: BoardColumn[];
  currentUserId: string;
  pinned: boolean;
  watching: boolean;
  archived: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAssign: (userId: string) => void;
  onInvite: () => void;
  onMove: (columnId: string) => void;
  onDuplicate: () => void;
  onAddSubtask: () => void;
  onAddComment: () => void;
  onAttach: () => void;
  onCopyLink: () => void;
  onTogglePin: () => void;
  onToggleWatch: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const name = displayName(member.user_id, member.profiles, currentUserId, t("common.you")).toLowerCase();
      const username = (member.profiles?.username || "").toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [members, memberQuery, currentUserId, t]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 12;
    setPos({
      left: Math.min(menu.x, window.innerWidth - rect.width - pad),
      top: Math.min(menu.y, window.innerHeight - rect.height - pad),
    });
  }, [menu.x, menu.y, submenu]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const itemClass =
    "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-ink rounded-lg hover:bg-paperDark text-start";
  const iconWrap = "h-4 w-4 shrink-0 text-inkSoft";

  return createPortal(
    <div
      ref={rootRef}
      className="fixed z-[80]"
      style={{ left: Math.max(8, pos.left), top: Math.max(8, pos.top) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-[220px] rounded-2xl border border-line bg-paper shadow-modal p-1.5">
        <button type="button" className={itemClass} onClick={onEdit}>
          <Pencil size={15} className={iconWrap} />
          {t("board.menu.edit")}
        </button>
        <div className="relative" onMouseEnter={() => setSubmenu("assign")}>
          <button
            type="button"
            className={`${itemClass} ${submenu === "assign" ? "bg-paperDark" : ""}`}
            onClick={() => setSubmenu((v) => (v === "assign" ? null : "assign"))}
          >
            <User size={15} className={iconWrap} />
            <span className="flex-1">{t("board.menu.assignTo")}</span>
            <ChevronRight size={14} className="text-inkFaint rtl:rotate-180" />
          </button>
          {submenu === "assign" && (
            <div className="absolute top-0 start-full ms-1.5 w-[230px] rounded-2xl border border-line bg-paper shadow-modal p-2 z-10">
              <div className="relative mb-1.5">
                <Search size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-inkFaint" />
                <input
                  autoFocus
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder={t("board.menu.searchMembers")}
                  className="w-full rounded-lg border-0 bg-surfaceSunken ps-8 pe-2 py-1.5 text-xs text-ink placeholder:text-inkFaint outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto thin-scroll">
                {filteredMembers.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-inkFaint">{t("board.menu.noMembers")}</p>
                ) : (
                  filteredMembers.map((member) => {
                    const name = displayName(member.user_id, member.profiles, currentUserId, t("common.you"));
                    const selected = menu.task.user_id === member.user_id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => onAssign(member.user_id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-start text-[13px] ${
                          selected ? "bg-paperDark text-ink" : "text-ink hover:bg-paperDark"
                        }`}
                      >
                        <Avatar name={name} src={member.profiles?.avatar_url} size="xs" />
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={onInvite}
                className="mt-1 w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[13px] text-[#8C3AED] hover:bg-[#8C3AED]/10"
              >
                <UserPlus size={15} />
                {t("board.menu.invitePeople")}
              </button>
            </div>
          )}
        </div>
        <div className="relative" onMouseEnter={() => setSubmenu("move")}>
          <button
            type="button"
            className={`${itemClass} ${submenu === "move" ? "bg-paperDark" : ""}`}
            onClick={() => setSubmenu((v) => (v === "move" ? null : "move"))}
          >
            <CheckSquare size={15} className={iconWrap} />
            <span className="flex-1">{t("board.menu.moveTo")}</span>
            <ChevronRight size={14} className="text-inkFaint rtl:rotate-180" />
          </button>
          {submenu === "move" && (
            <div className="absolute top-0 start-full ms-1.5 w-[200px] rounded-2xl border border-line bg-paper shadow-modal p-1.5 z-10">
              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => onMove(column.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-start hover:bg-paperDark ${
                    menu.task.column_id === column.id ? "bg-paperDark" : ""
                  }`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                  {column.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="my-1 h-px bg-line" />

        <button type="button" className={itemClass} onClick={onDuplicate}>
          <Copy size={15} className={iconWrap} />
          {t("board.menu.duplicate")}
        </button>
        <button type="button" className={itemClass} onClick={onAddSubtask}>
          <Plus size={15} className={iconWrap} />
          {t("board.menu.addSubtask")}
        </button>
        <button type="button" className={itemClass} onClick={onAddComment}>
          <MessageCircle size={15} className={iconWrap} />
          {t("board.menu.addComment")}
        </button>
        <button type="button" className={itemClass} onClick={onAttach}>
          <Paperclip size={15} className={iconWrap} />
          {t("board.menu.attachFile")}
        </button>

        <div className="my-1 h-px bg-line" />

        <button type="button" className={itemClass} onClick={onCopyLink}>
          <Link2 size={15} className={iconWrap} />
          {t("board.menu.copyLink")}
        </button>
        <button type="button" className={itemClass} onClick={onTogglePin}>
          <Pin size={15} className={iconWrap} />
          {pinned ? t("board.menu.unpin") : t("board.menu.pin")}
        </button>
        <button type="button" className={itemClass} onClick={onToggleWatch}>
          <Eye size={15} className={iconWrap} />
          {watching ? t("board.menu.unwatch") : t("board.menu.watch")}
        </button>

        <div className="my-1 h-px bg-line" />

        <button type="button" className={itemClass} onClick={onToggleArchive}>
          {archived ? <CheckSquare size={15} className={iconWrap} /> : <Archive size={15} className={iconWrap} />}
          {archived ? t("board.menu.unarchive") : t("board.menu.archive")}
        </button>
        <button type="button" className={`${itemClass} text-rose-500 hover:bg-rose-500/10`} onClick={onDelete}>
          <Trash2 size={15} className="h-4 w-4 shrink-0" />
          {t("board.menu.delete")}
        </button>
      </div>
    </div>,
    document.body
  );
}
