"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckSquare,
  Clock,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  Repeat,
  Tag,
  User,
} from "lucide-react";
import { BoardColumn, Project, ProjectMember, TASK_COLORS } from "@/lib/supabase";
import { displayName } from "@/lib/displayName";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import { Input, Textarea } from "./ui/Input";

export type NewTaskDraft = {
  title: string;
  projectId: string;
  columnId: string | null;
  color: string | null;
  dueDate: string | null;
  assigneeId: string;
  createAnother: boolean;
  extras: {
    description: string;
    tags: string;
    estimate: string;
    recurrence: string;
    subtasks: string[];
  };
};

const selectClass =
  "w-full rounded-[1.75rem] border-0 bg-surfaceSunken px-4 py-2.5 text-sm text-ink outline-none shadow-none focus:outline-none focus:ring-0";

const chipSelectClass =
  "h-8 rounded-full border-0 bg-surfaceSunken px-3 text-xs text-ink outline-none focus:outline-none focus:ring-0";

export default function AddTaskModal({
  mode,
  columns,
  projects,
  members,
  currentUserId,
  defaultProjectId,
  defaultColumnId,
  creating,
  onClose,
  onExpand,
  onCollapse,
  onCreate,
}: {
  mode: "quick" | "full";
  columns: BoardColumn[];
  projects: Project[];
  members: ProjectMember[];
  currentUserId: string;
  defaultProjectId: string;
  defaultColumnId: string | null;
  creating: boolean;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onCreate: (draft: NewTaskDraft) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [columnId, setColumnId] = useState(defaultColumnId ?? columns[0]?.id ?? "");
  const [color, setColor] = useState<string>(TASK_COLORS[2]?.value ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [estimate, setEstimate] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [createAnother, setCreateAnother] = useState(false);

  useEffect(() => {
    setColumnId(defaultColumnId ?? columns[0]?.id ?? "");
    setProjectId(defaultProjectId);
  }, [defaultColumnId, defaultProjectId, columns]);

  function resetTitleOnly() {
    setTitle("");
    setDescription("");
    setSubtasks([]);
    setSubtaskDraft("");
  }

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onCreate({
      title: trimmed,
      projectId,
      columnId: columnId || null,
      color: color || null,
      dueDate: dueDate || null,
      assigneeId,
      createAnother,
      extras: { description, tags, estimate, recurrence, subtasks },
    });
    if (createAnother) resetTitleOnly();
  }

  function addSubtask() {
    const value = subtaskDraft.trim();
    if (!value) return;
    setSubtasks((prev) => [...prev, value]);
    setSubtaskDraft("");
  }

  const selectedColumn = columns.find((c) => c.id === columnId);

  return (
    <Modal
      onClose={onClose}
      title={t("board.addTaskTitle")}
      titleAlign="center"
      maxWidth={mode === "full" ? "max-w-2xl" : "max-w-md"}
    >
      <div className="space-y-4">
        {mode === "quick" ? (
          <>
            <div className="relative">
              <Textarea
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                  if (e.key === "Escape") onClose();
                }}
                placeholder={t("board.taskNamePlaceholder")}
                className="pe-10"
              />
              <button
                type="button"
                onClick={onExpand}
                className="absolute end-2 top-2.5 h-7 w-7 inline-flex items-center justify-center rounded-full text-inkFaint hover:text-ink hover:bg-paperDark"
                aria-label={t("board.expandForm")}
              >
                <Maximize2 size={14} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={chipSelectClass}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={chipSelectClass}>
                <option value="">{t("board.noAssignee")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.user_id}>
                    {displayName(member.user_id, member.profiles, currentUserId, t("common.you"))}
                  </option>
                ))}
              </select>
              <label className="h-8 inline-flex items-center gap-1.5 rounded-full border-0 bg-surfaceSunken px-3 text-inkFaint">
                <Calendar size={13} />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent text-xs text-ink outline-none"
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={onCollapse}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-inkFaint hover:text-ink hover:bg-paperDark"
                aria-label={t("board.collapseForm")}
              >
                <Minimize2 size={14} />
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("board.taskName")}</span>
              <Textarea
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("board.taskNamePlaceholder")}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-inkSoft">{t("board.taskDescription")}</span>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("board.taskDescriptionPlaceholder")}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldProject")}</span>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClass}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldStatus")}</span>
                <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={selectClass}>
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldPriority")}</span>
                <select value={color} onChange={(e) => setColor(e.target.value)} className={selectClass}>
                  <option value="">{t("tasks.noColor")}</option>
                  {TASK_COLORS.map((item) => (
                    <option key={item.name} value={item.value}>
                      {t(`taskColor.${item.name}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldAssignee")}</span>
                <div className="relative">
                  <User size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className={`${selectClass} ps-9`}
                  >
                    <option value="">{t("board.noAssignee")}</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.user_id}>
                        {displayName(member.user_id, member.profiles, currentUserId, t("common.you"))}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.dueDate")}</span>
                <div className="relative">
                  <Calendar size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${selectClass} ps-9`} />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldTags")}</span>
                <div className="relative">
                  <Tag size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("board.tagsPlaceholder")} className="ps-9" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldEstimate")}</span>
                <div className="relative">
                  <Clock size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
                  <Input value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder={t("board.estimatePlaceholder")} className="ps-9" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldRecurrence")}</span>
                <div className="relative">
                  <Repeat size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkFaint" />
                  <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={`${selectClass} ps-9`}>
                    <option value="none">{t("board.repeatNone")}</option>
                    <option value="daily">{t("board.repeatDaily")}</option>
                    <option value="weekly">{t("board.repeatWeekly")}</option>
                    <option value="monthly">{t("board.repeatMonthly")}</option>
                  </select>
                </div>
              </label>
              <div className="block">
                <span className="mb-1.5 block text-xs text-inkSoft">{t("board.fieldAttachments")}</span>
                <button
                  type="button"
                  className="h-[42px] w-full inline-flex items-center justify-center gap-1.5 rounded-[1.75rem] border border-dashed border-line text-xs text-inkSoft hover:border-[#8C3AED] hover:text-ink"
                >
                  <Paperclip size={14} />
                  {t("board.addFile")}
                </button>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs text-inkSoft">{t("board.subtasks")}</span>
              <div className="space-y-1.5">
                {subtasks.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-center gap-2 text-sm text-ink">
                    <CheckSquare size={14} className="text-inkFaint" />
                    {item}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                    placeholder={t("board.addSubtask")}
                  />
                  <Button type="button" onClick={addSubtask}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedColumn && mode === "quick" && (
          <p className="sr-only">{selectedColumn.name}</p>
        )}

        <div className={`flex items-center ${mode === "full" ? "justify-between" : "justify-end"} gap-2 pt-1`}>
          {mode === "full" && (
            <label className="inline-flex items-center gap-2 text-xs text-inkSoft">
              <input
                type="checkbox"
                checked={createAnother}
                onChange={(e) => setCreateAnother(e.target.checked)}
                className="accent-[#8C3AED]"
              />
              {t("board.createAnother")}
            </label>
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" loading={creating} disabled={!title.trim()} onClick={() => void submit()}>
              {mode === "full" ? t("board.saveTask") : t("tasks.add")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
