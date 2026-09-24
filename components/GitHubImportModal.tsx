"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Github, Link2Off, Loader2, Lock, Search, Unlink } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { timeAgo } from "@/lib/timeAgo";
import {
  fetchGithubRepos,
  getRepoSlots,
  importRepos,
  listLinkedRepos,
  unlinkRepo,
  type GithubRepoSummary,
  type LinkedRepo,
} from "@/lib/github";

/**
 * نافذة استيراد ريبوزيتوريات GitHub كمشاريع في Viora.
 * في الخطة المجانية الاختيارات بتتحد في المتبقي من حد الـ 3 مشاريع.
 */
export default function GitHubImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}) {
  const { t, lang } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isGithubAccount, setIsGithubAccount] = useState(true);
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
  const [linked, setLinked] = useState<LinkedRepo[]>([]);
  const [slots, setSlots] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const provider = data.session?.user.app_metadata?.provider;
      setIsGithubAccount(provider === "github");
      const [linkedRows, remaining] = await Promise.all([listLinkedRepos(), getRepoSlots()]);
      setLinked(linkedRows);
      setSlots(remaining);
      if (provider !== "github") {
        setRepos([]);
        return;
      }
      const rows = await fetchGithubRepos();
      if (!rows.length) setError(t("github.err.noRepos"));
      setRepos(rows);
    } catch {
      setError(t("github.err.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setQuery("");
    void refresh();
  }, [open, refresh]);

  const linkedIds = useMemo(() => new Set(linked.map((r) => r.repo_id)), [linked]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos
      .filter((r) => !linkedIds.has(r.repo_id))
      .filter((r) => !q || r.full_name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q));
  }, [repos, linkedIds, query]);

  const atLimit = slots !== null && selected.length >= slots;

  function toggle(repo: GithubRepoSummary) {
    setSelected((prev) => {
      if (prev.includes(repo.full_name)) return prev.filter((x) => x !== repo.full_name);
      if (slots !== null && prev.length >= slots) return prev;
      return [...prev, repo.full_name];
    });
  }

  async function startGithubLogin() {
    await supabase.auth.signOut();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "read:user user:email repo",
      },
    });
    if (oauthError) setError(t("github.err.oauth"));
  }

  async function confirmImport() {
    const chosen = repos.filter((r) => selected.includes(r.full_name));
    if (!chosen.length) return;
    setImporting(true);
    const { created, failed } = await importRepos(chosen, slots);
    setImporting(false);
    setSelected([]);
    if (created.length) onImported?.();
    if (failed.length) setError(t("github.err.import").replace("{n}", String(failed.length)));
    if (!failed.length) onClose();
    else await refresh();
  }

  async function removeRepo(repo: LinkedRepo, deleteProject: boolean) {
    const ok = await unlinkRepo(repo, deleteProject);
    if (!ok) {
      setError(t("github.err.unlink"));
      return;
    }
    setLinked((prev) => prev.filter((r) => r.id !== repo.id));
    setSlots((prev) => (prev === null ? null : prev + 1));
    onImported?.();
  }

  if (!open) return null;

  return (
    <Modal onClose={onClose} title={t("github.title")} maxWidth="max-w-lg">
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-ink">{error}</p>}

        {!isGithubAccount ? (
          <div className="space-y-3 rounded-xl border border-line bg-paperDark/40 p-4">
            <p className="text-sm text-ink">{t("github.needGithub")}</p>
            <Button variant="primary" size="sm" onClick={() => void startGithubLogin()}>
              <Github size={14} />
              {t("github.continue")}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-inkSoft">
              {slots === null ? t("github.limitUnlimited") : t("github.limitFree", { n: slots })}
            </p>

            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-inkFaint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("github.search")}
                className="w-full rounded-lg border-0 bg-surfaceSunken ps-9 pe-3 py-2 text-sm text-ink placeholder:text-inkFaint outline-none"
              />
            </div>

            <div className="max-h-[45vh] overflow-y-auto thin-scroll space-y-1.5">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-inkFaint">
                  <Loader2 size={16} className="animate-spin" />
                  {t("github.loading")}
                </div>
              ) : visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-inkFaint">{t("github.empty")}</p>
              ) : (
                visible.map((repo) => {
                  const isSelected = selected.includes(repo.full_name);
                  const blocked = !isSelected && atLimit;
                  return (
                    <button
                      key={repo.repo_id}
                      type="button"
                      disabled={blocked}
                      onClick={() => toggle(repo)}
                      className={`flex w-full items-start gap-3 rounded-lg border p-2.5 text-start transition-colors ${
                        isSelected
                          ? "border-[#2563EB] bg-[#2563EB]/10"
                          : blocked
                            ? "border-line opacity-45"
                            : "border-line hover:border-[#2563EB]/50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-line"
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-ink">{repo.repo_name}</span>
                          {repo.is_private && <Lock size={11} className="shrink-0 text-inkFaint" />}
                        </span>
                        <span className="block truncate text-[11px] text-inkFaint">
                          {repo.owner_login} · {repo.pushed_at ? timeAgo(repo.pushed_at, t) : "—"}
                          {repo.language ? ` · ${repo.language}` : ""}
                        </span>
                        {repo.description && (
                          <span className="mt-0.5 block truncate text-[11px] text-inkSoft">{repo.description}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {linked.length > 0 && (
              <div className="space-y-1.5 border-t border-line pt-3">
                <p className="text-[11px] uppercase tracking-wide text-inkFaint">{t("github.linked")}</p>
                {linked.map((repo) => (
                  <div key={repo.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                    <Link2Off size={13} className="shrink-0 text-inkFaint" />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{repo.full_name}</span>
                    <button
                      type="button"
                      onClick={() => void removeRepo(repo, false)}
                      className="rounded-md px-2 py-1 text-[11px] text-inkSoft hover:text-ink hover:bg-paperDark"
                    >
                      {t("github.unlinkKeep")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeRepo(repo, true)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#dc2626] hover:bg-[#EF4444]/10"
                    >
                      <Unlink size={11} />
                      {t("github.unlinkDelete")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-inkFaint">
            {selected.length > 0 && t("github.selected", { n: selected.length })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={importing}
              disabled={!selected.length || (slots !== null && slots === 0)}
              onClick={() => void confirmImport()}
            >
              {t("github.import")}
            </Button>
            {slots === 0 && (
              <Button variant="secondary" size="sm" onClick={() => router.push("/upgrade")}>
                {t("github.upgrade")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
