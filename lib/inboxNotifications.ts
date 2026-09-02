"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, ActivityEntry } from "./supabase";
import { ideaPath, projectPath } from "./appRoutes";

export type InboxKind = "activity" | "idea" | "login";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  createdAt: string;
  href: string;
  actorId: string | null;
  actorName: string | null;
  message: string;
  action?: string | null;
  actionParams?: Record<string, string | number | boolean | null> | null;
  projectName?: string;
  ideaTitle?: string;
};

const READS_KEY = (userId: string) => `viora-notif-reads:${userId}`;
const LOGIN_KEY = (userId: string) => `viora-notif-logins:${userId}`;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadReadIds(userId: string): Set<string> {
  const list = loadJson<string[]>(READS_KEY(userId), []);
  return new Set(list);
}

export function persistReadIds(userId: string, ids: Set<string>) {
  saveJson(READS_KEY(userId), Array.from(ids).slice(-400));
}

export function recordLoginNotification(userId: string, at: string) {
  const existing = loadJson<InboxItem[]>(LOGIN_KEY(userId), []);
  const last = existing[0];
  if (last && Date.now() - new Date(last.createdAt).getTime() < 12 * 60 * 60 * 1000) return;
  const id = `login:${at}`;
  if (existing.some((item) => item.id === id)) return;
  const item: InboxItem = {
    id,
    kind: "login",
    createdAt: at,
    href: "/dashboard",
    actorId: userId,
    actorName: null,
    message: "",
    action: "login",
  };
  saveJson(LOGIN_KEY(userId), [item, ...existing].slice(0, 20));
}

function loadLoginNotifications(userId: string): InboxItem[] {
  return loadJson<InboxItem[]>(LOGIN_KEY(userId), []);
}

async function projectIdsForUser(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    supabase.from("projects").select("id").eq("user_id", userId),
    supabase.from("project_members").select("project_id").eq("user_id", userId).eq("status", "accepted"),
  ]);
  const ids = new Set<string>();
  for (const row of owned.data || []) ids.add(row.id);
  for (const row of member.data || []) ids.add(row.project_id);
  return Array.from(ids);
}

export async function fetchInboxItems(userId: string): Promise<InboxItem[]> {
  const projectIds = await projectIdsForUser(userId);
  const items: InboxItem[] = [...loadLoginNotifications(userId)];

  if (projectIds.length > 0) {
    const [{ data: logs }, { data: projects }] = await Promise.all([
      supabase
        .from("activity_log")
        .select("id, project_id, task_id, actor_id, actor_name, message, action, action_params, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("projects").select("id, name").in("id", projectIds),
    ]);
    const names = new Map((projects || []).map((p) => [p.id, p.name as string]));

    for (const row of logs || []) {
      const entry = row as ActivityEntry & { task_id?: string | null };
      items.push({
        id: `activity:${entry.id}`,
        kind: "activity",
        createdAt: entry.created_at,
        href: entry.task_id ? `${projectPath(entry.project_id)}?task=${entry.task_id}` : projectPath(entry.project_id),
        actorId: entry.actor_id,
        actorName: entry.actor_name,
        message: entry.message,
        action: entry.action,
        actionParams: entry.action_params || null,
        projectName: names.get(entry.project_id),
      });
    }
  }

  const { data: myIdeas } = await supabase.from("ideas").select("id, title").eq("user_id", userId);
  const ideaTitles = new Map((myIdeas || []).map((idea) => [idea.id as string, idea.title as string]));
  const ideaIds = Array.from(ideaTitles.keys());
  if (ideaIds.length > 0) {
    const { data: ideaRows } = await supabase
      .from("idea_activity")
      .select("id, idea_id, user_id, action, created_at")
      .in("idea_id", ideaIds)
      .order("created_at", { ascending: false })
      .limit(40);

    for (const row of ideaRows || []) {
      items.push({
        id: `idea:${row.id}`,
        kind: "idea",
        createdAt: row.created_at,
        href: ideaPath(row.idea_id),
        actorId: row.user_id,
        actorName: null,
        message: "",
        action: row.action,
        ideaTitle: ideaTitles.get(row.idea_id),
      });
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, 60);
}

export function useInboxNotifications(userId: string) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await fetchInboxItems(userId);
    setItems(next);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setReadIds(loadReadIds(userId));
    void refresh();
  }, [userId, refresh]);

  useEffect(() => {
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "idea_activity" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).length,
    [items, readIds]
  );

  const markRead = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      persistReadIds(userId, next);
      return next;
    });
  }, [userId]);

  function isUnread(id: string) {
    return !readIds.has(id);
  }

  return { items, loading, unreadCount, markRead, isUnread, refresh };
}
