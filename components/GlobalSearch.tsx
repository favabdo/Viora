"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Lightbulb, ListTodo, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ideaPath, projectPath } from "@/lib/appRoutes";
import { loadBacklog } from "@/lib/backlog";
import { loadIdeas } from "@/lib/ideas";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Hit = {
  id: string;
  kind: "project" | "task" | "idea" | "backlog";
  title: string;
  hint?: string;
  href: string;
};

export default function GlobalSearch({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    function onPointer(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!open) return;
    if (q.length < 1) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      const [owned, member, ideas, backlog] = await Promise.all([
        supabase.from("projects").select("id, name").eq("user_id", userId),
        supabase.from("project_members").select("project_id, projects(id, name)").eq("user_id", userId).eq("status", "accepted"),
        loadIdeas(),
        Promise.resolve(loadBacklog(userId)),
      ]);
      const projects = new Map<string, string>();
      for (const row of owned.data || []) projects.set(row.id, row.name);
      for (const row of member.data || []) {
        const nested = row.projects as { id?: string; name?: string } | { id?: string; name?: string }[] | null;
        const proj = Array.isArray(nested) ? nested[0] : nested;
        if (proj?.id) projects.set(proj.id, proj.name || "");
      }
      const projectIds = Array.from(projects.keys());
      const tasksRes =
        projectIds.length > 0
          ? await supabase.from("tasks").select("id, title, project_id").in("project_id", projectIds).limit(80)
          : { data: [] as { id: string; title: string; project_id: string }[] };

      const next: Hit[] = [];
      for (const [id, name] of projects) {
        if (name.toLowerCase().includes(q)) {
          next.push({ id: `p:${id}`, kind: "project", title: name, hint: t("search.kind.project"), href: projectPath(id) });
        }
      }
      for (const task of tasksRes.data || []) {
        if (!task.title.toLowerCase().includes(q)) continue;
        next.push({
          id: `t:${task.id}`,
          kind: "task",
          title: task.title,
          hint: projects.get(task.project_id) || t("search.kind.task"),
          href: `${projectPath(task.project_id)}?task=${task.id}`,
        });
      }
      for (const idea of ideas) {
        if (idea.userId !== userId) continue;
        const hay = `${idea.title} ${idea.description}`.toLowerCase();
        if (!hay.includes(q)) continue;
        next.push({ id: `i:${idea.id}`, kind: "idea", title: idea.title, hint: t("search.kind.idea"), href: ideaPath(idea.id) });
      }
      for (const item of backlog) {
        const hay = `${item.title} ${item.description}`.toLowerCase();
        if (!hay.includes(q)) continue;
        next.push({ id: `b:${item.id}`, kind: "backlog", title: item.title, hint: t("search.kind.backlog"), href: "/backlog" });
      }
      if (!cancelled) {
        setHits(next.slice(0, 24));
        setActive(0);
        setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, t, userId]);

  const grouped = useMemo(() => hits, [hits]);

  function iconFor(kind: Hit["kind"]) {
    if (kind === "project") return FolderKanban;
    if (kind === "idea") return Lightbulb;
    return ListTodo;
  }

  return (
    <div className="relative flex-1 max-w-xl mx-auto w-full" ref={boxRef}>
      <Search size={15} strokeWidth={1.75} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-inkFaint pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={open ? query : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("shell.search")}
        className="w-full bg-surfaceSunken border-0 rounded-[1.75rem] ps-10 pe-14 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none focus:outline-none focus:ring-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(grouped.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && grouped[active]) {
            e.preventDefault();
            go(grouped[active].href);
          }
        }}
      />
      <span className="absolute top-1/2 -translate-y-1/2 end-3 text-[11px] text-inkFaint border border-line rounded-md px-1.5 py-0.5 pointer-events-none">
        {isMac ? "⌘K" : "Ctrl+K"}
      </span>
      {open && (query.trim() || loading) && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-line bg-surface shadow-modal overflow-hidden">
          {loading ? (
            <p className="px-3.5 py-4 text-sm text-inkFaint">{t("inbox.loading")}</p>
          ) : grouped.length === 0 ? (
            <p className="px-3.5 py-4 text-sm text-inkFaint">{t("search.empty")}</p>
          ) : (
            <ul className="max-h-[min(70vh,360px)] overflow-y-auto thin-scroll py-1">
              {grouped.map((hit, i) => {
                const Icon = iconFor(hit.kind);
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit.href)}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-start ${
                        i === active ? "bg-paperDark" : ""
                      }`}
                    >
                      <Icon size={15} className="text-[#6C5CE7] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink truncate">{hit.title}</span>
                        {hit.hint && <span className="block text-[11px] text-inkFaint truncate">{hit.hint}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
