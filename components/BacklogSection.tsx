"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ListTodo, Paperclip, Plus, Trash2 } from "lucide-react";
import { supabase, type BoardColumn, type Project, type ProjectMember } from "@/lib/supabase";
import {
  addBacklogItem,
  deleteBacklogItem,
  loadBacklog,
  updateBacklogItem,
  type BacklogItem,
} from "@/lib/backlog";
import { ensureTodoColumn } from "@/lib/boardColumns";
import { writeTaskMeta } from "@/lib/taskExtras";
import { copyRemoteFilesToTask } from "@/lib/taskAttachments";
import { normalizeProjectMember } from "@/lib/taskShape";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import AddTaskModal, { type NewTaskDraft } from "./AddTaskModal";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";

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
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
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

  async function loadResources(projectId: string) {
    if (!projectId) {
      setColumns([]);
      setMembers([]);
      return;
    }
    const [{ data: cols }, { data: mems }] = await Promise.all([
      supabase.from("board_columns").select("*").eq("project_id", projectId).order("position"),
      supabase
        .from("project_members")
        .select(
          "id, project_id, user_id, status, invited_by, created_at, profiles!project_members_user_id_fkey(username, full_name, avatar_url)"
        )
        .eq("project_id", projectId)
        .eq("status", "accepted"),
    ]);
    setColumns((cols as BoardColumn[]) || []);
    setMembers((mems || []).map(normalizeProjectMember));
  }

  async function saveDraft(draft: NewTaskDraft) {
    setCreating(true);
    addBacklogItem({
      userId: currentUserId,
      title: draft.title,
      description: draft.extras.description,
      projectId: draft.projectId || null,
      columnId: draft.columnId,
      color: draft.color,
      dueDate: draft.dueDate,
      assigneeId: draft.assigneeId,
      tags: draft.extras.tags,
      estimate: draft.extras.estimate,
      recurrence: draft.extras.recurrence,
      subtasks: draft.extras.subtasks,
      attachments: draft.attachments,
    });
    setCreating(false);
    setOpen(false);
    refresh();
  }

  async function sendToProject(item: BacklogItem) {
    const target = item.projectId;
    if (!target) return;
    setSending(item.id);
    const column = item.columnId
      ? (await supabase.from("board_columns").select("id").eq("id", item.columnId).maybeSingle()).data
      : await ensureTodoColumn(target);
    const fallback = column?.id ? column : await ensureTodoColumn(target);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: item.title,
        project_id: target,
        column_id: fallback?.id ?? null,
        position: 1000,
        is_done: false,
        color: item.color,
        due_date: item.dueDate,
        ...(item.assigneeId ? { user_id: item.assigneeId } : { user_id: currentUserId }),
      })
      .select("id")
      .single();
    if (error || !data) {
      setSending(null);
      return;
    }
    writeTaskMeta(data.id, {
      description: item.description,
      tags: item.tags,
      estimate: item.estimate,
      recurrence: item.recurrence,
      subtasks: item.subtasks,
    });
    if (item.attachments.length) {
      await copyRemoteFilesToTask(data.id, target, currentUserId, item.attachments);
    }
    deleteBacklogItem(item.id);
    setSending(null);
    refresh();
    onOpenProject(target);
  }

  return (
    <div className="fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{t("backlog.title")}</h1>
          <p className="mt-1 text-sm text-inkSoft">{t("backlog.subtitle")}</p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={15} />
          {t("backlog.add")}
        </Button>
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
                    {item.attachments.length > 0 && (
                      <span className="ms-2 inline-flex items-center gap-1">
                        <Paperclip size={11} />
                        {item.attachments.length}
                      </span>
                    )}
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

      {open && (
        <AddTaskModal
          mode="full"
          heading={t("backlog.add")}
          columns={columns}
          projects={projects}
          members={members}
          currentUserId={currentUserId}
          defaultProjectId=""
          defaultColumnId={columns[0]?.id ?? null}
          creating={creating}
          allowEmptyProject
          hideCreateAnother
          onClose={() => setOpen(false)}
          onExpand={() => undefined}
          onCollapse={() => undefined}
          onProjectChange={(id) => void loadResources(id)}
          onCreate={saveDraft}
        />
      )}
    </div>
  );
}
