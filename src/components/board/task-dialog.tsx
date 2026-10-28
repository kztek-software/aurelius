"use client";

import { useEffect, useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import Link from "next/link";
import {
  Trash2,
  CheckSquare,
  Square,
  History,
  MessageSquare,
  AlertTriangle,
  Layers,
  Plus,
  Loader2,
  Check,
  LifeBuoy,
  ExternalLink,
  Link2,
  MoreHorizontal,
  UserPlus,
  ChevronRight,
  Pencil,
  Eye,
  FileText,
  X,
} from "lucide-react";
import { STATUSES, PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { TaskAttachmentGallery } from "./task-attachment-gallery";
import { MentionCommentInput, RenderCommentContent } from "./mention-comment-input";
import { RichMarkdown } from "@/components/ui/rich-markdown";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import type {
  TaskDto,
  MemberDto,
  LabelDto,
  SprintDto,
  CommentDto,
  ActivityDto,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { AssigneeQuickSelect } from "./assignee-quick-select";
import { PriorityIcon } from "./priority-icon";
import { TypeIcon } from "./type-icon";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function TaskDialog({
  projectId,
  projectName,
  taskId,
  tasks,
  members,
  labels,
  sprints,
  onClose,
  onChanged,
}: {
  projectId: string;
  projectName?: string;
  taskId: string;
  tasks: TaskDto[];
  members: MemberDto[];
  labels: LabelDto[];
  sprints: SprintDto[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const task = tasks.find((t) => t.id === taskId);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [activity, setActivity] = useState<ActivityDto[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [saving, setSaving] = useState(false);

  // Local Form State for explicit Save
  const [title, setTitle] = useState(task?.title ?? "");
  const [descriptionValue, setDescriptionValue] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "TODO");
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assigneeId ?? null);
  const [type, setType] = useState(task?.type ?? "TASK");
  const [dueDate, setDueDate] = useState<string | null>(
    task?.dueDate ? task.dueDate.slice(0, 10) : null
  );
  const [storyPoints, setStoryPoints] = useState<string | number>(
    task?.storyPoints !== null && task?.storyPoints !== undefined ? String(task.storyPoints) : ""
  );
  const [sprintId, setSprintId] = useState<string | null>(task?.sprintId ?? null);
  const [labelIds, setLabelIds] = useState<string[]>(
    task?.labels ? task.labels.map((tl) => tl.label.id) : []
  );

  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Sync state whenever task prop updates or dialog opens with a task.
  // Điều chỉnh state ngay trong lúc render (thay vì useEffect) để form không
  // hiển thị dữ liệu của task cũ ở lượt render đầu sau khi prop `task` đổi.
  const [prevTask, setPrevTask] = useState(task);
  if (task !== prevTask) {
    setPrevTask(task);
    if (task) {
      setTitle(task.title);
      setDescriptionValue(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId ?? null);
      setType(task.type);
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : null);
      setStoryPoints(
        task.storyPoints !== null && task.storyPoints !== undefined ? String(task.storyPoints) : ""
      );
      setSprintId(task.sprintId ?? null);
      setLabelIds(task.labels ? task.labels.map((tl) => tl.label.id) : []);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setComments(data.comments ?? []);
          setActivity(data.activity ?? []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.user) setCurrentUser({ id: data.user.id, name: data.user.name });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!task) return;
    function handleTaskDialogKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "Enter")) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
        return;
      }
      if (e.key === "Escape" && isEditingDescription) {
        e.stopPropagation();
        setIsEditingDescription(false);
        setDescriptionValue(task?.description ?? "");
      }
    }
    window.addEventListener("keydown", handleTaskDialogKeyDown, true);
    return () => window.removeEventListener("keydown", handleTaskDialogKeyDown, true);
  }, [
    isEditingDescription,
    task,
    title,
    descriptionValue,
    status,
    priority,
    assigneeId,
    type,
    dueDate,
    storyPoints,
    sprintId,
    labelIds,
  ]);

  if (!task) return null;

  const currentLabelIdsSorted = [...labelIds].sort().join(",");
  const originalLabelIdsSorted = task.labels ? task.labels.map((tl) => tl.label.id).sort().join(",") : "";
  const originalStoryPoints = task.storyPoints !== null && task.storyPoints !== undefined ? String(task.storyPoints) : "";
  const originalDueDate = task.dueDate ? task.dueDate.slice(0, 10) : "";

  const hasChanges =
    title.trim() !== (task.title || "").trim() ||
    descriptionValue.trim() !== (task.description || "").trim() ||
    status !== task.status ||
    priority !== task.priority ||
    (assigneeId || null) !== (task.assigneeId || null) ||
    type !== task.type ||
    (dueDate || "") !== originalDueDate ||
    String(storyPoints).trim() !== originalStoryPoints ||
    (sprintId || null) !== (task.sprintId || null) ||
    currentLabelIdsSorted !== originalLabelIdsSorted;

  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const subtaskProgress = task.subtasks.length > 0 ? (doneSubtasks / task.subtasks.length) * 100 : 0;
  const statusInfo = STATUSES.find((s) => s.id === status);
  const isOverdue = dueDate && status !== "DONE" && new Date(dueDate) < new Date();

  async function handleSave() {
    if (!title.trim()) {
      alert("Tiêu đề công việc không được để trống");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: descriptionValue.trim() || null,
        status,
        priority,
        assigneeId: assigneeId || null,
        type,
        dueDate: dueDate || null,
        storyPoints: storyPoints === "" ? null : Number(storyPoints),
        sprintId: sprintId || null,
        labelIds,
      };

      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsEditingDescription(false);
        onChanged();
      } else {
        const data = await res.json();
        alert(data.error || "Không thể lưu thay đổi");
      }
    } catch (err) {
      console.error("Lỗi cập nhật task:", err);
      alert("Lỗi kết nối máy chủ");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn task này?")) return;
    onClose();
    onChanged();
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Lỗi xóa task:", err);
    }
  }

  function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("taskId", taskId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    });
  }


  async function handleAddComment(data: { body: string; parentId?: string; mentions?: string[] }) {
    if (!data.body.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const resData = await res.json();
      setComments((prev) => [...prev, resData.comment]);
      onChanged();
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    const subtaskTitle = newSubtask.trim();
    setNewSubtask("");
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: subtaskTitle }),
    });
    if (res.ok) {
      onChanged();
    }
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !done }),
      });
      onChanged();
    } catch (err) {
      console.error("Lỗi cập nhật subtask:", err);
    }
  }

  return (
    <Dialog
      visible={true}
      onHide={onClose}
      closable={true}
      className="w-[96vw] max-w-5xl p-0 overflow-hidden border border-line bg-surface shadow-2xl rounded-2xl flex flex-col h-[90vh] max-h-[90vh]"
      contentClassName="p-0 overflow-hidden flex flex-col h-full bg-surface"
      header={null}
      showHeader={false}
    >
      <div className="w-full h-full flex flex-col overflow-hidden bg-surface">
        <div className="shrink-0 border-b border-line bg-surface-2/70">
          <div className="flex items-center gap-1.5 px-3.5 sm:px-4 pt-2 text-[10.5px] font-semibold text-muted">
            {projectName && (
              <>
                <span className="truncate max-w-[120px]">{projectName}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
              </>
            )}
            <span className="text-foreground">{statusInfo?.label ?? status}</span>
          </div>

          <div className="flex items-start justify-between gap-2.5 px-3.5 sm:px-4 py-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 flex items-center gap-1.5 font-bold font-mono text-accent bg-accent/15 px-2 py-0.5 rounded-md border border-accent/30 text-xs">
                <TypeIcon type={type} />#{task.number}
              </span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-w-0 flex-1 text-sm sm:text-base font-bold bg-transparent border-transparent hover:border-line focus:border-accent px-2 py-0.5 h-auto text-foreground"
                placeholder="Tiêu đề công việc..."
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-bold transition-all cursor-pointer gap-2 rounded-xl shadow-md ${
                  hasChanges
                    ? "bg-accent hover:bg-accent/90 text-white shadow-accent/25 ring-2 ring-accent/30"
                    : "bg-surface-2 text-muted border border-line opacity-60 cursor-not-allowed shadow-none"
                }`}
                title={hasChanges ? "Lưu thay đổi công việc (Ctrl+S)" : "Chưa có thay đổi mới"}
              >
                {saving ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin mr-0.5" />
                ) : (
                  <Check className="h-4.5 w-4.5 mr-0.5" />
                )}
                <span>{saving ? "Đang lưu..." : "Lưu thay đổi"}</span>
                {hasChanges && (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/20 text-white rounded">
                    Ctrl+S
                  </kbd>
                )}
              </Button>
              <button
                onClick={copyLink}
                title="Sao chép liên kết task (Alt+L)"
                className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-foreground hover:border-line-strong transition-colors cursor-pointer"
              >
                {linkCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    title="Thêm thao tác"
                    className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-foreground hover:border-line-strong transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={copyLink}>
                    <Link2 className="h-3.5 w-3.5" /> Sao chép liên kết (Alt+L)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onClick={deleteTask}>
                    <Trash2 className="h-3.5 w-3.5" /> Xóa công việc
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={onClose}
                title="Đóng (Esc)"
                className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl border border-line bg-surface hover:bg-surface-2 flex items-center justify-center text-muted hover:text-foreground hover:border-line-strong transition-colors cursor-pointer ml-0.5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 px-3.5 sm:px-4 pb-2">
            <Dropdown
              value={status}
              options={STATUSES.map((s) => ({ label: s.label, value: s.id, color: s.color }))}
              onChange={(e) => setStatus(e.value)}
              className="p-dropdown-pill p-dropdown-status shadow-sm"
              style={{ backgroundColor: statusInfo?.color || "#6B7280" }}
              valueTemplate={(opt) => {
                const s = STATUSES.find((x) => x.id === (opt?.value || status));
                return (
                  <span className="font-bold text-white tracking-wide">
                    {s?.label || opt?.label || "Trạng thái"}
                  </span>
                );
              }}
              itemTemplate={(opt) => (
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                  <span>{opt.label}</span>
                </div>
              )}
            />

            <Dropdown
              value={priority}
              options={PRIORITIES.map((p) => ({ label: p.label, value: p.id, color: p.color }))}
              onChange={(e) => setPriority(e.value)}
              panelClassName="border border-line bg-surface rounded-xl shadow-2xl p-1 text-xs min-w-[180px]"
              className="p-dropdown-pill bg-surface border border-line"
              valueTemplate={(opt) => {
                const p = PRIORITIES.find((x) => x.id === (opt?.value || priority));
                return (
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <PriorityIcon priority={opt?.value || priority} />
                    <span>{p?.label || opt?.label}</span>
                  </div>
                );
              }}
              itemTemplate={(opt) => {
                const isSelected = priority === opt.value;
                return (
                  <div className="flex items-center justify-between gap-2 text-xs py-1 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <PriorityIcon priority={opt.value} />
                      <span className={`font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                  </div>
                );
              }}
            />

            <AssigneeQuickSelect
              variant="field"
              className="h-7 sm:h-7.5 max-w-[190px] bg-surface rounded-full px-2.5 text-xs font-semibold shadow-2xs"
              currentAssigneeId={assigneeId}
              members={members}
              onAssign={(_, userId) => setAssigneeId(userId)}
            />

            <Dropdown
              value={type}
              options={TASK_TYPES.map((t) => ({ label: t.label, value: t.id }))}
              onChange={(e) => setType(e.value)}
              className="p-dropdown-pill bg-surface border border-line"
              valueTemplate={(opt) => {
                const t = TASK_TYPES.find((x) => x.id === (opt?.value || type));
                return (
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <TypeIcon type={t?.id || type} />
                    <span>{t?.label || opt?.label}</span>
                  </div>
                );
              }}
              itemTemplate={(opt) => (
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <TypeIcon type={opt.value} />
                  <span>{opt.label}</span>
                </div>
              )}
            />

            {title.startsWith("[TK-") && (
              <span className="text-[10px] font-mono font-bold text-accent bg-accent/15 border border-accent/30 rounded-full px-2 py-0.5">
                Ticket KH
              </span>
            )}
          </div>
        </div>

        {/* ============ Body: Responsive 2 Columns (Compact, No Outer Scrollbar) ============ */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_370px] divide-y lg:divide-y-0 lg:divide-x divide-line overflow-hidden">
          {/* Left Column: Description, Subtasks, Attachments, Comments Feed */}
          <div className="flex flex-col min-w-0 h-full overflow-hidden bg-surface">
            <div className="flex-1 min-h-0 p-3 sm:p-3.5 flex flex-col gap-2.5 overflow-y-auto no-scrollbar">
              {/* Customer Ticket Origin Banner */}
              {(title.startsWith("[TK-") || descriptionValue.includes("🎫 Nguồn: Báo lỗi từ khách hàng")) && (
                <div className="shrink-0 p-2 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-between gap-2 text-xs text-accent">
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="font-semibold text-foreground text-[11.5px]">
                      Công việc này được tạo từ <strong>Ticket Báo lỗi Khách hàng</strong>
                    </span>
                  </div>
                  <Link
                    href={`/projects/${projectId}/tickets`}
                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1 shrink-0"
                  >
                    <span>Mở Hộp Thư Ticket</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* 1. Description Section */}
              <div className="shrink-0 space-y-1 rounded-xl border border-line bg-surface p-2.5 sm:p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <Label className="text-[11.5px] font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-accent" />
                    Mô tả chi tiết
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsEditingDescription(!isEditingDescription)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                  >
                    {isEditingDescription ? (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Xem trước</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3 w-3" />
                        <span>Chỉnh sửa</span>
                      </>
                    )}
                  </button>
                </div>

                {isEditingDescription ? (
                  <div className="space-y-1.5 animate-fade-in-up">
                    <WysiwygEditor
                      value={descriptionValue}
                      onChange={setDescriptionValue}
                      placeholder="Thêm mô tả..."
                      minHeight="90px"
                      autoFocus
                      borderless={true}
                      onSave={() => setIsEditingDescription(false)}
                      onCancel={() => {
                        setDescriptionValue(task.description ?? "");
                        setIsEditingDescription(false);
                      }}
                    />
                    <div className="flex items-center justify-end pt-1">
                      <Button
                        type="button"
                        onClick={() => setIsEditingDescription(false)}
                        className="h-9 px-4 text-xs sm:text-sm font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/20 cursor-pointer gap-1.5 rounded-xl"
                      >
                        <Check className="h-4.5 w-4.5 mr-0.5" />
                        <span>Xong</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDescription(true)}
                    className="p-2 rounded-md bg-surface-2 border border-line hover:border-line-strong transition-all max-h-[100px] overflow-y-auto no-scrollbar cursor-pointer group relative text-xs"
                  >
                    {descriptionValue?.trim() ? (
                      <RichMarkdown content={descriptionValue} members={members} />
                    ) : (
                      <p className="text-xs text-muted italic">Chưa có mô tả chi tiết. Nhấp vào đây để thêm nội dung...</p>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Danh sách việc con (Checklist) */}
              <div className="shrink-0 space-y-1.5 rounded-xl border border-line bg-surface p-2.5 sm:p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <Label className="text-[11.5px] font-bold text-foreground flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5 text-accent" />
                    Danh sách việc con (Checklist)
                  </Label>
                  <span className="text-[11px] font-bold text-muted font-mono">
                    {doneSubtasks}/{task.subtasks.length}
                  </span>
                </div>
                {task.subtasks.length > 0 && (
                  <div className="h-1 w-full rounded-full bg-surface-2 overflow-hidden border border-line">
                    <div
                      className={`h-full transition-all duration-300 ${subtaskProgress === 100 ? "bg-emerald-500" : "bg-accent"}`}
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                )}
                {task.subtasks.length > 0 && (
                  <div className="max-h-[85px] overflow-y-auto no-scrollbar space-y-0.5">
                    {task.subtasks.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleSubtask(s.id, s.done)}
                        className="flex w-full items-center gap-2 rounded px-2 py-0.5 text-left text-xs hover:bg-surface transition-colors cursor-pointer group"
                      >
                        {s.done ? (
                          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <Square className="h-3.5 w-3.5 shrink-0 text-muted group-hover:text-foreground" />
                        )}
                        <span className={`min-w-0 flex-1 truncate ${s.done ? "text-muted line-through" : "text-foreground font-medium"}`}>
                          {s.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={addSubtask} className="flex gap-1.5 pt-0.5">
                  <Input
                    placeholder="Thêm mục việc con mới..."
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    className="h-7.5 text-xs bg-surface rounded-lg"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="h-7.5 text-xs font-semibold px-2.5 rounded-lg">
                    <Plus className="h-3.5 w-3.5 mr-0.5" /> Thêm
                  </Button>
                </form>
              </div>

              {/* 3. Tệp, Ảnh & Video Quay Lỗi */}
              <div className="shrink-0">
                <TaskAttachmentGallery
                  projectId={projectId}
                  taskId={taskId}
                  attachments={task.attachments || []}
                  onAttachmentChanged={onChanged}
                />
              </div>

              {/* 4. Danh sách Bình luận & Lịch sử hoạt động (Cột Trái) */}
              <div className="flex-1 min-h-[120px] flex flex-col space-y-1.5 pt-1.5 border-t border-line/60 overflow-hidden">
                <div className="shrink-0 flex gap-1.5 border-b border-line pb-1">
                  <button
                    onClick={() => setTab("comments")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      tab === "comments" ? "bg-surface-2 text-accent shadow-sm" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Bình luận ({comments.length})
                  </button>
                  <button
                    onClick={() => setTab("activity")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      tab === "activity" ? "bg-surface-2 text-accent shadow-sm" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <History className="h-3.5 w-3.5" /> Lịch sử hoạt động
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pr-0.5">
                  {tab === "comments" ? (
                    <>
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <Avatar className="h-6 w-6 shrink-0 border border-white/10 mt-0.5">
                            <AvatarFallback color={c.author.avatarColor} className="text-[8.5px] font-bold">
                              {initials(c.author.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 rounded-lg bg-surface-2/50 p-2 border border-line">
                            <div className="mb-0.5 flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">{c.author.name}</span>
                              <span className="text-[10px] text-muted">{formatDistanceToNow(new Date(c.createdAt), { locale: vi, addSuffix: true })}</span>
                            </div>
                            <RenderCommentContent body={c.body} members={members} />
                          </div>
                        </div>
                      ))}
                      {comments.length === 0 && (
                        <p className="text-xs text-muted py-2 text-center">Chưa có bình luận nào</p>
                      )}
                    </>
                  ) : (
                    <>
                      {activity.map((a) => {
                        const actorName = a.actor?.name || a.user?.name || "Thành viên";
                        const avatarColor = a.actor?.avatarColor || a.user?.avatarColor;
                        const detailText = a.detail || a.content || a.action || "đã cập nhật công việc";
                        return (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-3 text-xs text-muted hover:bg-surface-2/40 px-1 py-0.5 rounded transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Avatar className="h-5 w-5 shrink-0 border border-white/10">
                                <AvatarFallback color={avatarColor} className="text-[8px] font-bold">
                                  {initials(actorName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1 truncate">
                                <span className="font-semibold text-foreground">{actorName}</span>{" "}
                                <span className="text-muted">{detailText}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted/80 shrink-0 text-right font-medium">
                              {formatDistanceToNow(new Date(a.createdAt), { locale: vi, addSuffix: true })}
                            </span>
                          </div>
                        );
                      })}
                      {activity.length === 0 && (
                        <p className="text-xs text-muted py-2 text-center">Chưa có lịch sử hoạt động</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Properties & Comment Composer (Compact) */}
          <div className="h-full flex flex-col min-w-0 overflow-hidden bg-surface-2/30">
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 sm:p-3.5 space-y-2.5">
              {!assigneeId && currentUser && (
                <button
                  type="button"
                  onClick={() => setAssigneeId(currentUser.id)}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-line-strong bg-accent-subtle text-accent text-xs font-bold hover:bg-accent/20 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Giao việc này cho tôi
                </button>
              )}

              {/* Thông số & Thời hạn */}
              <div className="rounded-lg border border-line bg-surface p-2.5 space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Thông số &amp; Thời hạn</div>
                <div className="space-y-0.5">
                  <Label className="text-[10.5px] font-semibold text-muted flex items-center justify-between">
                    <span>Hạn chót hoàn thành</span>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent">
                        <AlertTriangle className="h-3 w-3" /> Quá hạn
                      </span>
                    )}
                  </Label>
                  <Input
                    type="date"
                    value={dueDate ?? ""}
                    className={`h-7.5 text-xs bg-surface-2 px-2.5 w-full ${isOverdue ? "text-accent font-bold border-accent/40" : ""}`}
                    onChange={(e) => setDueDate(e.target.value || null)}
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10.5px] font-semibold text-muted">Điểm ước lượng (Story points)</Label>
                  <Input
                    type="number"
                    value={storyPoints}
                    className="h-7.5 text-xs bg-surface-2 font-mono px-2.5 w-full"
                    placeholder="Chưa ước lượng (—)"
                    onChange={(e) => setStoryPoints(e.target.value)}
                  />
                </div>
              </div>

              {/* Sprint */}
              <div className="rounded-lg border border-line bg-surface p-2.5 space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Layers className="h-3 w-3" /> Kế hoạch Sprint
                </div>
                <Dropdown
                  value={sprintId ?? "none"}
                  options={[
                    { label: "Không thuộc sprint (Backlog)", value: "none", isBacklog: true },
                    ...sprints.map((s) => ({
                      label: s.name,
                      value: s.id,
                      statusText: s.status === "ACTIVE" ? "Đang chạy" : s.status === "COMPLETED" ? "Đã xong" : "Kế hoạch",
                    })),
                  ]}
                  onChange={(e) => setSprintId(e.value === "none" ? null : e.value)}
                  panelClassName="border border-line bg-surface rounded-xl shadow-2xl p-1 text-xs min-w-[240px]"
                  className="h-7.5 w-full text-xs bg-surface-2 border border-line rounded-lg"
                  valueTemplate={(opt) => {
                    const s = sprints.find((x) => x.id === (opt?.value || sprintId));
                    if (!s || (opt?.value === "none" || sprintId === "none" || !sprintId)) {
                      return (
                        <div className="flex items-center gap-1.5 font-normal text-muted truncate">
                          <Layers className="h-3 w-3 text-muted shrink-0" />
                          <span className="truncate">Không thuộc sprint (Backlog)</span>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                        <span className="text-xs">🚀</span>
                        <span className="truncate">{s.name}</span>
                      </div>
                    );
                  }}
                  itemTemplate={(opt) => {
                    const isSelected = (sprintId || "none") === opt.value;
                    if (opt.isBacklog) {
                      return (
                        <div className="flex items-center justify-between gap-2 text-xs py-1 px-1 text-muted">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Layers className="h-3 w-3 text-muted shrink-0" />
                            <span>Không thuộc sprint (Backlog)</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center justify-between gap-2 text-xs py-1 px-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs">🚀</span>
                          <div className="min-w-0">
                            <span className={`font-semibold block truncate ${isSelected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
                            <span className="text-[10px] text-muted">{opt.statusText}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0 ml-1" />}
                      </div>
                    );
                  }}
                />
              </div>

              {/* Nhãn phân loại */}
              <div className="rounded-lg border border-line bg-surface p-2.5 space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Nhãn phân loại</div>
                <div className="flex flex-wrap gap-1">
                  {labels.map((l) => {
                    const isSelected = labelIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLabelIds((prev) => isSelected ? prev.filter((id) => id !== l.id) : [...prev, l.id])}
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                        style={{ backgroundColor: isSelected ? l.color : `${l.color}15`, color: isSelected ? "#fff" : l.color, border: `1px solid ${l.color}40` }}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                        {l.name}
                      </button>
                    );
                  })}
                  {labels.length === 0 && (
                    <span className="text-[11px] text-muted">Dự án chưa có nhãn nào</span>
                  )}
                </div>
              </div>

              {/* Ô soạn thảo bình luận (Cột Phải) */}
              <div className="rounded-lg border border-line bg-surface p-2.5 space-y-1 shadow-sm">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-accent" /> Viết bình luận trao đổi
                </div>
                <MentionCommentInput
                  members={members}
                  onSubmit={handleAddComment}
                  placeholder="Viết bình luận... Gõ '@' để gắn thẻ"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
