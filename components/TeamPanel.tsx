"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Info, Link2, Search } from "lucide-react";
import { supabase, ProjectMember } from "@/lib/supabase";
import { normalizeProjectMember } from "@/lib/taskShape";
import { resolveName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Avatar from "./ui/Avatar";
import Button from "./ui/Button";
import ClickableName from "./ClickableName";
import Modal from "./ui/Modal";
import { Input } from "./ui/Input";

export type AccessRole = "viewer" | "commenter" | "editor" | "admin";

type ProfileHit = {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
};

type Tab = "people" | "link";
type ExpireOption = "never" | "24h" | "7d" | "30d";

const ROLES: AccessRole[] = ["viewer", "commenter", "editor", "admin"];
const ROLES_KEY = "viora-member-roles";

function readRoles(projectId: string): Record<string, AccessRole> {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, AccessRole>>) : {};
    return all[projectId] || {};
  } catch {
    return {};
  }
}

function writeRoles(projectId: string, roles: Record<string, AccessRole>) {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, AccessRole>>) : {};
    all[projectId] = roles;
    localStorage.setItem(ROLES_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function expiresAtFrom(option: ExpireOption): string | null {
  if (option === "never") return null;
  const ms = option === "24h" ? 24 : option === "7d" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() + ms * 60 * 60 * 1000).toISOString();
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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

export default function TeamPanel({
  projectId,
  projectName,
  currentUserId,
  ownerId,
  onClose,
}: {
  projectId: string;
  projectName?: string;
  currentUserId: string;
  ownerId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("people");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Record<string, AccessRole>>({});
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<ProfileHit | null>(null);
  const [inviteRole, setInviteRole] = useState<AccessRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [linkEnabled, setLinkEnabled] = useState(true);
  const [inviteUrl, setInviteUrl] = useState("");
  const [linkRole, setLinkRole] = useState<AccessRole>("viewer");
  const [expireOption, setExpireOption] = useState<ExpireOption>("never");
  const [limitUses, setLimitUses] = useState(false);
  const [maxUses, setMaxUses] = useState(10);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState("");
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    setRoles(readRoles(projectId));
    loadMembers();
    prepareInviteLink(true);
  }, [projectId]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function loadMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_members")
      .select(
        "id, project_id, user_id, status, invited_by, created_at, profiles!project_members_user_id_fkey(username, full_name, avatar_url, email)"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (!error && data) setMembers(data.map(normalizeProjectMember));
    setLoading(false);
  }

  async function searchPeople(value: string) {
    const q = value.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase.rpc("search_profiles_for_invite", { p_query: q });
    if (!error && Array.isArray(data)) {
      setHits(data as ProfileHit[]);
      setSearching(false);
      return;
    }
    const { data: fallback } = await supabase
      .from("profiles")
      .select("id, username, full_name, email, avatar_url")
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8);
    setHits((fallback as ProfileHit[]) || []);
    setSearching(false);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setInviteError("");
    if (picked) setPicked(null);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void searchPeople(value);
    }, 220);
  }

  async function sendInvite(target: ProfileHit, role: AccessRole) {
    setInviting(true);
    setInviteError("");
    const byId = await supabase.rpc("invite_user_to_project", {
      p_project_id: projectId,
      p_user_id: target.id,
    });
    let error = byId.error;
    if (error) {
      const byName = await supabase.rpc("invite_user_by_username", {
        p_project_id: projectId,
        p_username: target.username,
      });
      error = byName.error;
    }
    setInviting(false);
    if (error) {
      setInviteError(error.message || t("team.err.generic"));
      return;
    }
    const next = { ...roles, [target.id]: role };
    setRoles(next);
    writeRoles(projectId, next);
    showToast(t("share.inviteSentTo").replace("{name}", resolveName(target, target.username)));
    setQuery("");
    setHits([]);
    setPicked(null);
    loadMembers();
  }

  async function inviteFromQuery() {
    if (picked) {
      await sendInvite(picked, inviteRole);
      return;
    }
    const username = query.trim().replace(/^@/, "").toLowerCase();
    if (!username) return;
    const hit = hits.find((item) => item.username === username) || {
      id: "",
      username,
      full_name: username,
      email: null,
      avatar_url: null,
    };
    if (hit.id) {
      await sendInvite(hit, inviteRole);
      return;
    }
    setInviting(true);
    const { error } = await supabase.rpc("invite_user_by_username", {
      p_project_id: projectId,
      p_username: username,
    });
    setInviting(false);
    if (error) {
      setInviteError(error.message || t("team.err.generic"));
      return;
    }
    showToast(t("team.inviteSent").replace("{username}", username));
    setQuery("");
    setHits([]);
    loadMembers();
  }

  async function prepareInviteLink(enabled: boolean): Promise<string> {
    setLinkError("");
    if (!enabled) {
      await supabase.rpc("set_invite_link_enabled", {
        p_project_id: projectId,
        p_enabled: false,
      });
      setInviteUrl("");
      setLinkEnabled(false);
      return "";
    }
    const toggled = await supabase.rpc("set_invite_link_enabled", {
      p_project_id: projectId,
      p_enabled: true,
    });
    let token = toggled.data as string | null;
    if (toggled.error || !token) {
      const created = await supabase.rpc("get_or_create_invite_link", { p_project_id: projectId });
      if (created.error || !created.data) {
        setLinkError(t("team.err.linkFailed"));
        return "";
      }
      token = created.data as string;
    }
    const url = `${window.location.origin}/join/${token}`;
    setInviteUrl(url);
    setLinkEnabled(true);
    return url;
  }

  async function persistLinkSettings(nextRole = linkRole, nextExpire = expireOption, nextLimit = limitUses, nextMax = maxUses) {
    await supabase.rpc("update_invite_link_settings", {
      p_project_id: projectId,
      p_access_role: nextRole,
      p_expires_at: expiresAtFrom(nextExpire),
      p_max_uses: nextLimit ? nextMax : null,
    });
  }

  async function copyLink() {
    const url = inviteUrl || (await prepareInviteLink(true));
    if (!url) return;
    setCopying(true);
    const ok = await copyText(url);
    setCopying(false);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setLinkError(url);
    }
  }

  function setMemberRole(userId: string, role: AccessRole) {
    const next = { ...roles, [userId]: role };
    setRoles(next);
    writeRoles(projectId, next);
  }

  const memberIds = useMemo(() => new Set(members.filter((m) => m.status === "accepted").map((m) => m.user_id)), [members]);
  const accepted = members.filter((m) => m.status === "accepted");
  const pending = members.filter((m) => m.status === "pending");
  const visibleHits = hits.filter((hit) => hit.id !== currentUserId && !memberIds.has(hit.id));

  const roleLabel = (role: AccessRole) => t(`share.role.${role}`);
  const roleHint = (role: AccessRole) => t(`share.roleHint.${role}`);

  return (
    <Modal onClose={onClose} title={t("share.title")} maxWidth="max-w-lg">
      <div className="flex rounded-xl bg-surfaceSunken p-1 mb-5">
        {(["people", "link"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === id ? "bg-paper text-ink shadow-xs" : "text-inkFaint hover:text-ink"
            }`}
          >
            {id === "people" ? t("share.tabPeople") : t("share.tabLink")}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <div className="space-y-5">
          <div className="relative">
            <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-inkFaint" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void inviteFromQuery();
                }
              }}
              placeholder={t("share.searchPlaceholder")}
              className="ps-10"
            />
            {query.trim() && !picked && (
              <div className="absolute z-20 inset-x-0 top-full mt-1 rounded-xl border border-line bg-paper shadow-modal overflow-hidden">
                {searching ? (
                  <p className="px-3 py-2.5 text-xs text-inkFaint">{t("common.loading")}</p>
                ) : visibleHits.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => void inviteFromQuery()}
                    className="w-full text-start px-3 py-2.5 text-sm text-ink hover:bg-paperDark"
                  >
                    {t("share.inviteByQuery").replace("{q}", query.trim())}
                  </button>
                ) : (
                  visibleHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => {
                        setPicked(hit);
                        setQuery(resolveName(hit, hit.username));
                        setHits([]);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-start hover:bg-paperDark"
                    >
                      <Avatar name={resolveName(hit, hit.username)} src={hit.avatar_url} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-sm text-ink truncate">{resolveName(hit, hit.username)}</span>
                        <span className="block text-[11px] text-inkFaint truncate" dir="ltr">
                          {hit.email || `@${hit.username}`}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {picked && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surfaceSunken p-3">
              <Avatar name={resolveName(picked, picked.username)} src={picked.avatar_url} size="sm" />
              <span className="flex-1 min-w-0 text-sm text-ink truncate">{resolveName(picked, picked.username)}</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AccessRole)}
                className="rounded-lg border-0 bg-paper px-2 py-1.5 text-xs text-ink outline-none"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" loading={inviting} onClick={() => void sendInvite(picked, inviteRole)}>
                {t("team.invite")}
              </Button>
            </div>
          )}

          {inviteError && <p className="text-clay text-xs">{inviteError}</p>}

          <div>
            <h4 className="text-xs font-semibold text-inkSoft mb-2">{t("share.currentAccess")}</h4>
            {loading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton h-11 rounded-lg" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {accepted.map((m) => {
                  const isOwner = m.user_id === ownerId;
                  const role = isOwner ? "admin" : roles[m.user_id] || "editor";
                  return (
                    <li key={m.id} className="flex items-center gap-2.5 py-1.5">
                      <Avatar name={resolveName(m.profiles, t("common.user"))} src={m.profiles?.avatar_url} size="sm" />
                      <span className="flex-1 min-w-0">
                        <ClickableName userId={m.user_id} className="text-sm text-ink block truncate">
                          {resolveName(m.profiles, t("common.user"))}
                          {m.user_id === currentUserId ? ` (${t("team.you")})` : ""}
                        </ClickableName>
                      </span>
                      {isOwner ? (
                        <span className="text-xs text-inkSoft px-2">{roleLabel("admin")}</span>
                      ) : (
                        <select
                          value={role}
                          onChange={(e) => setMemberRole(m.user_id, e.target.value as AccessRole)}
                          className="rounded-lg border-0 bg-surfaceSunken px-2 py-1.5 text-xs text-ink outline-none"
                        >
                          {ROLES.map((item) => (
                            <option key={item} value={item}>
                              {roleLabel(item)}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {pending.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-inkSoft mb-2">{t("share.pendingInvitations")}</h4>
              <ul className="space-y-1">
                {pending.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5 py-1.5">
                    <Avatar name={resolveName(m.profiles, t("common.user"))} src={m.profiles?.avatar_url} size="sm" />
                    <span className="flex-1 min-w-0 text-sm text-ink truncate">
                      {resolveName(m.profiles, m.profiles?.username || t("common.user"))}
                    </span>
                    <span className="text-[11px] font-medium rounded-full bg-amberSoft text-amber px-2 py-0.5">
                      {t("team.pending")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "link" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">{t("share.enableLink")}</p>
              <p className="text-xs text-inkFaint">{t("share.enableLinkHint")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={linkEnabled}
              onClick={() => void prepareInviteLink(!linkEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${linkEnabled ? "bg-[#6C5CE7]" : "bg-lineStrong"}`}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-[inset-inline-start]"
                style={{ insetInlineStart: linkEnabled ? 22 : 2 }}
              />
            </button>
          </div>

          <div className={linkEnabled ? "" : "opacity-50 pointer-events-none"}>
            <label className="block text-xs text-inkSoft mb-1.5">{t("share.projectAccess")}</label>
            <div className="relative mb-3">
              <select
                value={linkRole}
                onChange={(e) => {
                  const role = e.target.value as AccessRole;
                  setLinkRole(role);
                  void persistLinkSettings(role);
                }}
                className="w-full appearance-none rounded-xl border-0 bg-surfaceSunken px-3 py-2.5 text-sm text-ink outline-none pe-8"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)} — {roleHint(role)}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute end-3 top-1/2 -translate-y-1/2 text-inkFaint pointer-events-none" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl bg-surfaceSunken px-3 py-2.5 min-w-0">
                <Link2 size={14} className="text-inkFaint shrink-0" />
                <span className="text-xs text-ink truncate" dir="ltr">
                  {inviteUrl || t("share.linkOff")}
                </span>
              </div>
              <Button variant="primary" loading={copying} onClick={() => void copyLink()} disabled={!inviteUrl}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t("share.copied") : t("share.copy")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs text-inkSoft mb-1.5">{t("share.expires")}</label>
                <select
                  value={expireOption}
                  onChange={(e) => {
                    const next = e.target.value as ExpireOption;
                    setExpireOption(next);
                    void persistLinkSettings(linkRole, next);
                  }}
                  className="w-full rounded-xl border-0 bg-surfaceSunken px-3 py-2.5 text-sm text-ink outline-none"
                >
                  <option value="never">{t("share.expiresNever")}</option>
                  <option value="24h">{t("share.expires24h")}</option>
                  <option value="7d">{t("share.expires7d")}</option>
                  <option value="30d">{t("share.expires30d")}</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs text-inkSoft mb-1.5">
                  <input
                    type="checkbox"
                    checked={limitUses}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setLimitUses(on);
                      void persistLinkSettings(linkRole, expireOption, on, maxUses);
                    }}
                  />
                  {t("share.limitUses")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={maxUses}
                  disabled={!limitUses}
                  onChange={(e) => {
                    const n = Math.max(1, Number(e.target.value) || 1);
                    setMaxUses(n);
                    void persistLinkSettings(linkRole, expireOption, true, n);
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#6C5CE7]/10 px-3 py-2.5 text-xs text-inkSoft leading-relaxed">
              <Info size={14} className="text-[#6C5CE7] mt-0.5 shrink-0" />
              {t("share.linkSummary")
                .replace("{project}", projectName || t("invites.defaultProject"))
                .replace("{role}", roleLabel(linkRole))}
            </div>
          </div>
          {linkError && <p className="text-clay text-xs">{linkError}</p>}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 start-1/2 -translate-x-1/2 z-[90] rounded-full bg-ink text-paper px-4 py-2 text-xs shadow-modal">
          {toast}
        </div>
      )}
    </Modal>
  );
}
