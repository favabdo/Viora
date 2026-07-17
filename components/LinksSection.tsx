"use client";

import { useEffect, useState } from "react";
import { supabase, LinkItem } from "@/lib/supabase";
import ItemHistory from "./ItemHistory";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import { Input, Textarea } from "./ui/Input";
import EmptyState from "./ui/EmptyState";
import { SkeletonList } from "./ui/Skeleton";
import { Link2, Plus, X } from "lucide-react";

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function LinksSection() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    }
  }

  async function deleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("links").delete().eq("id", id);
  }

  return (
    <div className="max-w-2xl fade-in">
      <div className="border border-line rounded-lg p-3.5 mb-6">
        <div className="flex flex-col gap-2 mb-2.5">
          <Input
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
        <Button variant="primary" onClick={addLink}>
          <Plus size={15} strokeWidth={2} />
          حفظ الرابط
        </Button>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="لا توجد روابط محفوظة بعد"
          hint="الصق أي رابط في الحقل أعلاه واحفظه."
        />
      ) : (
        <ul className="border-t border-b border-line divide-y divide-line">
          {links.map((link) => (
            <li key={link.id} className="group px-1 py-3">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="text-teal hover:text-tealDark font-mono text-sm break-all text-left"
                >
                  {getDomain(link.url)}
                </a>
                <IconButton
                  size="sm"
                  tone="danger"
                  aria-label="حذف الرابط"
                  onClick={() => deleteLink(link.id)}
                  className="opacity-0 group-hover:opacity-100 shrink-0"
                >
                  <X size={14} strokeWidth={1.75} />
                </IconButton>
              </div>
              {link.description && (
                <p className="text-sm text-inkSoft mt-1 leading-relaxed">{link.description}</p>
              )}
              <ItemHistory table="link_activity_log" column="link_id" id={link.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
