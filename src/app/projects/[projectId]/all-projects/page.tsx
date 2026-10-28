"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTabCache, setTabCache } from "@/lib/tab-cache";
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Briefcase,
  LayoutDashboard,
  KanbanSquare,
  Edit2,
  Trash2,
  Check,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Layers,
  ArrowUpDown,
  UserCheck,
  Crown,
  Loader2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { Dropdown } from "primereact/dropdown";
import { PROJECT_STATUSES, projectStatusMeta } from "@/lib/constants";
import { MemberDialog } from "@/components/project/member-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { ProjectAttachmentGallery } from "@/components/project/project-attachment-gallery";

type AdminProjectItem = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  ownerId: string;
  owner: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
    title: string | null;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  members: {
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarColor: string;
      title: string | null;
      role: string;
      teamId: string | null;
      team?: { id: string; name: string; code: string; color: string } | null;
    };
  }[];
  teams: { id: string; name: string; code: string; color: string }[];
  metrics: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    totalPoints: number;
    completionRate: number;
    ticketCount: number;
    sprintCount: number;
  };
};

type UserLiteItem = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  title: string | null;
  role: string;
};

interface AllProjectsCacheData {
  projects: AdminProjectItem[];
  allUsers: UserLiteItem[];
}

const ALL_PROJECTS_CACHE_KEY = "kztek_all_projects_cache";

const PROJECT_GRADIENTS = [
  "from-orange-500 to-amber-600",
  "from-blue-600 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-purple-600 to-pink-600",
  "from-[#F05922] to-orange-600",
  "from-cyan-500 to-blue-600",
];

function getProjectGradient(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PROJECT_GRADIENTS.length;
  return PROJECT_GRADIENTS[index];
}

export default function AllProjectsManagementPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const currentProjectId = params.projectId;
  const toast = useRef<Toast>(null);

  const cached = getTabCache<AllProjectsCacheData>(ALL_PROJECTS_CACHE_KEY);

  const [projects, setProjects] = useState<AdminProjectItem[]>(cached?.projects || []);
  const [allUsers, setAllUsers] = useState<UserLiteItem[]>(cached?.allUsers || []);
  const [loading, setLoading] = useState(!cached);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(cached ? true : null);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"createdAt_desc" | "createdAt_asc" | "name_asc" | "tasks_desc">("createdAt_desc");

  // Status changing state per project
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProjectItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("PLANNING");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<AdminProjectItem | null>(null);
  const [confirmKeyInput, setConfirmKeyInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Member Management Dialog State
  const [memberDialogProjectId, setMemberDialogProjectId] = useState<string | null>(null);

  async function loadProjectsData() {
    try {
      const [resProjects, resUsers] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/users"),
      ]);

      if (resProjects.status === 403) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      let nextProjects = projects;
      let nextUsers = allUsers;

      if (resProjects.ok) {
        const data = await resProjects.json();
        nextProjects = data.projects || [];
        setProjects(nextProjects);
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }

      if (resUsers.ok) {
        const uData = await resUsers.json();
        nextUsers = uData.users || [];
        setAllUsers(nextUsers);
      }

      setTabCache(ALL_PROJECTS_CACHE_KEY, {
        projects: nextProjects,
        allUsers: nextUsers,
      });
    } catch {
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được biên async
    loadProjectsData();
  }, []);

  // Thay đổi trạng thái nhanh trực tiếp
  async function handleQuickStatusChange(projectId: string, newStatus: string) {
    if (!newStatus) return;
    setUpdatingStatusId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
        );
        toast.current?.show({
          severity: "success",
          summary: "Thành công",
          detail: "Đã cập nhật trạng thái dự án",
          life: 2500,
        });
      } else {
        const err = await res.json().catch(() => null);
        toast.current?.show({
          severity: "error",
          summary: "Lỗi",
          detail: err?.error || "Không thể cập nhật trạng thái",
          life: 3000,
        });
      }
    } catch {
      toast.current?.show({
        severity: "error",
        summary: "Lỗi",
        detail: "Lỗi kết nối máy chủ khi cập nhật trạng thái",
        life: 3000,
      });
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // Mở modal sửa dự án
  function openEditModal(project: AdminProjectItem) {
    setEditingProject(project);
    setEditName(project.name);
    setEditKey(project.key);
    setEditDesc(project.description || "");
    setEditStatus(project.status || "PLANNING");
    setEditOwnerId(project.ownerId);
    setEditError("");
    setEditModalOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProject) return;
    setSavingEdit(true);
    setEditError("");

    const updatedProjObj: AdminProjectItem = {
      ...editingProject,
      name: editName.trim(),
      key: editKey.trim().toUpperCase(),
      description: editDesc.trim() || null,
      status: editStatus,
      ownerId: editOwnerId,
      owner: editOwnerId ? (allUsers.find((u) => u.id === editOwnerId) as any) : null,
    };

    // Optimistic update tức thì trên UI (< 1ms)
    setProjects((prev) => prev.map((p) => (p.id === editingProject.id ? updatedProjObj : p)));
    setEditModalOpen(false);
    toast.current?.show({
      severity: "success",
      summary: "Thành công",
      detail: "Đã cập nhật thông tin dự án thành công",
      life: 2500,
    });

    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          key: editKey.trim().toUpperCase(),
          description: editDesc.trim() || null,
          status: editStatus,
          ownerId: editOwnerId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Không thể lưu thông tin dự án");
        loadProjectsData();
      }
    } catch {
      setEditError("Lỗi kết nối máy chủ");
      loadProjectsData();
    } finally {
      setSavingEdit(false);
    }
  }

  // Mở modal xóa dự án
  function openDeleteModal(project: AdminProjectItem) {
    setDeletingProject(project);
    setConfirmKeyInput("");
    setDeleteModalOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingProject) return;
    if (confirmKeyInput !== deletingProject.key) return;

    const targetId = deletingProject.id;
    const targetName = deletingProject.name;

    // Optimistic delete tức thì trên UI (< 1ms)
    setDeleteModalOpen(false);
    setProjects((prev) => prev.filter((p) => p.id !== targetId));
    toast.current?.show({
      severity: "success",
      summary: "Đã xóa dự án",
      detail: `Dự án ${targetName} đã được xóa vĩnh viễn`,
      life: 3000,
    });

    if (targetId === currentProjectId) {
      router.push("/");
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${targetId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.current?.show({
          severity: "error",
          summary: "Lỗi xóa dự án",
          detail: err?.error || "Không thể xóa dự án",
          life: 3000,
        });
        loadProjectsData();
      }
    } catch {
      toast.current?.show({
        severity: "error",
        summary: "Lỗi kết nối",
        detail: "Không thể kết nối đến máy chủ",
        life: 3000,
      });
      loadProjectsData();
    } finally {
      setDeleting(false);
    }
  }

  // Thu thập danh sách all teams từ projects
  const allAvailableTeams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string; color: string }>();
    projects.forEach((p) => {
      p.teams.forEach((t) => map.set(t.id, t));
    });
    return Array.from(map.values());
  }, [projects]);

  // Lọc và sắp xếp projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        // Tìm kiếm
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchKey = p.key.toLowerCase().includes(q);
          const matchDesc = p.description?.toLowerCase().includes(q) || false;
          const matchOwner = p.owner?.name.toLowerCase().includes(q) || false;
          if (!matchName && !matchKey && !matchDesc && !matchOwner) return false;
        }

        // Lọc trạng thái
        if (statusFilter !== "ALL" && p.status !== statusFilter) return false;

        // Lọc phòng ban
        if (teamFilter !== "ALL") {
          const hasTeam = p.teams.some((t) => t.id === teamFilter);
          if (!hasTeam) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "createdAt_desc") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === "createdAt_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        if (sortBy === "tasks_desc") return b.metrics.totalTasks - a.metrics.totalTasks;
        return 0;
      });
  }, [projects, searchQuery, statusFilter, teamFilter, sortBy]);

  // Thống kê số liệu hệ thống
  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === "IN_PROGRESS").length;
    const planning = projects.filter((p) => p.status === "PLANNING").length;
    const onHold = projects.filter((p) => p.status === "ON_HOLD").length;
    const completed = projects.filter((p) => p.status === "COMPLETED").length;
    const totalMembers = new Set(projects.flatMap((p) => p.members.map((m) => m.user.id))).size;
    const totalTasks = projects.reduce((sum, p) => sum + p.metrics.totalTasks, 0);

    return { total, inProgress, planning, onHold, completed, totalMembers, totalTasks };
  }, [projects]);

  if (loading && projects.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden bg-background animate-pulse p-4 sm:p-6 space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="h-6 w-44 bg-surface-2 rounded-lg" />
            <div className="h-5 w-24 bg-surface-2/60 rounded-full" />
          </div>
          <div className="h-9 w-32 bg-surface-2 rounded-xl" />
        </div>

        {/* 4 Stats Cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-line bg-surface p-4 flex justify-between items-center">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-surface-2 rounded" />
                <div className="h-6 w-10 bg-surface-2 rounded-lg" />
              </div>
              <div className="h-9 w-9 rounded-xl bg-surface-2" />
            </div>
          ))}
        </div>

        {/* Search & Filter Bar skeleton */}
        <div className="h-12 rounded-2xl border border-line bg-surface p-3 flex items-center justify-between">
          <div className="h-7 w-64 bg-surface-2 rounded-xl" />
          <div className="h-7 w-32 bg-surface-2 rounded-xl" />
        </div>

        {/* Projects Cards Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-3xl border border-line bg-surface p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-surface-2" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-surface-2 rounded" />
                  <div className="h-3 w-20 bg-surface-2 rounded" />
                </div>
              </div>
              <div className="h-12 bg-surface-2/40 rounded-xl" />
              <div className="h-4 w-24 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MÀN HÌNH BẢO VỆ PHÂN QUYỀN 403
  if (isAuthorized === false) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-6">
        <div className="rounded-3xl border border-accent/30 bg-surface p-8 max-w-md text-center space-y-4 shadow-2xl">
          <div className="h-16 w-16 rounded-2xl bg-accent-subtle border border-accent/30 flex items-center justify-center mx-auto text-accent">
            <ShieldAlert className="h-9 w-9 stroke-[2]" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-base font-bold text-foreground">Từ Chối Truy Cập (403 Forbidden)</h1>
            <p className="text-xs text-muted leading-relaxed">
              Bạn không có quyền Quản trị viên (ADMIN) để xem và quản lý toàn bộ các dự án trên hệ thống. Tài khoản của bạn chỉ có thể truy cập các dự án mà bạn được chỉ định tham gia.
            </p>
          </div>
          <div className="pt-2">
            <Link href={`/projects/${currentProjectId}/dashboard`}>
              <Button className="font-bold bg-accent hover:bg-accent/90 text-white text-xs w-full">
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Trở về Dashboard Dự Án Của Bạn
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <Toast ref={toast} />

      {/* Top Bar Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-6 bg-surface/50 backdrop-blur-md gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs shrink-0">
            <FolderKanban className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground truncate">
                Quản Lý Tất Cả Dự Án Hệ Thống
              </h1>
              <span className="rounded bg-accent/20 border border-accent/40 px-1.5 py-0.2 text-[9px] font-black text-accent">
                ADMIN ONLY
              </span>
            </div>
            <div className="text-[11px] text-muted truncate">
              Tổng quan, điều phối phân quyền và kiểm soát toàn bộ dự án KZTEK
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Tooltip content="Làm mới và tải lại danh sách dự án" side="bottom">
            <Button
              size="sm"
              variant="outline"
              onClick={loadProjectsData}
              className="h-8.5 text-xs font-semibold border-line bg-surface hover:bg-surface-2"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1 text-muted" /> Làm mới
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1700px] w-full mx-auto">
        {/* ========================================================================= */}
        {/* ROW 1: 4 SYSTEM KPI METRIC CARDS                                         */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Tổng số dự án</span>
              <FolderKanban className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-foreground">{stats.total}</span>
              <span className="text-xs text-muted font-medium">{stats.totalMembers} nhân sự</span>
            </div>
            <div className="mt-2 text-[10px] text-muted flex items-center gap-1">
              <span>Toàn bộ dự án đã khởi tạo trên hệ thống</span>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Đang thực hiện</span>
              <Briefcase className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600">{stats.inProgress}</span>
              <span className="text-xs text-emerald-600/80 font-bold">
                {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}% tổng dự án
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted">
              Đang hoạt động và có task đang chạy
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Lên kế hoạch / Tạm dừng</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-600">{stats.planning + stats.onHold}</span>
              <span className="text-xs text-muted font-medium">
                {stats.planning} chuẩn bị • {stats.onHold} dừng
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted">
              Cần phân bổ thêm nguồn lực hoặc chờ triển khai
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Dự án hoàn thành</span>
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-600">{stats.completed}</span>
              <span className="text-xs text-muted font-medium">
                {stats.totalTasks} tasks hệ thống
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted">
              Đã nghiệm thu và bàn giao thành công
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROW 2: MULTI-FILTER TOOLBAR                                               */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none z-10" />
              <Input
                type="text"
                placeholder="Tìm kiếm dự án theo tên, mã key, mô tả hoặc chủ dự án..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded-xl border border-line bg-surface-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                  title="Xóa từ khóa tìm kiếm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <Dropdown
                value={statusFilter}
                options={[
                  { label: `Tất cả trạng thái (${projects.length})`, value: "ALL" },
                  ...PROJECT_STATUSES.map((st) => ({ label: st.label, value: st.id })),
                ]}
                onChange={(e) => setStatusFilter(e.value)}
                placeholder="Trạng thái"
                className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-xl"
              />

              {/* Department Filter */}
              <Dropdown
                value={teamFilter}
                options={[
                  { label: "Tất cả phòng ban", value: "ALL" },
                  ...allAvailableTeams.map((tm) => ({ label: tm.name, value: tm.id })),
                ]}
                onChange={(e) => setTeamFilter(e.value)}
                placeholder="Phòng ban"
                className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-xl"
              />

              {/* Sorting */}
              <Dropdown
                value={sortBy}
                options={[
                  { label: "Mới nhất trước", value: "createdAt_desc" },
                  { label: "Cũ nhất trước", value: "createdAt_asc" },
                  { label: "Tên A-Z", value: "name_asc" },
                  { label: "Nhiều task nhất", value: "tasks_desc" },
                ]}
                onChange={(e) => setSortBy(e.value)}
                placeholder="Sắp xếp"
                className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ROW 3: ALL PROJECTS DATA TABLE                                           */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-surface-2/40">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-accent" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Danh sách dự án ({filteredProjects.length} / {projects.length})
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[960px]">
              <thead className="border-b border-line bg-surface-2/60 text-muted uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Thông tin dự án</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5">Chủ dự án (Owner)</th>
                  <th className="px-4 py-3.5">Phòng ban & Nhân sự</th>
                  <th className="px-4 py-3.5 text-center">Tiến độ & Task</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap min-w-[200px]">Hành động quản trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredProjects.map((p) => {
                  const sMeta = projectStatusMeta(p.status);
                  const isUpdatingStatus = updatingStatusId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-surface-2/50 transition-colors group">
                      {/* Column 1: Project Info */}
                      <td className="px-5 py-4 font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono font-bold text-xs text-white shadow-sm bg-gradient-to-br ${getProjectGradient(
                              p.key
                            )}`}
                          >
                            {p.key.slice(0, 3)}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <div className="font-bold text-foreground text-xs truncate flex items-center gap-1.5">
                              <span>{p.name}</span>
                              <span className="font-mono text-[10px] text-accent bg-accent/15 px-1.5 py-0.1 rounded border border-accent/30 font-bold">
                                {p.key}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted truncate mt-0.5">
                              {p.description || "Chưa có mô tả mục tiêu"}
                            </div>
                            <div className="text-[10px] text-muted/80 font-mono mt-0.5">
                              Tạo ngày: {new Date(p.createdAt).toLocaleDateString("vi-VN")}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Status with PrimeReact Dropdown (Never Clipped) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Dropdown
                          value={p.status}
                          options={[...PROJECT_STATUSES]}
                          optionLabel="label"
                          optionValue="id"
                          onChange={(e) => handleQuickStatusChange(p.id, e.value)}
                          disabled={isUpdatingStatus}
                          appendTo={typeof document !== "undefined" ? document.body : undefined}
                          className="h-8 text-xs font-bold rounded-xl border shadow-sm transition-all"
                          style={{
                            backgroundColor: sMeta.bg,
                            color: sMeta.color,
                            borderColor: sMeta.border,
                          }}
                          valueTemplate={(option) => {
                            const meta = option ? projectStatusMeta(option.id) : sMeta;
                            return (
                              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
                                {isUpdatingStatus ? (
                                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                ) : (
                                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                                )}
                                <span>{meta.label}</span>
                              </div>
                            );
                          }}
                          itemTemplate={(option) => (
                            <div className="flex items-center justify-between gap-3 text-xs py-0.5">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: option.color }} />
                                <span style={{ color: option.color }} className="font-semibold">{option.label}</span>
                              </div>
                              {p.status === option.id && <Check className="h-3.5 w-3.5 text-accent" />}
                            </div>
                          )}
                          panelClassName="border border-line bg-surface rounded-2xl shadow-2xl p-1 text-xs"
                        />
                      </td>

                      {/* Column 3: Owner */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 text-[10px] shrink-0 border border-white/10">
                            <AvatarFallback color={p.owner?.avatarColor || "#F05922"}>
                              {initials(p.owner?.name || "AD")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground text-xs truncate flex items-center gap-1">
                              <span>{p.owner?.name || "Chưa gán"}</span>
                              <Crown className="h-3 w-3 text-amber-600 shrink-0" />
                            </div>
                            <div className="text-[10px] text-muted truncate font-mono">
                              {p.owner?.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Teams & Members */}
                      <td className="px-4 py-4">
                        <div className="space-y-1.5 max-w-[200px]">
                          {/* Teams Badges */}
                          <div className="flex flex-wrap gap-1">
                            {p.teams.map((tm) => (
                              <span
                                key={tm.id}
                                className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold"
                                style={{
                                  backgroundColor: `${tm.color}20`,
                                  color: tm.color,
                                  border: `1px solid ${tm.color}35`,
                                }}
                              >
                                {tm.name}
                              </span>
                            ))}
                            {p.teams.length === 0 && (
                              <span className="text-[10px] text-muted italic">Chưa gán phòng ban</span>
                            )}
                          </div>

                          {/* Member count */}
                          <div className="text-[10px] text-muted flex items-center gap-1 font-medium">
                            <Users className="h-3 w-3 text-accent" />
                            <span>{p.memberCount} thành viên tham gia</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 5: Progress & Task Metrics */}
                      <td className="px-4 py-4 text-center">
                        <div className="space-y-1 max-w-[130px] mx-auto">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-600">
                              {p.metrics.doneTasks}/{p.metrics.totalTasks} tasks
                            </span>
                            <span className="font-bold text-foreground">
                              {p.metrics.completionRate}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${p.metrics.completionRate}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-muted flex items-center justify-between">
                            <span>{p.metrics.totalPoints} pts</span>
                            <span>{p.metrics.ticketCount} tickets</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 6: Admin Action Buttons (Clean Horizontal Row, No Outer Border, Spacious Gap) */}
                      <td className="px-5 py-4 text-right whitespace-nowrap min-w-[220px]">
                        <div className="inline-flex items-center justify-end gap-3.5 shrink-0 flex-nowrap">
                          {/* Dashboard Link */}
                          <Tooltip content="Mở Dashboard phân tích & chỉ số" side="top">
                            <Link
                              href={`/projects/${p.id}/dashboard`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-all cursor-pointer shrink-0"
                            >
                              <LayoutDashboard className="h-4 w-4" />
                            </Link>
                          </Tooltip>

                          {/* Board Link */}
                          <Tooltip content="Mở bảng công việc (Board Kanban)" side="top">
                            <Link
                              href={`/projects/${p.id}/board`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-all cursor-pointer shrink-0"
                            >
                              <KanbanSquare className="h-4 w-4" />
                            </Link>
                          </Tooltip>

                          {/* Manage Members Modal Button */}
                          <Tooltip content="Quản lý thành viên & phân quyền" side="top">
                            <button
                              type="button"
                              onClick={() => setMemberDialogProjectId(p.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-emerald-600 hover:bg-emerald-500/10 transition-all cursor-pointer shrink-0"
                            >
                              <Users className="h-4 w-4" />
                            </button>
                          </Tooltip>

                          {/* Edit Project Button */}
                          <Tooltip content="Chỉnh sửa thông tin & chuyển giao chủ dự án" side="top">
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-blue-600 hover:bg-blue-500/10 transition-all cursor-pointer shrink-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </Tooltip>

                          {/* Delete Project Button */}
                          <Tooltip content="Xóa dự án khỏi hệ thống" side="top">
                            <button
                              type="button"
                              onClick={() => openDeleteModal(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-all cursor-pointer shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted text-xs">
                      Không tìm thấy dự án nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CHỈNH SỬA DỰ ÁN & CHUYỂN GIAO CHỦ DỰ ÁN                          */}
      {/* ========================================================================= */}
      <Dialog
        header="Chỉnh Sửa Thông Tin Dự Án"
        visible={editModalOpen}
        onHide={() => setEditModalOpen(false)}
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
          {editError && (
            <div className="rounded-xl bg-accent-subtle border border-accent/30 p-2.5 text-xs text-accent font-medium">
              {editError}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tên dự án *</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xs h-9 bg-surface-2"
              required
              minLength={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mã Key dự án *</Label>
              <Input
                value={editKey}
                onChange={(e) => setEditKey(e.target.value.toUpperCase())}
                className="text-xs h-9 bg-surface-2 font-mono uppercase"
                required
                minLength={2}
                maxLength={6}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Trạng thái dự án</Label>
              <Dropdown
                value={editStatus}
                options={PROJECT_STATUSES.map((st) => ({
                  label: st.label,
                  value: st.id,
                }))}
                onChange={(e) => setEditStatus(e.value)}
                className="w-full h-9 text-xs bg-surface-2 border border-line rounded-xl"
              />
            </div>
          </div>

          {/* Chuyển giao Chủ dự án */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Chủ dự án (Owner)</Label>
              <span className="text-[10px] text-amber-600 font-medium">Toàn quyền quản trị dự án</span>
            </div>
            <Dropdown
              value={editOwnerId}
              options={allUsers.map((u) => ({
                label: `${u.name} (${u.email})${u.title ? ` — ${u.title}` : ""}`,
                value: u.id,
              }))}
              onChange={(e) => setEditOwnerId(e.value)}
              className="w-full h-9 text-xs bg-surface-2 border border-line rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả mục tiêu dự án</Label>
            <Textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="text-xs bg-surface-2"
              placeholder="Mô tả phạm vi và mục tiêu triển khai..."
            />
          </div>

          {/* Quản lý tệp tài liệu dự án */}
          {editingProject && (
            <div className="rounded-xl border border-line bg-surface-2/40 p-3 space-y-2">
              <ProjectAttachmentGallery
                projectId={editingProject.id}
                compact={true}
              />
            </div>
          )}

          {/* Danger Zone: Xóa dự án */}
          <div className="rounded-xl border border-accent/30 bg-accent-subtle p-3 space-y-2 mt-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Khu vực nguy hiểm: Xóa dự án
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  Xóa vĩnh viễn dự án này cùng toàn bộ công việc, sprint và dữ liệu liên quan.
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditModalOpen(false);
                  if (editingProject) openDeleteModal(editingProject);
                }}
                className="text-xs font-bold text-accent hover:bg-accent-subtle border border-accent/30 shrink-0"
              >
                Xóa dự án này
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingEdit}
              className="font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25"
            >
              {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: XÓA DỰ ÁN AN TOÀN (YÊU CẦU NHẬP MÃ KEY XÁC NHẬN)                */}
      {/* ========================================================================= */}
      <Dialog
        header="Xác Nhận Xóa Dự Án Vĩnh Viễn"
        visible={deleteModalOpen}
        onHide={() => setDeleteModalOpen(false)}
        className="w-full max-w-md border border-accent/40 bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-4 pt-2">
          <div className="rounded-xl bg-accent-subtle border border-accent/30 p-3 text-xs text-foreground space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-accent">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              CẢNH BÁO NGUY HIỂM: Hành động không thể hoàn tác!
            </div>
            <p>
              Toàn bộ Board công việc, {deletingProject?.metrics.totalTasks} nhiệm vụ (tasks), các Sprint và dữ liệu liên quan của dự án <strong>{deletingProject?.name}</strong> sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Để xác nhận, vui lòng gõ chính xác mã Key:{" "}
              <span className="font-mono text-accent font-bold">{deletingProject?.key}</span>
            </Label>
            <Input
              value={confirmKeyInput}
              onChange={(e) => setConfirmKeyInput(e.target.value.toUpperCase())}
              placeholder={`Gõ "${deletingProject?.key}" vào đây`}
              className="text-xs h-9 bg-surface-2 font-mono uppercase"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={deleting || confirmKeyInput !== deletingProject?.key}
              onClick={handleConfirmDelete}
              className="font-bold bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/25"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Xác nhận xóa vĩnh viễn
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 3: PHÂN QUYỀN & THÀNH VIÊN DỰ ÁN                                    */}
      {/* ========================================================================= */}
      {memberDialogProjectId && (
        <MemberDialog
          projectId={memberDialogProjectId}
          open={!!memberDialogProjectId}
          onOpenChange={(open) => {
            if (!open) {
              setMemberDialogProjectId(null);
              loadProjectsData();
            }
          }}
          onMembersChanged={() => loadProjectsData()}
        />
      )}
    </div>
  );
}
