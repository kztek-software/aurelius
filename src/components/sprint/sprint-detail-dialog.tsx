"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Rocket,
  Play,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Edit3,
  Plus,
  ArrowUpRight,
  Search,
  Filter,
  CheckSquare,
  Users,
  Flame,
  ArrowRight,
  TrendingUp,
  X,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type { SprintDto, TaskDto, MemberDto, LabelDto } from "@/lib/types";
import { STATUSES, PRIORITIES, TASK_TYPES, statusMeta } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { boardHref } from "@/lib/board-link";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeIcon } from "@/components/board/type-icon";
import { PriorityIcon } from "@/components/board/priority-icon";
import { NewTaskDialog } from "@/components/board/new-task-dialog";
import { RichMarkdown } from "@/components/ui/rich-markdown";
import { RichTextToolbar, handleRichTextKeyDown } from "@/components/ui/rich-text-toolbar";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";

interface SprintDetailDialogProps {
  projectId: string;
  projectName?: string;
  projectKey?: string;
  sprint: SprintDto;
  tasks: TaskDto[];
  members: MemberDto[];
  labels: LabelDto[];
  sprints: SprintDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onSelectTask: (taskId: string) => void;
}

export function SprintDetailDialog({
  projectId,
  projectName = "Dự án",
  projectKey = "TASK",
  sprint,
  tasks,
  members,
  labels,
  sprints,
  open,
  onOpenChange,
  onChanged,
  onSelectTask,
}: SprintDetailDialogProps) {
  const router = useRouter();

  // Sub-dialogs state
  const [editOpen, setEditOpen] = useState(false);
  const [addBacklogOpen, setAddBacklogOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  // Edit Sprint Form State
  const [editName, setEditName] = useState(sprint.name);
  const [editGoal, setEditGoal] = useState(sprint.goal || "");
  const [editStartDate, setEditStartDate] = useState(sprint.startDate ? sprint.startDate.slice(0, 10) : "");
  const [editEndDate, setEditEndDate] = useState(sprint.endDate ? sprint.endDate.slice(0, 10) : "");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const editGoalRef = useRef<HTMLTextAreaElement | null>(null);

  // Filtering inside Sprint Tasks List
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>("ALL");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("ALL");

  // Backlog selector state
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<string[]>([]);
  const [backlogSearch, setBacklogSearch] = useState("");
  const [addingBacklog, setAddingBacklog] = useState(false);

  // Loading state for quick actions
  const [actionLoading, setActionLoading] = useState(false);

  // Tasks belonging to this sprint
  const sprintTasks = useMemo(() => {
    return tasks.filter((t) => t.sprintId === sprint.id);
  }, [tasks, sprint.id]);

  // Tasks available in Backlog (no sprint or another sprint)
  const backlogTasks = useMemo(() => {
    return tasks.filter((t) => !t.sprintId && t.status !== "DONE");
  }, [tasks]);

  // Detailed Metrics Calculation
  const stats = useMemo(() => {
    const totalCount = sprintTasks.length;
    const doneTasks = sprintTasks.filter((t) => t.status === "DONE");
    const inProgressTasks = sprintTasks.filter(
      (t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW"
    );
    const todoTasks = sprintTasks.filter(
      (t) => t.status === "TODO" || t.status === "BACKLOG"
    );

    const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
    const donePoints = doneTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
    const inProgressPoints = inProgressTasks.reduce((acc, t) => acc + (t.storyPoints ?? 0), 0);
    const remainingPoints = totalPoints - donePoints;
    const progress = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
    const taskProgress = totalCount > 0 ? Math.round((doneTasks.length / totalCount) * 100) : 0;

    // Breakdown by Priority
    const priorityCounts: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const t of sprintTasks) {
      if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++;
    }

    // Breakdown by Type
    const typeCounts: Record<string, number> = { TASK: 0, STORY: 0, BUG: 0, EPIC: 0 };
    for (const t of sprintTasks) {
      if (typeCounts[t.type] !== undefined) typeCounts[t.type]++;
    }

    // Workload by Assignee
    const memberMap: Record<
      string,
      { user: MemberDto["user"]; total: number; done: number; points: number }
    > = {};

    for (const m of members) {
      memberMap[m.user.id] = { user: m.user, total: 0, done: 0, points: 0 };
    }

    let unassignedCount = 0;
    let unassignedPoints = 0;

    for (const t of sprintTasks) {
      if (t.assigneeId && memberMap[t.assigneeId]) {
        memberMap[t.assigneeId].total++;
        if (t.status === "DONE") memberMap[t.assigneeId].done++;
        memberMap[t.assigneeId].points += t.storyPoints ?? 0;
      } else {
        unassignedCount++;
        unassignedPoints += t.storyPoints ?? 0;
      }
    }

    const workloads = Object.values(memberMap).filter((w) => w.total > 0);

    return {
      totalCount,
      doneCount: doneTasks.length,
      inProgressCount: inProgressTasks.length,
      todoCount: todoTasks.length,
      totalPoints,
      donePoints,
      inProgressPoints,
      remainingPoints,
      progress,
      taskProgress,
      priorityCounts,
      typeCounts,
      workloads,
      unassignedCount,
      unassignedPoints,
    };
  }, [sprintTasks, members]);

  // Duration & Day countdown
  const timeInfo = useMemo(() => {
    if (!sprint.startDate && !sprint.endDate) return null;
    const now = new Date();
    const start = sprint.startDate ? new Date(sprint.startDate) : null;
    const end = sprint.endDate ? new Date(sprint.endDate) : null;

    let daysLeft = null;
    let statusLabel = "";

    if (end) {
      const diffMs = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (sprint.status === "COMPLETED") {
        statusLabel = "Đã hoàn thành";
      } else if (diffDays < 0) {
        statusLabel = `Đã quá hạn ${Math.abs(diffDays)} ngày`;
      } else if (diffDays === 0) {
        statusLabel = "Hôm nay là hạn chót";
      } else {
        daysLeft = diffDays;
        statusLabel = `Còn ${diffDays} ngày`;
      }
    }

    return { start, end, daysLeft, statusLabel };
  }, [sprint]);

  // Filtered Tasks List inside Sprint
  const filteredSprintTasks = useMemo(() => {
    return sprintTasks.filter((t) => {
      if (taskFilterStatus === "TODO" && t.status !== "TODO" && t.status !== "BACKLOG") return false;
      if (taskFilterStatus === "IN_PROGRESS" && t.status !== "IN_PROGRESS" && t.status !== "IN_REVIEW")
        return false;
      if (taskFilterStatus === "DONE" && t.status !== "DONE") return false;

      if (taskAssigneeFilter !== "ALL") {
        if (taskAssigneeFilter === "UNASSIGNED" && t.assigneeId) return false;
        if (taskAssigneeFilter !== "UNASSIGNED" && t.assigneeId !== taskAssigneeFilter) return false;
      }

      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase().trim();
        const matchKey = `${projectKey}-${t.number}`.toLowerCase().includes(q);
        const matchTitle = t.title.toLowerCase().includes(q);
        if (!matchKey && !matchTitle) return false;
      }

      return true;
    });
  }, [sprintTasks, taskFilterStatus, taskAssigneeFilter, taskSearch, projectKey]);

  // Filtered Backlog tasks for modal
  const filteredBacklogTasks = useMemo(() => {
    return backlogTasks.filter((t) => {
      if (backlogSearch.trim()) {
        const q = backlogSearch.toLowerCase().trim();
        const matchKey = `${projectKey}-${t.number}`.toLowerCase().includes(q);
        const matchTitle = t.title.toLowerCase().includes(q);
        return matchKey || matchTitle;
      }
      return true;
    });
  }, [backlogTasks, backlogSearch, projectKey]);

  // Handlers
  async function updateSprintStatus(status: string) {
    setActionLoading(true);
    try {
      await fetch(`/api/projects/${projectId}/sprints/${sprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onChanged();
    } catch {
      alert("Lỗi cập nhật trạng thái Sprint");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveSprintEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          goal: editGoal.trim() || null,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        }),
      });
      if (res.ok) {
        setEditOpen(false);
        onChanged();
      } else {
        const err = await res.json();
        setEditError(err.error || "Không thể lưu cập nhật Sprint");
      }
    } catch {
      setEditError("Lỗi kết nối máy chủ");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteSprint() {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa "${sprint.name}"?\nToàn bộ ${sprintTasks.length} công việc trong sprint sẽ được hoàn trả an toàn về Backlog.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sprints/${sprint.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onOpenChange(false);
        onChanged();
      } else {
        alert("Không thể xóa Sprint này");
      }
    } catch {
      alert("Lỗi kết nối máy chủ");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveTaskFromSprint(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprintId: null }),
      });
      onChanged();
    } catch {
      alert("Lỗi khi chuyển task về Backlog");
    }
  }

  async function handleQuickStatusChange(taskId: string, newStatus: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onChanged();
    } catch {
      alert("Lỗi cập nhật trạng thái");
    }
  }

  async function handleAddBacklogTasksToSprint() {
    if (selectedBacklogIds.length === 0) return;
    setAddingBacklog(true);
    try {
      await Promise.all(
        selectedBacklogIds.map((taskId) =>
          fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sprintId: sprint.id }),
          })
        )
      );
      setSelectedBacklogIds([]);
      setAddBacklogOpen(false);
      onChanged();
    } catch {
      alert("Lỗi khi thêm công việc vào sprint");
    } finally {
      setAddingBacklog(false);
    }
  }

  // Keyboard shortcuts listener for SprintDetailDialog
  useEffect(() => {
    if (!open) return;

    function handleSprintDialogKeyDown(e: KeyboardEvent) {
      // Ctrl + Enter / Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (editOpen) {
          e.preventDefault();
          handleSaveSprintEdit(e as unknown as React.FormEvent);
          return;
        }
        if (addBacklogOpen && selectedBacklogIds.length > 0) {
          e.preventDefault();
          handleAddBacklogTasksToSprint();
          return;
        }
      }

      // Alt + N: Tạo việc mới vào Sprint
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNewTaskOpen(true);
        return;
      }

      // Alt + B: Thêm từ Backlog
      if (e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSelectedBacklogIds([]);
        setBacklogSearch("");
        setAddBacklogOpen(true);
        return;
      }

      // Alt + E: Sửa thông tin Sprint
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setEditName(sprint.name);
        setEditGoal(sprint.goal || "");
        setEditStartDate(sprint.startDate ? sprint.startDate.slice(0, 10) : "");
        setEditEndDate(sprint.endDate ? sprint.endDate.slice(0, 10) : "");
        setEditOpen(true);
        return;
      }
    }

    window.addEventListener("keydown", handleSprintDialogKeyDown);
    return () => window.removeEventListener("keydown", handleSprintDialogKeyDown);
  }, [
    open,
    editOpen,
    addBacklogOpen,
    selectedBacklogIds,
    editName,
    editGoal,
    editStartDate,
    editEndDate,
    sprint,
  ]);

  function handleGoToBoard() {
    onOpenChange(false);
    router.push(boardHref(projectId, { sprintId: sprint.id }));
  }

  return (
    <>
      <Dialog
        visible={open}
        onHide={() => onOpenChange(false)}
        showHeader={false}
        className="max-w-5xl w-[96vw] p-0 overflow-hidden border border-line bg-surface shadow-2xl rounded-2xl flex flex-col max-h-[90vh]"
        contentClassName="p-0 overflow-hidden flex flex-col max-h-[90vh] bg-surface"
      >
        <div className="flex flex-col h-full overflow-hidden bg-surface">
          {/* Header */}
          <div className="flex flex-col gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted flex-wrap">
                  <span>Dự án:</span>
                  <span className="text-foreground font-bold">{projectName}</span>
                  <ChevronRight className="h-3 w-3 text-muted/60" />
                  <span className="text-accent font-bold">Kế hoạch Sprint</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-accent" />
                    <span>{sprint.name}</span>
                  </h2>

                  {/* Status Badge */}
                  {sprint.status === "ACTIVE" && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-0.5 text-xs font-bold text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Đang hoạt động
                    </span>
                  )}

                  {sprint.status === "COMPLETED" && (
                    <span className="flex items-center gap-1.5 rounded-full bg-surface-2 border border-line px-3 py-0.5 text-xs font-semibold text-muted">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Đã hoàn thành
                    </span>
                  )}

                  {sprint.status === "PLANNING" && (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-0.5 text-xs font-semibold text-amber-400">
                      <Clock className="h-4 w-4" /> Đang lên kế hoạch
                    </span>
                  )}

                  {timeInfo && timeInfo.statusLabel && (
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                        sprint.status === "COMPLETED"
                          ? "bg-surface-2 text-muted border-line"
                          : timeInfo.daysLeft !== null && timeInfo.daysLeft <= 2
                          ? "bg-accent/10 text-accent border-accent/20"
                          : "bg-accent/10 text-accent border-accent/20"
                      }`}
                    >
                      ⏳ {timeInfo.statusLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Switch to Board with Sprint Filter */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGoToBoard}
                  className="h-8 text-xs font-bold border-line bg-surface hover:bg-surface-2 text-foreground"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1 text-accent" />
                  Mở trên Board
                </Button>

                {/* Edit Sprint button */}
                <Button
                  size="sm"
                  variant="outline"
                  title="Chỉnh sửa thông tin Sprint (Alt+E)"
                  onClick={() => {
                    setEditName(sprint.name);
                    setEditGoal(sprint.goal || "");
                    setEditStartDate(sprint.startDate ? sprint.startDate.slice(0, 10) : "");
                    setEditEndDate(sprint.endDate ? sprint.endDate.slice(0, 10) : "");
                    setEditOpen(true);
                  }}
                  className="h-8 text-xs font-semibold border-line bg-surface hover:bg-surface-2 cursor-pointer gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-0.5" />
                  <span>Sửa</span>
                  <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono font-bold bg-surface-2 text-muted rounded border border-line">
                    Alt+E
                  </kbd>
                </Button>

                {/* Status Switcher */}
                {sprint.status === "PLANNING" && (
                  <Button
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => updateSprintStatus("ACTIVE")}
                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Kích hoạt Sprint
                  </Button>
                )}

                {sprint.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => updateSprintStatus("COMPLETED")}
                    className="h-8 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Đóng Sprint
                  </Button>
                )}

                {sprint.status === "COMPLETED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => updateSprintStatus("ACTIVE")}
                    className="h-8 text-xs font-bold border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> Mở lại Sprint
                  </Button>
                )}

                {/* Delete Sprint */}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={actionLoading}
                  onClick={handleDeleteSprint}
                  className="h-8 w-8 p-0 text-muted hover:text-accent hover:bg-accent/10"
                  title="Xóa Sprint (chuyển tasks về Backlog)"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Goal & Dates row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
              <div className="flex-1 min-w-0">
                {sprint.goal ? (
                  <div className="bg-surface-2/70 border border-line/60 rounded-xl px-3.5 py-2 text-foreground/90 leading-relaxed flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">🎯</span>
                    <div className="flex-1 min-w-0">
                      <strong className="text-foreground block mb-0.5">Mục tiêu Sprint:</strong>
                      <RichMarkdown content={sprint.goal} />
                    </div>
                  </div>
                ) : (
                  <div className="text-muted italic flex items-center gap-1.5">
                    <span>Chưa thiết lập mục tiêu cho sprint này.</span>
                    <button
                      onClick={() => setEditOpen(true)}
                      className="text-accent underline text-xs font-semibold cursor-pointer"
                    >
                      Thêm mục tiêu
                    </button>
                  </div>
                )}
              </div>

              {(sprint.startDate || sprint.endDate) && (
                <div className="flex items-center gap-2 text-xs text-muted shrink-0 bg-surface px-3 py-1.5 rounded-lg border border-line">
                  <Calendar className="h-3.5 w-3.5 text-accent" />
                  <span>
                    {sprint.startDate ? format(new Date(sprint.startDate), "dd/MM/yyyy") : "—"}
                  </span>
                  <span>→</span>
                  <span>
                    {sprint.endDate ? format(new Date(sprint.endDate), "dd/MM/yyyy") : "—"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* KPI Progress Cards */}
            {/* Bố cục 2 hàng x 2 cột: mỗi hàng gồm 2 thẻ có mật độ nội dung tương đương nhau
                (hàng 1: 2 thẻ progress bar; hàng 2: 2 thẻ danh sách phân bổ) nên chiều cao
                trong cùng 1 hàng luôn khớp nhau tự nhiên — không còn thẻ to/nhỏ lệch nhau
                như khi xếp chung 1 hàng 4 cột với 2 loại nội dung khác mật độ. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Story Points Burn */}
              <div className="rounded-2xl border border-line bg-surface-2/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-accent" />
                    Điểm Story Points
                  </span>
                  <span className="font-mono font-bold text-accent">{stats.progress}%</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-foreground">
                    {stats.donePoints}
                  </span>
                  <span className="text-xs text-muted font-mono">/ {stats.totalPoints} points</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface border border-line">
                  <div
                    className={`h-full transition-all duration-500 ${
                      stats.progress === 100
                        ? "bg-emerald-500"
                        : stats.progress > 50
                        ? "bg-accent"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${stats.progress}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted flex justify-between pt-0.5">
                  <span>Còn lại: {stats.remainingPoints} pts</span>
                  <span>{stats.inProgressPoints} pts đang làm</span>
                </div>
              </div>

              {/* Tasks Count Progress */}
              <div className="rounded-2xl border border-line bg-surface-2/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                    Số lượng công việc
                  </span>
                  <span className="font-mono font-bold text-foreground">{stats.taskProgress}%</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-foreground">
                    {stats.doneCount}
                  </span>
                  <span className="text-xs text-muted font-mono">/ {stats.totalCount} công việc</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface border border-line">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${stats.taskProgress}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted flex justify-between pt-0.5">
                  <span>Cần làm: {stats.todoCount}</span>
                  <span>Đang làm: {stats.inProgressCount}</span>
                </div>
              </div>

              {/* Priority Distribution */}
              <div className="rounded-2xl border border-line bg-surface-2/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted font-semibold">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    Mức độ ưu tiên
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-accent font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" /> Khẩn cấp
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.priorityCounts.URGENT || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-orange-600 font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" /> Cao
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.priorityCounts.HIGH || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-blue-600 font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" /> Trung bình
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.priorityCounts.MEDIUM || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-muted font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted shrink-0" /> Thấp
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.priorityCounts.LOW || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Task Types */}
              <div className="rounded-2xl border border-line bg-surface-2/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-purple-400" />
                    Phân loại việc
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-purple-600 font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" /> Hạng mục lớn
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.typeCounts.EPIC || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-accent font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" /> Lỗi
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.typeCounts.BUG || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /> Tính năng
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.typeCounts.STORY || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-surface px-2.5 py-1 rounded-lg border border-line text-[11px]">
                    <span className="text-blue-600 font-bold flex items-center gap-1.5 whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" /> Công việc
                    </span>
                    <span className="font-bold font-mono text-foreground">
                      {stats.typeCounts.TASK || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Member Workload Avatars */}
            {stats.workloads.length > 0 && (
              <div className="rounded-2xl border border-line bg-surface-2/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-accent" />
                    Phân bổ công việc theo nhân sự trong Sprint ({stats.workloads.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {stats.workloads.map((w) => {
                    const pct = w.total > 0 ? Math.round((w.done / w.total) * 100) : 0;
                    return (
                      <div
                        key={w.user.id}
                        className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 border border-line hover:border-line-strong transition-all"
                      >
                        <Avatar className="h-8 w-8 shrink-0 border border-white/10">
                          <AvatarFallback color={w.user.avatarColor} className="text-[10px] font-bold">
                            {initials(w.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-foreground truncate">{w.user.name}</p>
                            <span className="text-[10px] font-mono text-accent font-bold">
                              {w.points} pts
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted">
                            <span>
                              {w.done}/{w.total} xong
                            </span>
                            <span className="font-semibold">{pct}%</span>
                          </div>
                          <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {stats.unassignedCount > 0 && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/5 p-2.5 border border-amber-500/20">
                      <div className="h-8 w-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                        ?
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-bold text-amber-600">Chưa phân công</p>
                        <p className="text-[10px] text-muted">
                          {stats.unassignedCount} việc ({stats.unassignedPoints} pts)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sprint Task Backlog Table / List */}
            <div className="space-y-2.5">
              {/* Row 1: Tiêu đề + nhóm hành động (tách riêng khỏi khu vực filter bên dưới) */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-accent" />
                  Danh sách công việc ({sprintTasks.length})
                </h3>

                {/* Actions: Add From Backlog, Create Task */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    title="Thêm công việc từ Backlog (Alt+B)"
                    onClick={() => {
                      setSelectedBacklogIds([]);
                      setBacklogSearch("");
                      setAddBacklogOpen(true);
                    }}
                    className="h-8 text-xs font-semibold border-line bg-surface hover:bg-surface-2 cursor-pointer gap-1"
                  >
                    <Plus className="h-3.5 w-3.5 mr-0.5 text-accent" />
                    <span>Thêm từ Backlog ({backlogTasks.length})</span>
                    <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono font-bold bg-surface-2 text-muted rounded border border-line">
                      Alt+B
                    </kbd>
                  </Button>

                  <Button
                    size="sm"
                    title="Tạo task mới vào sprint này (Alt+N)"
                    onClick={() => setNewTaskOpen(true)}
                    className="h-8 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 cursor-pointer gap-1"
                  >
                    <Plus className="h-3.5 w-3.5 mr-0.5" />
                    <span>Tạo Task mới</span>
                    <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                      Alt+N
                    </kbd>
                  </Button>
                </div>
              </div>

              {/* Row 2: Khu vực filter — gom chung tab trạng thái + tìm kiếm + lọc theo nhân sự */}
              <div className="flex items-center gap-2 flex-wrap rounded-xl border border-line bg-surface-2/30 p-2">
                {/* Filter Tabs */}
                <div className="flex rounded-lg border border-line bg-surface p-0.5 text-xs font-medium shrink-0">
                  <button
                    onClick={() => setTaskFilterStatus("ALL")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      taskFilterStatus === "ALL"
                        ? "bg-accent text-white font-bold shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Tất cả ({sprintTasks.length})
                  </button>
                  <button
                    onClick={() => setTaskFilterStatus("TODO")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      taskFilterStatus === "TODO"
                        ? "bg-accent text-white font-bold shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Cần làm ({stats.todoCount})
                  </button>
                  <button
                    onClick={() => setTaskFilterStatus("IN_PROGRESS")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      taskFilterStatus === "IN_PROGRESS"
                        ? "bg-accent text-white font-bold shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Đang làm ({stats.inProgressCount})
                  </button>
                  <button
                    onClick={() => setTaskFilterStatus("DONE")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      taskFilterStatus === "DONE"
                        ? "bg-accent text-white font-bold shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Đã xong ({stats.doneCount})
                  </button>
                </div>

                <div className="h-5 w-px bg-line shrink-0" />

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted pointer-events-none z-10" />
                  <Input
                    placeholder="Tìm công việc..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="h-8 w-44 pl-8 text-xs bg-surface border-line"
                  />
                </div>

                {/* Assignee Filter */}
                <Dropdown
                  value={taskAssigneeFilter}
                  options={[
                    { label: "👤 Mọi nhân sự", value: "ALL" },
                    { label: "Chưa giao", value: "UNASSIGNED" },
                    ...members.map((m) => ({ label: m.user.name, value: m.user.id })),
                  ]}
                  onChange={(e) => setTaskAssigneeFilter(e.value)}
                  className="p-inputtext-sm h-8 text-xs bg-surface border border-line rounded-lg"
                />
              </div>

              {/* Task Items List Table */}
              <div className="rounded-2xl border border-line bg-surface/50 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Table Header */}
                    <div className="grid grid-cols-[105px_1fr_120px_65px_85px_130px_130px_28px] items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-muted uppercase tracking-wider border-b border-line bg-surface-2/60">
                      <span className="flex items-center gap-1">Mã task</span>
                      <span>Tiêu đề công việc</span>
                      <span>Nhãn</span>
                      <span className="text-center">Points</span>
                      <span className="text-center">Hạn chót</span>
                      <span>Phụ trách</span>
                      <span>Trạng thái</span>
                      <span></span>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-line">
                  {filteredSprintTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">
                      <Layers className="h-8 w-8 text-muted" />
                      <p className="text-xs font-bold text-foreground">
                        {sprintTasks.length === 0
                          ? "Sprint này chưa có công việc nào"
                          : "Không tìm thấy công việc phù hợp bộ lọc"}
                      </p>
                      <p className="text-[11px] text-muted">
                        {sprintTasks.length === 0
                          ? "Thêm công việc từ Backlog hoặc tạo mới để bắt đầu lập kế hoạch thực hiện"
                          : "Hãy thử đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc"}
                      </p>
                      {sprintTasks.length === 0 && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAddBacklogOpen(true)}
                            className="text-xs"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Gán từ Backlog
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setNewTaskOpen(true)}
                            className="text-xs font-bold"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Tạo công việc mới
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredSprintTasks.map((t) => {
                      const isDone = t.status === "DONE";
                      const isOverdue =
                        t.dueDate &&
                        !isDone &&
                        isBefore(new Date(t.dueDate), new Date(new Date().setHours(0, 0, 0, 0)));

                      return (
                        <div
                          key={t.id}
                          onClick={() => onSelectTask(t.id)}
                          className={`group grid grid-cols-[105px_1fr_130px_70px_85px_135px_130px_28px] items-center gap-3 px-4 py-2.5 transition-all cursor-pointer ${
                            isDone
                              ? "bg-surface/30 opacity-80 hover:opacity-100 hover:bg-surface-2/40"
                              : "bg-surface hover:bg-surface-2/70"
                          }`}
                        >
                          {/* Col 1: Type + Task Code + Priority */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="shrink-0 p-1 rounded bg-surface-2 border border-line">
                              <TypeIcon type={t.type} />
                            </div>
                            <span className="font-mono text-xs font-bold text-accent shrink-0">
                              #{projectKey}-{t.number}
                            </span>
                            <div className="shrink-0 ml-0.5" title={`Độ ưu tiên: ${t.priority}`}>
                              <PriorityIcon priority={t.priority} />
                            </div>
                          </div>

                          {/* Col 2: Title & Checklist */}
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span
                              className={`text-xs font-semibold text-foreground truncate min-w-0 ${
                                isDone ? "line-through text-muted" : "group-hover:text-accent transition-colors"
                              }`}
                              title={t.title}
                            >
                              {t.title}
                            </span>

                            {t.subtasks && t.subtasks.length > 0 && (
                              <span className="text-[10px] font-mono text-muted flex items-center gap-0.5 shrink-0 bg-surface-2 px-1.5 py-0.5 rounded border border-line">
                                <CheckSquare className="h-3 w-3 text-accent" />
                                {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
                              </span>
                            )}
                          </div>

                          {/* Col 3: Labels */}
                          <div className="hidden sm:flex items-center gap-1 min-w-0 overflow-hidden">
                            {t.labels && t.labels.length > 0 ? (
                              t.labels.slice(0, 2).map((l) => (
                                <span
                                  key={l.label.id}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[60px]"
                                  style={{
                                    backgroundColor: `${l.label.color}15`,
                                    color: l.label.color,
                                    border: `1px solid ${l.label.color}30`,
                                  }}
                                  title={l.label.name}
                                >
                                  {l.label.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted/30">—</span>
                            )}
                          </div>

                          {/* Col 4: Story Points */}
                          <div className="flex items-center justify-center">
                            {t.storyPoints !== null && t.storyPoints !== undefined ? (
                              <span className="rounded-md bg-surface-2 border border-line px-2 py-0.5 text-[11px] font-mono font-bold text-foreground">
                                {t.storyPoints} pts
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted/40 font-mono">—</span>
                            )}
                          </div>

                          {/* Col 5: Due Date */}
                          <div className="flex items-center justify-center">
                            {t.dueDate ? (
                              <span
                                className={`text-[11px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-md ${
                                  isOverdue
                                    ? "bg-accent/15 text-accent border border-accent/30"
                                    : "text-muted bg-surface-2 border border-line/60"
                                }`}
                              >
                                <Calendar className="h-3 w-3 shrink-0" />
                                {format(new Date(t.dueDate), "dd/MM")}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted/40">—</span>
                            )}
                          </div>

                          {/* Col 6: Assignee */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {t.assignee ? (
                              <>
                                <Avatar className="h-5 w-5 shrink-0 border border-white/10">
                                  <AvatarFallback
                                    color={t.assignee.avatarColor}
                                    className="text-[8px] font-bold"
                                  >
                                    {initials(t.assignee.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  className="text-xs text-muted font-medium truncate max-w-[100px]"
                                  title={t.assignee.name}
                                >
                                  {t.assignee.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-muted/50 italic">
                                Chưa giao
                              </span>
                            )}
                          </div>

                          {/* Col 7: Status Dropdown */}
                          <div onClick={(e) => e.stopPropagation()} className="w-full">
                            <Dropdown
                              value={t.status}
                              options={STATUSES.map((s) => ({ label: s.label, value: s.id }))}
                              onChange={(e) => handleQuickStatusChange(t.id, e.value, e as any)}
                              className="w-full h-7 text-[11px] font-bold rounded-lg border border-line bg-surface-2"
                            />
                          </div>

                          {/* Col 8: Action Remove */}
                          <div className="flex items-center justify-end">
                            <button
                              onClick={(e) => handleRemoveTaskFromSprint(t.id, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted hover:text-accent p-1 rounded hover:bg-surface-2 cursor-pointer"
                              title="Gỡ khỏi Sprint (chuyển về Backlog)"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
          <div className="flex items-center justify-between border-t border-line bg-surface-2/60 px-5 py-2.5 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                Tổng cộng: {sprintTasks.length} công việc
              </span>
              <span>•</span>
              <span className="font-mono text-accent font-bold">
                {stats.donePoints}/{stats.totalPoints} points hoàn thành ({stats.progress}%)
              </span>
            </div>

            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </div>
      </Dialog>

      {/* EDIT SPRINT MODAL */}
      <Dialog
        header={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Edit3 className="h-4 w-4 text-accent" />
            <span>Chỉnh Sửa Thông Tin Sprint</span>
          </div>
        }
        visible={editOpen}
        onHide={() => setEditOpen(false)}
        className="w-full max-w-md border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleSaveSprintEdit} className="space-y-3.5 pt-2">
          {editError && (
            <div className="rounded-lg bg-accent/10 p-2.5 text-xs text-accent border border-accent/20">
              {editError}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Tên Sprint *</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xs h-9"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Mục tiêu Sprint (Goal)</Label>
              <span className="text-[10px] text-muted">1. 2. 3., in đậm, màu trực quan</span>
            </div>
            <WysiwygEditor
              value={editGoal}
              onChange={setEditGoal}
              placeholder="Mục tiêu cốt lõi cần đạt được trong đợt chạy này... (in đậm, màu, 1. 2. 3.)"
              minHeight="90px"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Ngày bắt đầu</Label>
              <Input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ngày kết thúc</Label>
              <Input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)} className="cursor-pointer">
              <span>Hủy</span>
              <kbd className="text-[10px] text-muted ml-1 font-mono">Esc</kbd>
            </Button>
            <Button type="submit" size="sm" disabled={editSaving} className="font-bold bg-accent hover:bg-accent/90 text-white shadow-sm cursor-pointer gap-1.5">
              {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              <span>Lưu Thay Đổi</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                Ctrl+Enter
              </kbd>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ADD TASKS FROM BACKLOG MODAL */}
      <Dialog
        header={
          <div className="flex items-center gap-2 text-base font-bold text-foreground">
            <Plus className="h-4 w-4 text-accent" />
            <span>Gán Công Việc Từ Backlog Vào {sprint.name}</span>
          </div>
        }
        visible={addBacklogOpen}
        onHide={() => setAddBacklogOpen(false)}
        className="w-full max-w-xl border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-4 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <Input
              placeholder="Tìm công việc trong Backlog..."
              value={backlogSearch}
              onChange={(e) => setBacklogSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-surface border-line"
            />
          </div>

          {/* Backlog List */}
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {filteredBacklogTasks.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted border border-dashed border-line rounded-xl">
                {backlogTasks.length === 0
                  ? "Không có công việc nào còn trống trong Backlog"
                  : "Không tìm thấy công việc khớp với tìm kiếm"}
              </div>
            ) : (
              filteredBacklogTasks.map((t) => {
                const isSelected = selectedBacklogIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedBacklogIds((prev) =>
                        isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                      );
                    }}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent/10 border-accent text-foreground"
                        : "bg-surface border-line hover:border-line-strong hover:bg-surface-2/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-accent border-accent text-white"
                            : "border-line bg-surface"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <TypeIcon type={t.type} />
                      <span className="font-mono text-xs font-bold text-accent shrink-0">
                        #{projectKey}-{t.number}
                      </span>
                      <span className="text-xs font-semibold truncate text-foreground">
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.storyPoints !== null && (
                        <span className="text-[10px] font-mono bg-surface-2 px-1.5 py-0.5 rounded text-muted font-bold">
                          {t.storyPoints} pts
                        </span>
                      )}
                      {t.assignee && (
                        <Avatar className="h-5 w-5">
                          <AvatarFallback
                            color={t.assignee.avatarColor}
                            className="text-[8px] font-bold"
                          >
                            {initials(t.assignee.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-xs text-muted font-medium">
              Đã chọn: <strong className="text-accent">{selectedBacklogIds.length}</strong> công việc
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddBacklogOpen(false)}
                className="text-xs cursor-pointer"
              >
                <span>Hủy</span>
                <kbd className="text-[10px] text-muted ml-1 font-mono">Esc</kbd>
              </Button>
              <Button
                size="sm"
                disabled={selectedBacklogIds.length === 0 || addingBacklog}
                onClick={handleAddBacklogTasksToSprint}
                className="text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-sm cursor-pointer gap-1.5"
              >
                {addingBacklog ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                <span>Thêm {selectedBacklogIds.length} việc vào Sprint</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                  Ctrl+Enter
                </kbd>
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* CREATE NEW TASK IN THIS SPRINT MODAL */}
      <NewTaskDialog
        projectId={projectId}
        open={newTaskOpen}
        defaultStatus="TODO"
        defaultSprintId={sprint.id}
        members={members}
        labels={labels}
        sprints={sprints}
        onOpenChange={setNewTaskOpen}
        onCreated={() => {
          onChanged();
        }}
      />
    </>
  );
}
