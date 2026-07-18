"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, LinkItem } from "@/lib/supabase";
import ItemHistory from "./ItemHistory";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import { Input, Textarea } from "./ui/Input";
import EmptyState from "./ui/EmptyState";
import { SkeletonCards } from "./ui/Skeleton";
import { timeAgo } from "@/lib/timeAgo";
import { Link2, Plus, Search, X, Pencil, Check } from "lucide-react";

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// خدمة Google للفافيكون بتفشل أو بترجع أيقونة عامة رمادية لمواقع زي تيك توك،
// فبنستخدم لوجوهات البراند الرسمية من Simple Icons لأشهر منصات السوشيال ميديا
// عشان تظهر بنفس جودة أيقونتي انستجرام وفيسبوك
const BRAND_ICONS: Record<string, string> = {
  "tiktok.com": "https://cdn.simpleicons.org/tiktok/000000",
  "instagram.com": "https://cdn.simpleicons.org/instagram/E4405F",
  "facebook.com": "https://cdn.simpleicons.org/facebook/1877F2",
  "x.com": "https://cdn.simpleicons.org/x/000000",
  "twitter.com": "https://cdn.simpleicons.org/x/000000",
  "youtube.com": "https://cdn.simpleicons.org/youtube/FF0000",
  "linkedin.com": "https://cdn.simpleicons.org/linkedin/0A66C2",
  "pinterest.com": "https://cdn.simpleicons.org/pinterest/E60023",
  "snapchat.com": "https://cdn.simpleicons.org/snapchat/FFFC00",
  "whatsapp.com": "https://cdn.simpleicons.org/whatsapp/25D366",
  "telegram.org": "https://cdn.simpleicons.org/telegram/26A5E4",
  "t.me": "https://cdn.simpleicons.org/telegram/26A5E4",
  "github.com": "https://cdn.simpleicons.org/github/181717",
  "reddit.com": "https://cdn.simpleicons.org/reddit/FF4500",
};

function faviconFor(url: string) {
  const domain = getDomain(url);
  const matchedKey = Object.keys(BRAND_ICONS).find(
    (key) => domain === key || domain.endsWith(`.${key}`)
  );
  if (matchedKey) return BRAND_ICONS[matchedKey];
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export default function LinksSection() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [query, setQuery] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [linkDescDraft, setLinkDescDraft] = useState("");

  useEffect(() => {
    loadLinks();
  }, []);

  async function loadLinks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setLinks(data as LinkItem[]);
    setLoading(false);
  }

  async function addLink() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    try {
      new URL(normalizedUrl);
    } catch {
      setError("الرابط غير صحيح");
      return;
    }
    setError("");

    const { data, error: insertError } = await supabase
      .from("links")
      .insert({ url: normalizedUrl, description: description.trim() })
      .select()
      .single();

    if (!insertError && data) {
      setLinks((prev) => [data as LinkItem, ...prev]);
      setUrl("");
      setDescription("");
      setShowComposer(false);
    }
  }

  async function deleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("links").delete().eq("id", id);
  }

  async function toggleLinkDone(link: LinkItem) {
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, is_done: !l.is_done } : l))
    );
    const { error } = await supabase
      .from("links")
      .update({ is_done: !link.is_done })
      .eq("id", link.id);
    if (error) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, is_done: link.is_done } : l))
      );
    }
  }

  function startEditLink(link: LinkItem) {
    setLinkDescDraft(link.description || "");
    setEditingLinkId(link.id);
  }

  async function saveLinkDescription(link: LinkItem) {
    const description = linkDescDraft.trim();
    if (description === link.description) {
      setEditingLinkId(null);
      return;
    }
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, description } : l)));
    setEditingLinkId(null);
    const { error } = await supabase.from("links").update({ description }).eq("id", link.id);
    if (error) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, description: link.description } : l))
      );
    }
  }

  // فلترة محلية بسيطة على الروابط المحمّلة بالفعل — بدون أي طلب إضافي للسيرفر
  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) => l.url.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q)
    );
  }, [links, query]);

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} strokeWidth={2} className="absolute right-3 top-1/2 -translate-y-1/2 text-inkFaint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الروابط المحفوظة"
            className="pr-8 text-sm"
          />
        </div>
        <Button
          variant={showComposer ? "secondary" : "primary"}
          size="sm"
          onClick={() => setShowComposer((s) => !s)}
        >
          {showComposer ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
          {showComposer ? "إلغاء" : "رابط جديد"}
        </Button>
      </div>

      {showComposer && (
        <div className="border border-line rounded-lg p-3.5 mb-6 bg-surface fade-in">
          <div className="flex flex-col gap-2 mb-2.5">
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addLink()}
              placeholder="الصق الرابط هنا"
              dir="ltr"
              className="font-mono text-left"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أضف وصفًا موجزًا — لماذا حفظت هذا الرابط؟"
              rows={2}
            />
          </div>
          {error && <p className="text-clay text-xs mb-2">{error}</p>}
          <Button variant="primary" size="sm" onClick={addLink}>
            <Plus size={14} strokeWidth={2} />
            حفظ الرابط
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonCards count={4} />
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="لا توجد روابط محفوظة بعد"
          hint="احفظ أي رابط مفيد هنا مع وصف مختصر ليسهل الرجوع إليه لاحقًا."
          action={
            !showComposer && (
              <Button variant="primary" size="sm" onClick={() => setShowComposer(true)}>
                <Plus size={14} strokeWidth={2} />
                أضف أول رابط
              </Button>
            )
          }
        />
      ) : filteredLinks.length === 0 ? (
        <EmptyState icon={Search} title="لا نتائج مطابقة" hint={`لا يوجد رابط يطابق "${query}"`} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredLinks.map((link) => (
            <li
              key={link.id}
              className="group relative border border-line rounded-lg p-4 bg-surface hover:border-lineStrong hover:shadow-xs transition-all"
            >
              {editingLinkId !== link.id && (
                <div className="absolute left-2.5 top-2.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <IconButton
                    size="sm"
                    aria-label="تعديل ليبل الرابط"
                    onClick={() => startEditLink(link)}
                  >
                    <Pencil size={12} strokeWidth={1.75} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    tone="danger"
                    aria-label="حذف الرابط"
                    onClick={() => deleteLink(link.id)}
                  >
                    <X size={13} strokeWidth={1.75} />
                  </IconButton>
                </div>
              )}

              <div className="flex items-start gap-2.5 pl-14">
                <input
                  type="checkbox"
                  className="task-check mt-0.5 shrink-0"
                  checked={link.is_done}
                  onChange={() => toggleLinkDone(link)}
                  aria-label="تحديد الرابط كمنجز"
                />

                {editingLinkId === link.id ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={faviconFor(link.url)}
                        alt=""
                        width={16}
                        height={16}
                        className="h-4 w-4 rounded-sm shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                      <p dir="ltr" className="text-teal font-mono text-sm truncate text-left">
                        {getDomain(link.url)}
                      </p>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Textarea
                        autoFocus
                        value={linkDescDraft}
                        onChange={(e) => setLinkDescDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveLinkDescription(link);
                          }
                        }}
                        placeholder="أضف وصفًا موجزًا"
                        rows={2}
                        className="text-sm"
                      />
                      <IconButton
                        size="sm"
                        tone="active"
                        aria-label="حفظ الوصف"
                        onClick={() => saveLinkDescription(link)}
                      >
                        <Check size={13} strokeWidth={2} />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 min-w-0 flex-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={faviconFor(link.url)}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-sm mt-0.5 shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        dir="ltr"
                        className={`font-mono text-sm truncate text-left ${
                          link.is_done ? "text-inkFaint line-through" : "text-teal group-hover:text-tealDark"
                        }`}
                      >
                        {getDomain(link.url)}
                      </p>
                      {link.description ? (
                        <p
                          className={`text-sm mt-1 leading-relaxed line-clamp-2 ${
                            link.is_done ? "text-inkFaint line-through" : "text-inkSoft"
                          }`}
                        >
                          {link.description}
                        </p>
                      ) : (
                        <p className="text-sm text-inkFaint mt-1 italic">بلا وصف</p>
                      )}
                    </div>
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-line/70">
                <span className="text-2xs text-inkFaint font-mono tabular-nums">{timeAgo(link.created_at)}</span>
                <ItemHistory table="link_activity_log" column="link_id" id={link.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
