"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ListTodo, Plus, Trash2 } from "lucide-react";
import { supabase, type Project } from "@/lib/supabase";
import {
  addBacklogItem,
  deleteBacklogItem,
  loadBacklog,
  updateBacklogItem,
  type BacklogItem,
} from "@/lib/backlog";
import { ensureTodoColumn } from "@/lib/boardColumns";
import { patchTaskExtras } from "@/lib/taskExtras";
import { projectPath } from "@/lib/appRoutes";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import { Textarea } from "./ui/Input";

export default function BacklogSection({
  currentUserId,
  onOpenProject,
}: {
  currentUserId: string;
  onOpenProject: (projectId: string) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  function refresh() {
    setItems(loadBacklog(currentUserId));
  }

  useEffect(() => {
    refresh();
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects((data as Project[]) || []));
  }, [currentUserId]);

  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  function addItem() {
    if (!title.trim()) return;
    addBacklogItem({
      userId: currentUserId,
      title,
      description,
      projectId: projectId || null,
    });
    setTitle("");
    setDescription("");
    refresh();
  }

  async function sendToProject(item: BacklogItem) {
    const target = item.projectId;
    if (!target) return;
    setSending(item.id);
    const column = await ensureTodoColumn(target);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: item.title,
        project_id: target,
        column_id: column?.id ?? null,
        position: 1000,
        is_done: false,
        user_id: currentUserId,
      })
      .select("id")
      .single();
    setSending(null);
    if (error || !data) return;
    if (item.description) patchTaskExtras(data.id, { description: item.description });
    deleteBacklogItem(item.id);
    refresh();
    onOpenProject(target);
  }

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("backlog.title")}</h1>
        <p className="mt-1 text-sm text-inkSoft">{t("backlog.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 mb-5 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem();
          }}
          placeholder={t("backlog.titlePlaceholder")}
          className="w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink placeholder:text-inkFaint outline-none"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("backlog.descPlaceholder")}
          className="min-h-[4.5rem] text-sm"
        />
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="flex-1 rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none"
          >
            <option value="">{t("backlog.pickProject")}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <Button variant="primary" onClick={addItem} disabled={!title.trim()}>
            <Plus size={15} />
            {t("backlog.add")}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={ListTodo} title={t("backlog.empty")} hint={t("backlog.emptyHint")} />
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.title}</p>
                  {item.description && <p className="mt-1 text-sm text-inkSoft whitespace-pre-wrap">{item.description}</p>}
                  <p className="mt-2 text-[11px] text-inkFaint">
                    {item.projectId ? names.get(item.projectId) || t("backlog.linked") : t("backlog.unlinked")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deleteBacklogItem(item.id);
                    refresh();
                  }}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-inkFaint hover:text-clay hover:bg-paperDark"
                  aria-label={t("common.delete")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                <select
                  value={item.projectId || ""}
                  onChange={(e) => {
                    updateBacklogItem(item.id, { projectId: e.target.value || null });
                    refresh();
                  }}
                  className="flex-1 rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2 text-sm text-ink outline-none"
                >
                  <option value="">{t("backlog.pickProject")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  onClick={() => void sendToProject(item)}
                  disabled={!item.projectId || sending === item.id}
                >
                  <ArrowUpRight size={15} />
                  {sending === item.id ? t("common.loading") : t("backlog.send")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
