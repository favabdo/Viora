"use client";

import { useEffect, useState } from "react";
import { supabase, LinkItem } from "@/lib/supabase";

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
      setError("اللينك مش صحيح");
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
      <div className="bg-white border border-line rounded p-4 mb-6 shadow-card">
        <div className="flex flex-col gap-2 mb-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="الصق اللينك هنا"
            dir="ltr"
            className="bg-paper border border-line rounded px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-teal text-left"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="اكتب وصف قصير — ليه سيّبت اللينك ده؟"
            rows={2}
            className="bg-paper border border-line rounded px-3 py-2.5 text-sm focus:outline-none focus:border-teal resize-none"
          />
        </div>
        {error && <p className="text-clay text-xs mb-2">{error}</p>}
        <button
          onClick={addLink}
          className="bg-ink text-paper px-4 py-2.5 rounded text-sm hover:bg-tealDark transition-colors"
        >
          حفظ اللينك
        </button>
      </div>

      {loading ? (
        <p className="text-inkSoft text-sm">بتحمّل...</p>
      ) : links.length === 0 ? (
        <p className="text-inkSoft text-sm">مفيش لينكات محفوظة لسه.</p>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => (
            <li
              key={link.id}
              className="group bg-white border border-line rounded px-4 py-3 shadow-card"
            >
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
                <button
                  onClick={() => deleteLink(link.id)}
                  className="opacity-0 group-hover:opacity-100 text-inkSoft hover:text-clay shrink-0 transition-opacity"
                  aria-label="حذف اللينك"
                >
                  ×
                </button>
              </div>
              {link.description && (
                <p className="text-sm text-ink mt-1.5 leading-relaxed">{link.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
