"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  Plus,
  Search,
  Wifi,
  WifiOff,
  Filter,
  Users,
  Shield,
  Eye,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  X,
} from "lucide-react";
import { STATUSES, PRIORITIES, TASK_TYPES } from "@/lib/constants";
import type { BoardData, TaskDto } from "@/lib/types";
import { canCreateTask, isViewer } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "primereact/dropdown";
import { BoardColumn } from "@/components/board/board-column";
import { TaskCard } from "@/components/board/task-card";
import { useTabCache } from "@/lib/tab-cache";

// Lazy-loaded Dialogs to reduce initial JS bundle and render latency
const TaskDialog = dynamic(() => import("@/components/board/task-dialog").then((m) => m.TaskDialog), {
  ssr: false,
});
const NewTaskDialog = dynamic(() => import("@/components/board/new-task-dialog").then((m) => m.NewTaskDialog), {
  ssr: false,
});
const NotionDialog = dynamic(() => import("@/components/notion/notion-dialog").then((m) => m.NotionDialog), {
  ssr: false,
});
const MemberDialog = dynamic(() => import("@/components/project/member-dialog").then((m) => m.MemberDialog), {
  ssr: false,
});

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.35",
      },
    },
  }),
  duration: 220,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
};

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  
  // Trích xuất projectId an toàn kể cả khi useParams chậm/null trên trình duyệt cũ
  let projectId = params?.projectId;
  if (!projectId && typeof window !== "undefined") {
    const match = window.location.pathname.match(/\/projects\/([^\/]+)/);
    if (match) projectId = match[1];
  }

  const searchParams = useSearchParams();
  const urlTaskId = searchParams.get("taskId");
  const urlSprintId = searchParams.get("sprintId");

  const [connected, setConnected] = useState(false);

  // Filters State
  const [search, setSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState<string>(urlSprintId || "ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Sorting State
  const [sortBy, setSortBy] = useState<string>("MANUAL");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dialogs State
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(urlTaskId);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState("TODO");
  const [notionOpen, setNotionOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [activeMobileColumn, setActiveMobileColumn] = useState<string>("TODO");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper sync tab active với vị trí cuộn thực tế của board
  function scrollToMobileColumn(statusId: string) {
    setActiveMobileColumn(statusId);
    const container = boardContainerRef.current;
    const colEl = document.getElementById(`board-col-${statusId}`);
    if (container && colEl) {
      const targetLeft = colEl.offsetLeft - container.offsetLeft - 12;
      container.scrollTo({ left: targetLeft, behavior: "smooth" });
    }
  }

  function handleBoardScroll() {
    const container = boardContainerRef.current;
    if (!container) return;
    const currentScrollLeft = container.scrollLeft;
    let closestId: string = STATUSES[0].id;
    let minDiff = Infinity;
    for (const s of STATUSES) {
      const colEl = document.getElementById(`board-col-${s.id}`);
      if (colEl) {
        const target = colEl.offsetLeft - container.offsetLeft - 12;
        const diff = Math.abs(target - currentScrollLeft);
        if (diff < minDiff) {
          minDiff = diff;
          closestId = s.id;
        }
      }
    }
    setActiveMobileColumn(closestId);
  }

  // Horizontal wheel scroll handler for board
  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const verticalScrollable = target.closest(".overflow-y-auto");

      // Nếu đang hover trên cột có thể cuộn dọc và chưa chạm đáy/đỉnh -> cho phép cuộn dọc
      if (verticalScrollable) {
        const canScrollUp = verticalScrollable.scrollTop > 0 && e.deltaY < 0;
        const canScrollDown =
          verticalScrollable.scrollTop + verticalScrollable.clientHeight < verticalScrollable.scrollHeight - 2 &&
          e.deltaY > 0;
        if (canScrollUp || canScrollDown) {
          return;
        }
      }

      // Ngược lại, cuộn ngang cả board
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 0.8;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Đồng bộ state theo query param của URL. Điều chỉnh ngay trong lúc render
  // (thay vì useEffect) để dialog/filter đúng ngay từ lượt render đầu tiên sau
  // khi URL thay đổi, không render thừa với giá trị cũ.
  const [prevUrlTaskId, setPrevUrlTaskId] = useState(urlTaskId);
  if (urlTaskId !== prevUrlTaskId) {
    setPrevUrlTaskId(urlTaskId);
    if (urlTaskId) setOpenTaskId(urlTaskId);
  }

  const [prevUrlSprintId, setPrevUrlSprintId] = useState(urlSprintId);
  if (urlSprintId !== prevUrlSprintId) {
    setPrevUrlSprintId(urlSprintId);
    if (urlSprintId) setSprintFilter(urlSprintId);
  }

  const tasksApiUrl = projectId ? `/api/projects/${projectId}/tasks` : null;

  const fetchBoard = useCallback(async (): Promise<BoardData> => {
    if (!projectId) throw new Error("No project ID");
    const headers: Record<string, string> = {};
    try {
      const token = localStorage.getItem("flowboard_session");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {}

    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      credentials: "same-origin",
      headers,
    });
    if (!res.ok) throw new Error("Failed to load board tasks");
    return await res.json();
  }, [projectId]);

  const {
    data,
    loading,
    mutate: setData,
    revalidate: loadBoard,
  } = useTabCache<BoardData>(tasksApiUrl, fetchBoard, {
    staleTime: 15000,
  });

  // Quick-assign straight from the card, without opening the full task dialog
  const quickAssign = useCallback(
    async (taskId: string, userId: string | null) => {
      if (isViewer(data?.currentRole)) return;
      const targetMember = data?.members.find((m) => m.user.id === userId)?.user || null;

      // Optimistic update tức thì trên UI (< 1ms)
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  assigneeId: userId,
                  assignee: targetMember
                    ? { id: targetMember.id, name: targetMember.name, avatarColor: targetMember.avatarColor }
                    : null,
                }
              : t
          ),
        };
      });

      try {
        await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeId: userId }),
        });
      } catch (err) {
        console.error("Quick assign failed:", err);
        loadBoard();
      }
    },
    [projectId, data?.currentRole, data?.members, loadBoard, setData]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setNewTaskStatus("TODO");
        setNewTaskOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNotionOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Realtime SSE
  useEffect(() => {
    const es = new EventSource(`/api/projects/${projectId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "CONNECTED") {
          setConnected(true);
          return;
        }
        loadBoard();
      } catch {
        // ignore
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [projectId, loadBoard]);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 4 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 150, tolerance: 6 },
  });
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(mouseSensor, touchSensor, pointerSensor, keyboardSensor);

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCorners(args);
  }, []);

  const deferredSearch = useDeferredValue(search);

  // Filter & Sort Calculation
  const tasksByStatus = useMemo(() => {
    const map: Record<string, TaskDto[]> = {};
    for (const s of STATUSES) map[s.id] = [];
    if (!data) return map;

    const q = deferredSearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000 - 1);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000);

    const filtered = data.tasks.filter((t) => {
      if (q) {
        const matchKey = `${data.project.key}-${t.number}`.toLowerCase().includes(q);
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchKey && !matchTitle && !matchDesc) return false;
      }

      if (sprintFilter !== "ALL") {
        if (sprintFilter === "NONE" && t.sprintId) return false;
        if (sprintFilter !== "NONE" && t.sprintId !== sprintFilter) return false;
      }

      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;

      if (assigneeFilter !== "ALL") {
        if (assigneeFilter === "UNASSIGNED" && t.assigneeId) return false;
        if (assigneeFilter !== "UNASSIGNED" && t.assigneeId !== assigneeFilter) return false;
      }

      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;

      if (timeFilter !== "ALL") {
        if (timeFilter === "NO_DUE_DATE" && t.dueDate) return false;
        if (timeFilter === "TODAY") {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          if (d < startOfToday || d > endOfToday) return false;
        }
        if (timeFilter === "THIS_WEEK") {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          if (d < startOfToday || d > endOfWeek) return false;
        }
        if (timeFilter === "OVERDUE") {
          if (!t.dueDate || t.status === "DONE") return false;
          const d = new Date(t.dueDate);
          if (d >= startOfToday) return false;
        }
      }

      return true;
    });

    for (const t of filtered) {
      (map[t.status] ??= []).push(t);
    }

    for (const s of STATUSES) {
      map[s.id]?.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "PRIORITY") {
          cmp = (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
        } else if (sortBy === "DUE_DATE") {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        } else if (sortBy === "CREATED_AT") {
          cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else if (sortBy === "STORY_POINTS") {
          cmp = (b.storyPoints ?? 0) - (a.storyPoints ?? 0);
        } else if (sortBy === "TITLE") {
          cmp = a.title.localeCompare(b.title);
        } else {
          cmp = a.position - b.position;
        }
        return sortOrder === "asc" ? -cmp : cmp;
      });
    }

    return map;
  }, [data, search, sprintFilter, statusFilter, assigneeFilter, priorityFilter, timeFilter, typeFilter, sortBy, sortOrder]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (sprintFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    if (assigneeFilter !== "ALL") count++;
    if (priorityFilter !== "ALL") count++;
    if (timeFilter !== "ALL") count++;
    if (typeFilter !== "ALL") count++;
    if (sortBy !== "MANUAL") count++;
    return count;
  }, [search, sprintFilter, statusFilter, assigneeFilter, priorityFilter, timeFilter, typeFilter, sortBy]);

  function resetFilters() {
    setSearch("");
    setSprintFilter("ALL");
    setStatusFilter("ALL");
    setAssigneeFilter("ALL");
    setPriorityFilter("ALL");
    setTimeFilter("ALL");
    setTypeFilter("ALL");
    setSortBy("MANUAL");
    setSortOrder("desc");
  }

  const activeSprint = useMemo(
    () => data?.sprints.find((s) => s.status === "ACTIVE") ?? null,
    [data]
  );

  function handleDragStart(event: DragStartEvent) {
    if (isViewer(data?.currentRole)) return;
    const task = data?.tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    if (isViewer(data?.currentRole)) return;
    const { active, over } = event;
    if (!over || !data) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeTaskItem = data.tasks.find((t) => t.id === activeId);
    const overTaskItem = data.tasks.find((t) => t.id === overId);
    if (!activeTaskItem) return;

    const targetStatus = overTaskItem
      ? overTaskItem.status
      : STATUSES.some((s) => s.id === overId)
      ? overId
      : null;

    if (!targetStatus) return;

    if (activeTaskItem.status !== targetStatus) {
      setData((prev) => {
        if (!prev) return prev;
        const activeIndex = prev.tasks.findIndex((t) => t.id === activeId);
        const overIndex = overTaskItem
          ? prev.tasks.findIndex((t) => t.id === overId)
          : prev.tasks.length;

        const newTasks = [...prev.tasks];
        newTasks[activeIndex] = { ...newTasks[activeIndex], status: targetStatus };

        return {
          ...prev,
          tasks: arrayMove(newTasks, activeIndex, overIndex < 0 ? activeIndex : overIndex),
        };
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    if (isViewer(data?.currentRole)) return;
    const { active, over } = event;
    if (!over || !data) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overTask = data.tasks.find((t) => t.id === overId);
    const newStatus = overTask
      ? overTask.status
      : STATUSES.some((s) => s.id === overId)
      ? overId
      : null;
    if (!newStatus) return;

    let newPosition = task.position;
    if (overTask && overTask.id !== task.id) {
      const columnTasks = data.tasks
        .filter((t) => t.status === newStatus && t.id !== taskId)
        .sort((a, b) => a.position - b.position);
      const overIndex = columnTasks.findIndex((t) => t.id === overTask.id);
      if (overIndex >= 0) {
        const prevTask = columnTasks[overIndex - 1];
        const prevPos = prevTask ? prevTask.position : overTask.position - 1000;
        newPosition = (prevPos + overTask.position) / 2;
      } else {
        newPosition = overTask.position + 500;
      }
    } else if (!overTask) {
      const columnTasks = data.tasks
        .filter((t) => t.status === newStatus && t.id !== taskId)
        .sort((a, b) => a.position - b.position);
      const lastTask = columnTasks[columnTasks.length - 1];
      newPosition = lastTask ? lastTask.position + 1000 : 1000;
    }

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t
        ),
      };
    });

    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, position: newPosition }),
      });
    } catch (err) {
      console.error("Lỗi cập nhật task:", err);
      loadBoard();
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Skeleton Header */}
        <div className="flex h-11 sm:h-14 shrink-0 items-center justify-between border-b border-line px-2.5 sm:px-5 gap-2 bg-surface/40">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-surface-2 animate-pulse" />
            <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-lg bg-surface-2 animate-pulse" />
            <div className="h-7 w-24 rounded-lg bg-surface-2 animate-pulse" />
          </div>
        </div>

        {/* Skeleton Filter Bar */}
        <div className="flex items-center border-b border-line bg-surface/50 px-2.5 sm:px-5 py-2 gap-2 overflow-x-auto no-scrollbar">
          <div className="h-8 w-48 rounded-lg bg-surface-2 animate-pulse shrink-0" />
          <div className="h-8 w-32 rounded-lg bg-surface-2 animate-pulse shrink-0" />
          <div className="h-8 w-28 rounded-lg bg-surface-2 animate-pulse shrink-0" />
          <div className="h-8 w-28 rounded-lg bg-surface-2 animate-pulse shrink-0" />
        </div>

        {/* Skeleton Columns */}
        <div className="flex flex-1 gap-4 p-4 overflow-hidden">
          {[1, 2, 3, 4].map((col) => (
            <div key={col} className="w-80 shrink-0 rounded-2xl border border-line bg-surface/40 p-2.5 space-y-3">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="h-4 w-24 rounded bg-surface-2 animate-pulse" />
                <div className="h-4 w-6 rounded-full bg-surface-2 animate-pulse" />
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3].map((card) => (
                  <div key={card} className="rounded-xl border border-line bg-surface/80 p-3.5 space-y-2.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
                      <div className="h-3 w-8 rounded bg-surface-2 animate-pulse" />
                    </div>
                    <div className="h-4 w-full rounded bg-surface-2 animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-surface-2 animate-pulse" />
                    <div className="flex justify-between pt-2 border-t border-line/40">
                      <div className="h-3 w-12 rounded bg-surface-2 animate-pulse" />
                      <div className="h-5 w-5 rounded-full bg-surface-2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-xs text-muted">Không thể tải thông tin dự án.</div>
      </div>
    );
  }

  const isUserViewer = isViewer(data.currentRole);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Viewer Notice Banner */}
      {isUserViewer && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 py-1.5 px-4 text-xs text-amber-700">
          <Eye className="h-3.5 w-3.5 text-amber-600" />
          <span>Bạn đang xem dự án ở chế độ <strong>Người xem (Viewer)</strong> — không thể tạo, chỉnh sửa hoặc kéo thả công việc.</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex h-10 sm:h-12 shrink-0 items-center justify-between border-b border-line px-2.5 sm:px-4 gap-2 sm:gap-2.5 bg-surface/40 backdrop-blur-md">
        {/* Breadcrumb & Live Status */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span>Dự án</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted/60" />
            <span className="text-foreground font-bold truncate max-w-[120px] sm:max-w-none">{data.project.name}</span>
          </div>

          {activeSprint && (
            <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-accent flex items-center gap-1 shrink-0">
              <Sparkles className="h-3 w-3" />
              <span className="truncate max-w-[100px] sm:max-w-none">{activeSprint.name}</span>
            </span>
          )}

          {data.currentRole && (
            <span className="hidden md:flex rounded-md bg-surface-2 border border-line px-2 py-0.5 text-[10px] font-bold text-muted font-mono items-center gap-1 shrink-0">
              <Shield className="h-3 w-3 text-accent" />
              {data.currentRole}
            </span>
          )}

          <div
            className={`hidden sm:flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
              connected
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-neutral-800 text-muted"
            }`}
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span>{connected ? "Realtime Live" : "Mất kết nối"}</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Members Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMemberOpen(true)}
            className="h-7 sm:h-7.5 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold border-line bg-surface hover:bg-surface-2 shadow-sm flex items-center gap-1 sm:gap-1.5"
            title="Quản lý thành viên"
          >
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">Thành viên ({data.members.length})</span>
            <span className="sm:hidden">{data.members.length}</span>
          </Button>

          {/* Notion Hub Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNotionOpen(true)}
            className="h-7 sm:h-7.5 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold border-neutral-700 bg-neutral-900 hover:bg-neutral-800 shadow-sm flex items-center gap-1 sm:gap-1.5 text-white"
            title="Notion Hub"
          >
            <span className="flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded bg-neutral-800 text-[9px] sm:text-[10px] font-bold text-white border border-neutral-700">
              N
            </span>
            <span className="hidden sm:inline">Notion Hub</span>
          </Button>

          {/* New Task Button */}
          {canCreateTask(data.currentRole) ? (
            <Button
              size="sm"
              onClick={() => {
                setNewTaskStatus("TODO");
                setNewTaskOpen(true);
              }}
              className="h-7 sm:h-7.5 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25"
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Task mới</span>
              <span className="sm:hidden">Tạo</span>
            </Button>
          ) : (
            <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted font-medium flex items-center gap-1 border border-line">
              <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Chỉ xem</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter & Sorting Control Toolbar — Desktop (>= sm) */}
      <div className="hidden sm:flex items-center justify-between border-b border-line bg-surface/50 px-3.5 sm:px-4 py-1.5 text-xs gap-2.5 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-2 flex-nowrap shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted pointer-events-none z-10" />
            <Input
              ref={searchInputRef}
              placeholder="Tìm task... (bấm /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 sm:h-7.5 w-36 sm:w-52 pl-8 text-[11px] sm:text-xs bg-surface border-line focus:border-accent"
            />
          </div>

          {/* Sprint Filter */}
          <Dropdown
            value={sprintFilter}
            options={[
              { label: "🚀 Tất cả Sprint", value: "ALL" },
              { label: "Chưa gán Sprint (Backlog)", value: "NONE" },
              ...data.sprints.map((s) => ({
                label: `${s.name} (${s.status === "ACTIVE" ? "Đang chạy" : s.status === "COMPLETED" ? "Đã xong" : "Kế hoạch"})`,
                value: s.id,
              })),
            ]}
            onChange={(e) => setSprintFilter(e.value)}
            className="p-inputtext-sm h-7 sm:h-7.5 text-[11px] sm:text-xs bg-surface border border-line rounded-lg"
          />

          {/* Assignee Filter */}
          <Dropdown
            value={assigneeFilter}
            options={[
              { label: "👤 Tất cả nhân sự", value: "ALL" },
              { label: "Chưa giao", value: "UNASSIGNED" },
              ...data.members.map((m) => ({
                label: m.user.name,
                value: m.user.id,
              })),
            ]}
            onChange={(e) => setAssigneeFilter(e.value)}
            className="p-inputtext-sm h-7 sm:h-7.5 text-[11px] sm:text-xs bg-surface border border-line rounded-lg"
          />

          {/* Status Filter */}
          <Dropdown
            value={statusFilter}
            options={[
              { label: "📋 Trạng thái", value: "ALL" },
              ...STATUSES.map((s) => ({ label: s.label, value: s.id })),
            ]}
            onChange={(e) => setStatusFilter(e.value)}
            className="p-inputtext-sm h-7 sm:h-7.5 text-[11px] sm:text-xs bg-surface border border-line rounded-lg"
          />

          {/* Priority Filter */}
          <Dropdown
            value={priorityFilter}
            options={[
              { label: "🔥 Ưu tiên", value: "ALL" },
              ...PRIORITIES.map((p) => ({ label: p.label, value: p.id })),
            ]}
            onChange={(e) => setPriorityFilter(e.value)}
            className="p-inputtext-sm h-7 sm:h-7.5 text-[11px] sm:text-xs bg-surface border border-line rounded-lg"
          />

          {/* Time Filter */}
          <Dropdown
            value={timeFilter}
            options={[
              { label: "⏰ Thời gian", value: "ALL" },
              { label: "Hôm nay", value: "TODAY" },
              { label: "Tuần này", value: "THIS_WEEK" },
              { label: "⚠️ Quá hạn", value: "OVERDUE" },
              { label: "Không hạn", value: "NO_DUE_DATE" },
            ]}
            onChange={(e) => setTimeFilter(e.value)}
            className="p-inputtext-sm h-7 sm:h-7.5 text-[11px] sm:text-xs bg-surface border border-line rounded-lg"
          />

          {/* Type Filter */}
          <Dropdown
            value={typeFilter}
            options={[
              { label: "🏷️ Loại task", value: "ALL" },
              ...TASK_TYPES.map((t) => ({ label: t.label, value: t.id })),
            ]}
            onChange={(e) => setTypeFilter(e.value)}
            className="p-inputtext-sm h-7 sm:h-7.5 text-[11px] sm:text-xs bg-surface border border-line rounded-lg"
          />
        </div>

        {/* Sorting & Clear Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
            <Dropdown
              value={sortBy}
              options={[
                { label: "Kéo thả", value: "MANUAL" },
                { label: "Ưu tiên", value: "PRIORITY" },
                { label: "Hạn chót", value: "DUE_DATE" },
                { label: "Mới nhất", value: "CREATED_AT" },
                { label: "Points", value: "STORY_POINTS" },
                { label: "Tên A-Z", value: "TITLE" },
              ]}
              onChange={(e) => setSortBy(e.value)}
              className="p-inputtext-sm h-6 sm:h-6.5 text-[11px] sm:text-xs bg-surface border-none rounded"
            />

            {sortBy !== "MANUAL" && (
              <button
                onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                className="h-6 sm:h-6.5 px-1 sm:px-1.5 rounded hover:bg-surface-2 text-muted hover:text-foreground cursor-pointer flex items-center text-[11px]"
                title={sortOrder === "asc" ? "Tăng dần" : "Giảm dần"}
              >
                <ArrowUpDown className="h-3 w-3" />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetFilters}
              className="h-7 sm:h-7.5 px-1.5 sm:px-2 text-[11px] sm:text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/15 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Xóa lọc ({activeFilterCount})</span>
              <span className="sm:hidden">({activeFilterCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Sorting Control Toolbar — Mobile compact trigger (< sm) */}
      <div className="flex sm:hidden items-center gap-2 border-b border-line bg-surface/50 px-2.5 py-1.5 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted pointer-events-none z-10" />
          <Input
            placeholder="Tìm task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full pl-8 text-[11px] bg-surface border-line focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setMobileFilterOpen(true)}
          className="relative h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface hover:bg-surface-2 text-muted hover:text-foreground cursor-pointer transition-colors"
          title="Bộ lọc & sắp xếp"
        >
          <Filter className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-background">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Filter & Sort Bottom Sheet (< sm) */}
      {mobileFilterOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative bg-surface border-t border-line rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-accent" />
                Bộ lọc &amp; Sắp xếp
              </h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Dropdown
                value={sprintFilter}
                options={[
                  { label: "🚀 Tất cả Sprint", value: "ALL" },
                  { label: "Chưa gán Sprint (Backlog)", value: "NONE" },
                  ...data.sprints.map((s) => ({
                    label: `${s.name} (${s.status === "ACTIVE" ? "Đang chạy" : s.status === "COMPLETED" ? "Đã xong" : "Kế hoạch"})`,
                    value: s.id,
                  })),
                ]}
                onChange={(e) => setSprintFilter(e.value)}
                className="col-span-2 h-10 text-xs bg-surface border border-line rounded-lg"
              />

              <Dropdown
                value={assigneeFilter}
                options={[
                  { label: "👤 Tất cả nhân sự", value: "ALL" },
                  { label: "Chưa giao", value: "UNASSIGNED" },
                  ...data.members.map((m) => ({
                    label: m.user.name,
                    value: m.user.id,
                  })),
                ]}
                onChange={(e) => setAssigneeFilter(e.value)}
                className="h-10 text-xs bg-surface border border-line rounded-lg"
              />

              <Dropdown
                value={statusFilter}
                options={[
                  { label: "📋 Trạng thái", value: "ALL" },
                  ...STATUSES.map((s) => ({ label: s.label, value: s.id })),
                ]}
                onChange={(e) => setStatusFilter(e.value)}
                className="h-10 text-xs bg-surface border border-line rounded-lg"
              />

              <Dropdown
                value={priorityFilter}
                options={[
                  { label: "🔥 Ưu tiên", value: "ALL" },
                  ...PRIORITIES.map((p) => ({ label: p.label, value: p.id })),
                ]}
                onChange={(e) => setPriorityFilter(e.value)}
                className="h-10 text-xs bg-surface border border-line rounded-lg"
              />

              <Dropdown
                value={timeFilter}
                options={[
                  { label: "⏰ Thời gian", value: "ALL" },
                  { label: "Hôm nay", value: "TODAY" },
                  { label: "Tuần này", value: "THIS_WEEK" },
                  { label: "⚠️ Quá hạn", value: "OVERDUE" },
                  { label: "Không hạn", value: "NO_DUE_DATE" },
                ]}
                onChange={(e) => setTimeFilter(e.value)}
                className="h-10 text-xs bg-surface border border-line rounded-lg"
              />

              <Dropdown
                value={typeFilter}
                options={[
                  { label: "🏷️ Loại task", value: "ALL" },
                  ...TASK_TYPES.map((t) => ({ label: t.label, value: t.id })),
                ]}
                onChange={(e) => setTypeFilter(e.value)}
                className="h-10 text-xs bg-surface border border-line rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted">Sắp xếp theo</span>
              <div className="flex items-center gap-2">
                <Dropdown
                  value={sortBy}
                  options={[
                    { label: "Kéo thả", value: "MANUAL" },
                    { label: "Ưu tiên", value: "PRIORITY" },
                    { label: "Hạn chót", value: "DUE_DATE" },
                    { label: "Mới nhất", value: "CREATED_AT" },
                    { label: "Points", value: "STORY_POINTS" },
                    { label: "Tên A-Z", value: "TITLE" },
                  ]}
                  onChange={(e) => setSortBy(e.value)}
                  className="h-10 flex-1 text-xs bg-surface border border-line rounded-lg"
                />

                {sortBy !== "MANUAL" && (
                  <button
                    onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                    className="h-10 w-10 shrink-0 rounded-lg border border-line bg-surface hover:bg-surface-2 text-muted hover:text-foreground cursor-pointer flex items-center justify-center"
                    title={sortOrder === "asc" ? "Tăng dần" : "Giảm dần"}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="flex-1 h-10 text-xs font-semibold text-amber-600 border-amber-500/30 hover:bg-amber-500/15 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Xóa lọc ({activeFilterCount})
                </Button>
              )}
              <Button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 h-10 text-xs font-bold bg-accent hover:bg-accent/90 text-white"
              >
                Áp dụng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Column Quick Switcher Tab Bar (< lg) */}
      <div className="lg:hidden flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 border-b border-line bg-surface/70 backdrop-blur-md overflow-x-auto no-scrollbar shrink-0">
        {STATUSES.map((status) => {
          const count = (tasksByStatus[status.id] ?? []).length;
          const isSelected = activeMobileColumn === status.id;
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => scrollToMobileColumn(status.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                isSelected
                  ? "bg-surface-3 border-accent text-accent shadow-sm ring-1 ring-accent/40"
                  : "bg-surface-2/60 border-line text-muted hover:text-foreground"
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              <span>{status.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-surface text-muted border border-line/60">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Viewport */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={boardContainerRef}
          onScroll={handleBoardScroll}
          className="flex flex-1 min-h-0 w-full gap-2.5 sm:gap-3 md:gap-3.5 overflow-x-auto p-2 sm:p-3 md:p-3.5 px-2.5 sm:px-3.5 md:px-4 snap-x snap-mandatory touch-pan-x no-scrollbar overflow-y-hidden select-none pb-2.5"
        >
          {STATUSES.map((status) => (
            <BoardColumn
              key={status.id}
              status={status}
              tasks={tasksByStatus[status.id] ?? []}
              onAddTask={() => {
                if (isUserViewer) return;
                setNewTaskStatus(status.id);
                setNewTaskOpen(true);
              }}
              onTaskClick={(id) => setOpenTaskId(id)}
              members={data.members}
              onAssign={isUserViewer ? undefined : quickAssign}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimationConfig}>
          {activeTask ? <TaskCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Dialog */}
      {openTaskId && (
        <TaskDialog
          projectId={projectId}
          projectName={data.project.name}
          taskId={openTaskId}
          tasks={data.tasks}
          members={data.members}
          labels={data.labels}
          sprints={data.sprints}
          onClose={() => {
            setOpenTaskId(null);
            // Dọn ?taskId= khỏi URL khi đóng để link không còn trỏ vào task cũ
            if (urlTaskId) {
              const url = new URL(window.location.href);
              url.searchParams.delete("taskId");
              window.history.replaceState({}, "", url.toString());
            }
          }}
          onChanged={loadBoard}
        />
      )}

      {/* New Task Dialog */}
      <NewTaskDialog
        projectId={projectId}
        open={newTaskOpen}
        defaultStatus={newTaskStatus}
        members={data.members}
        labels={data.labels}
        sprints={data.sprints}
        onOpenChange={setNewTaskOpen}
        onCreated={loadBoard}
      />

      {/* Notion Live Hub Dialog */}
      <NotionDialog
        projectId={projectId}
        open={notionOpen}
        onOpenChange={setNotionOpen}
        onImportSuccess={loadBoard}
      />

      {/* Member Management & RBAC Dialog */}
      <MemberDialog
        projectId={projectId}
        open={memberOpen}
        onOpenChange={setMemberOpen}
        onMembersChanged={loadBoard}
      />
    </div>
  );
}
