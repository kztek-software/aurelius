"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Briefcase,
  Users,
  Building2,
  Rocket,
  LifeBuoy,
  KanbanSquare,
  ChevronRight,
  Activity,
  Calendar,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Check,
  FolderKanban,
  Settings,
  Trash2,
  Loader2,
  Edit3,
  Paperclip,
} from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "primereact/dialog";
import { PROJECT_STATUSES, projectStatusMeta } from "@/lib/constants";
import { canManageMembers } from "@/lib/permissions";
import { Tooltip } from "@/components/ui/tooltip";
import type { ProjectDashboardData } from "@/lib/types";
import { useTabCache } from "@/lib/tab-cache";
import { ProjectAttachmentGallery } from "@/components/project/project-attachment-gallery";
import { useIsClient } from "@/lib/client-store";

const tooltipStyle = {
  backgroundColor: "#181E2E",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: 10,
  fontSize: 11,
  color: "#F1F4F9",
  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
  padding: "6px 10px",
};

export default function ProjectDashboardPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  
  // Trích xuất projectId an toàn kể cả khi useParams chậm/null trên trình duyệt cũ
  let projectId = params?.projectId;
  if (!projectId && typeof window !== "undefined") {
    const match = window.location.pathname.match(/\/projects\/([^\/]+)/);
    if (match) projectId = match[1];
  }

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<"MEMBERS" | "TEAMS" | "DOCS">("MEMBERS");
  // `false` khi SSR/hydrate, `true` sau đó — tránh setState trong useEffect.
  const mounted = useIsClient();

  // Project Settings & Delete State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmKeyInput, setConfirmKeyInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  function handleOpenSettings() {
    if (!data?.project) return;
    setEditName(data.project.name);
    setEditKey(data.project.key);
    setEditDesc(data.project.description || "");
    setEditError("");
    setSettingsOpen(true);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.project || !projectId) return;
    setSavingEdit(true);
    setEditError("");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const token = localStorage.getItem("flowboard_session");
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          name: editName.trim(),
          key: editKey.trim().toUpperCase(),
          description: editDesc.trim() || null,
        }),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(resData?.error || "Không thể lưu thông tin dự án");
        return;
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                name: editName.trim(),
                key: editKey.trim().toUpperCase(),
                description: editDesc.trim() || null,
              },
            }
          : prev
      );
      setSettingsOpen(false);
    } catch {
      setEditError("Lỗi kết nối máy chủ");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!data?.project || !projectId) return;
    if (confirmKeyInput !== data.project.key) return;

    setDeleting(true);
    try {
      const headers: Record<string, string> = {};
      try {
        const token = localStorage.getItem("flowboard_session");
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}

      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers,
      });

      if (res.ok) {
        setDeleteModalOpen(false);
        setSettingsOpen(false);
        router.push("/");
        router.refresh();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Không thể xóa dự án");
      }
    } catch {
      alert("Lỗi khi kết nối xóa dự án");
    } finally {
      setDeleting(false);
    }
  }

  const dashboardApiUrl = projectId ? `/api/projects/${projectId}/dashboard` : null;

  const fetchDashboard = useCallback(async (): Promise<ProjectDashboardData> => {
    if (!projectId) throw new Error("No project ID");
    const headers: Record<string, string> = {};
    try {
      const token = localStorage.getItem("flowboard_session");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {}

    const res = await fetch(`/api/projects/${projectId}/dashboard`, {
      credentials: "same-origin",
      headers,
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json) {
      return json;
    }
    throw new Error(json?.error || "Không thể tải dữ liệu Dashboard dự án");
  }, [projectId]);

  const {
    data,
    loading,
    mutate: setData,
    revalidate: loadDashboard,
  } = useTabCache<ProjectDashboardData>(dashboardApiUrl, fetchDashboard, {
    staleTime: 15000,
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi kết nối máy chủ");
    },
  });

  async function handleStatusChange(newStatus: string) {
    if (!data) return;
    setUpdatingStatus(true);
    setStatusMenuOpen(false);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setData((prev) =>
          prev ? { ...prev, project: { ...prev.project, status: newStatus } } : prev
        );
      }
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-background gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent animate-pulse">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div className="text-xs font-semibold text-muted">Đang tải số liệu Dashboard dự án...</div>
      </div>
    );
  }

  if (!data || errorMsg) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-background p-6 gap-3">
        <div className="rounded-2xl border border-accent/30 bg-accent-subtle p-6 max-w-md text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-accent mx-auto" />
          <div className="text-sm font-bold text-foreground">
            {errorMsg || "Không thể tải dữ liệu Dashboard dự án"}
          </div>
          <div className="text-xs text-muted">
            Vui lòng kiểm tra quyền truy cập dự án hoặc nhấn nút bên dưới để thử lại.
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={loadDashboard}
              className="text-xs font-bold bg-accent hover:bg-accent/90 text-white"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Thử lại
            </Button>
            <Link
              href={`/projects/${projectId}/board`}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-line bg-surface hover:bg-surface-2 text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <KanbanSquare className="h-3.5 w-3.5" /> Mở Board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const {
    project,
    summary,
    activeSprint,
    statusDistribution,
    priorityDistribution,
    memberWorkloads,
    teamBreakdown,
    urgentAndOverdueTasks,
    recentActivities,
    ticketStats,
    currentRole,
  } = data;
  const currentStatusMeta = projectStatusMeta(project.status);
  const hasManageRight = canManageMembers(currentRole);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      {/* Top Header Controls Bar */}
      <div className="flex flex-col sm:flex-row min-h-13 shrink-0 sm:items-center justify-between border-b border-line px-3 sm:px-4 py-2 sm:py-0 bg-surface/50 backdrop-blur-md gap-2">
        {/* Left Project Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-accent/15 border border-accent/30 text-accent font-bold text-xs shrink-0">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-foreground truncate">{project.name}</h1>
            <span className="text-[10px] sm:text-xs font-mono text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-line shrink-0">
              {project.key}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 max-w-full">
          {/* Status Dropdown Selector */}
          <div className="relative shrink-0">
            {hasManageRight ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((v) => !v)}
                  disabled={updatingStatus}
                  className="flex h-8.5 sm:h-9 items-center gap-1.5 px-3 rounded-lg border text-xs font-bold transition-all shadow-sm cursor-pointer hover:opacity-90 shrink-0"
                  style={{
                    backgroundColor: currentStatusMeta.bg,
                    color: currentStatusMeta.color,
                    borderColor: currentStatusMeta.border,
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStatusMeta.color }} />
                  <span className="truncate max-w-[110px] sm:max-w-none">{currentStatusMeta.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 rotate-90 opacity-70 shrink-0" />
                </button>

                {statusMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl backdrop-blur-2xl animate-fade-in-up ring-1 ring-line">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-line/50 mb-1">
                      Cập nhật trạng thái
                    </div>
                    {PROJECT_STATUSES.map((st) => {
                      const isCurrent = project.status === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => handleStatusChange(st.id)}
                          className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                            isCurrent ? "bg-surface-2 font-bold" : "hover:bg-surface-2/60 text-muted hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                            <span style={{ color: st.color }}>{st.label}</span>
                          </div>
                          {isCurrent && <Check className="h-3.5 w-3.5 text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="flex h-8.5 sm:h-9 items-center gap-1.5 px-3 rounded-lg border text-xs font-bold shadow-sm shrink-0"
                style={{
                  backgroundColor: currentStatusMeta.bg,
                  color: currentStatusMeta.color,
                  borderColor: currentStatusMeta.border,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentStatusMeta.color }} />
                <span>{currentStatusMeta.label}</span>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={loadDashboard}
            className="h-8.5 sm:h-9 px-3 text-xs font-semibold border-line bg-surface hover:bg-surface-2 shrink-0 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted" />
            <span className="hidden sm:inline">Tải lại</span>
          </Button>

          <Link
            href={`/projects/${projectId}/board`}
            className="h-8.5 sm:h-9 px-3.5 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 gap-1.5 inline-flex items-center justify-center rounded-md cursor-pointer transition-colors shrink-0"
          >
            <KanbanSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mở Board</span>
            <span className="sm:hidden">Board</span>
          </Link>

          {hasManageRight && (
            <Link
              href={`/projects/${projectId}/all-projects`}
              className="h-8.5 sm:h-9 px-3 text-xs font-bold border border-accent/40 text-accent hover:bg-accent/10 shadow-sm gap-1.5 inline-flex items-center justify-center rounded-md cursor-pointer transition-colors shrink-0"
            >
              <FolderKanban className="h-3.5 w-3.5 text-accent" />
              <span className="hidden md:inline">Tất Cả Dự Án</span>
              <span className="md:hidden">Dự án</span>
            </Link>
          )}

          {hasManageRight && (
            <Tooltip content="Cài đặt & Xóa dự án" side="bottom">
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenSettings}
                className="h-8.5 sm:h-9 w-8.5 sm:w-9 px-0 text-xs font-semibold border-line bg-surface hover:bg-surface-2 text-muted hover:text-foreground shrink-0 flex items-center justify-center"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Main Single-View Dashboard Canvas */}
      <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 overflow-y-auto lg:overflow-hidden w-full max-w-[1920px] mx-auto">
        {/* ROW 1: 5 COMPACT KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
          {/* KPI 1 */}
          <div className="rounded-xl border border-line bg-surface p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-muted">
              <span className="font-bold uppercase tracking-wider text-[9px]">Tiến độ công việc</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-emerald-600 leading-none">{summary.completionRate}%</span>
              <span className="text-[10px] text-muted font-medium">
                {summary.doneTasks}/{summary.totalTasks} việc
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${summary.completionRate}%` }} />
            </div>
          </div>

          {/* KPI 2 */}
          <div className="rounded-xl border border-line bg-surface p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-muted">
              <span className="font-bold uppercase tracking-wider text-[9px]">Điểm Story Points</span>
              <Briefcase className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-accent leading-none">{summary.doneStoryPoints}</span>
              <span className="text-[10px] text-muted font-medium">
                /{summary.totalStoryPoints} pts ({summary.pointsCompletionRate}%)
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${summary.pointsCompletionRate}%` }} />
            </div>
          </div>

          {/* KPI 3 */}
          <div className="rounded-xl border border-line bg-surface p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-muted">
              <span className="font-bold uppercase tracking-wider text-[9px]">Đang thực hiện</span>
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-amber-600 leading-none">{summary.inProgressTasks + summary.inReviewTasks}</span>
              <span className="text-[10px] text-muted font-medium">
                {summary.inProgressTasks} làm • {summary.inReviewTasks} duyệt
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted">
              <span>Chờ làm: {summary.todoTasks}</span>
              <span>Backlog: {summary.backlogTasks}</span>
            </div>
          </div>

          {/* KPI 4 */}
          <div
            className={`rounded-xl border p-2.5 flex flex-col justify-between shadow-sm ${
              summary.overdueTasks > 0 ? "border-accent/40 bg-accent-subtle" : "border-line bg-surface"
            }`}
          >
            <div className="flex items-center justify-between text-muted">
              <span className="font-bold uppercase tracking-wider text-[9px]">Quá hạn & Khẩn cấp</span>
              <AlertTriangle
                className={`h-3.5 w-3.5 ${
                  summary.overdueTasks > 0 ? "text-accent animate-bounce" : "text-muted"
                }`}
              />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-xl font-black leading-none ${
                  summary.overdueTasks > 0 ? "text-accent" : "text-foreground"
                }`}
              >
                {summary.overdueTasks}
              </span>
              <span className="text-[10px] text-accent font-bold">
                {summary.urgentTasks} khẩn cấp
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted">
              <span>{summary.overdueTasks === 0 ? "✓ Đúng tiến độ" : "Cần ưu tiên xử lý"}</span>
            </div>
          </div>

          {/* KPI 5 */}
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-line bg-surface p-2.5 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-muted">
              <span className="font-bold uppercase tracking-wider text-[9px]">Tickets Khách Hàng</span>
              <LifeBuoy className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-purple-600 leading-none">{ticketStats.resolutionRate}%</span>
              <span className="text-[10px] text-muted font-medium">
                {ticketStats.resolved + ticketStats.closed}/{ticketStats.total} xong
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted">
              <span>Mở: {ticketStats.open + ticketStats.triaged}</span>
              <span>Đang sửa: {ticketStats.inProgress}</span>
            </div>
          </div>
        </div>

        {/* ROW 2: ACTIVE SPRINT COMPACT STRIP (IF RUNNING) */}
        {activeSprint && (
          <div className="shrink-0 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2 flex items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-6 w-6 rounded-lg bg-accent text-white flex items-center justify-center shrink-0 shadow-sm shadow-accent/30">
                <Rocket className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent shrink-0">Sprint:</span>
                <span className="font-extrabold text-foreground truncate">{activeSprint.name}</span>
                {activeSprint.goal && (
                  <span className="text-muted text-[11px] truncate hidden md:inline">• {activeSprint.goal}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-[11px]">
              <span className="flex items-center gap-1 text-muted hidden sm:inline-flex">
                <Calendar className="h-3.5 w-3.5 text-accent" />
                {activeSprint.daysRemaining !== null ? `Còn ${activeSprint.daysRemaining} ngày` : "Chưa set hạn"}
              </span>
              <span className="text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {activeSprint.doneTasks}/{activeSprint.totalTasks} việc ({activeSprint.donePoints}/{activeSprint.totalPoints} pts)
              </span>
              <Link
                href={`/projects/${projectId}/sprints`}
                className="h-7.5 px-3 rounded-lg bg-accent text-white hover:bg-accent-hover font-bold text-xs inline-flex items-center gap-1 shadow-md shadow-accent/25 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
              >
                <span>Chi tiết</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ROW 3: SPLIT 2-COLUMN SINGLE-VIEW ANALYTICAL WORKSPACE (ALIGNED 2-ROW GRID) */}
        <div className="flex-1 min-h-0 grid grid-cols-12 lg:grid-rows-2 gap-3 overflow-visible lg:overflow-hidden pb-4 lg:pb-0">
          {/* ROW 1 - LEFT 7 COLS: CHARTS CARD */}
          <div className="col-span-12 lg:col-span-7 lg:row-start-1 h-auto min-h-[380px] sm:min-h-[260px] lg:min-h-0 lg:h-full rounded-xl border border-line bg-surface p-3 flex flex-col shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-line/60 shrink-0">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-accent" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Phân bổ Trạng thái & Mức độ ưu tiên
                </span>
              </div>
              <span className="text-[10px] text-muted font-mono">{summary.totalTasks} công việc</span>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Status Chart */}
              <div className="flex flex-col h-full min-h-0">
                <span className="text-[10px] text-muted font-semibold mb-1 shrink-0">Theo Trạng thái</span>
                <div className="w-full flex-1 min-h-[140px] max-h-[220px]">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusDistribution} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262b36" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#8b93a3" }} />
                        <YAxis tick={{ fontSize: 9, fill: "#8b93a3" }} allowDecimals={false} />
                        <RechartsTooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" name="Số việc" radius={[4, 4, 0, 0]}>
                          {statusDistribution.map((entry) => (
                            <Cell key={entry.status} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted">
                      Đang tải biểu đồ...
                    </div>
                  )}
                </div>
              </div>

              {/* Priority Chart */}
              <div className="flex flex-col h-full min-h-0">
                <span className="text-[10px] text-muted font-semibold mb-1 shrink-0">Theo Mức độ ưu tiên</span>
                <div className="w-full flex-1 min-h-[140px] max-h-[220px]">
                  {mounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priorityDistribution} layout="vertical" margin={{ top: 5, right: 15, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262b36" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: "#8b93a3" }} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: "#8b93a3" }} width={75} />
                        <RechartsTooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" name="Số việc" radius={[0, 4, 4, 0]}>
                          {priorityDistribution.map((entry) => (
                            <Cell key={entry.priority} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted">
                      Đang tải biểu đồ...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 1 - RIGHT 5 COLS: URGENT TASKS CARD */}
          <div className="col-span-12 lg:col-span-5 lg:row-start-1 h-auto min-h-[240px] lg:min-h-0 lg:h-full rounded-xl border border-line bg-surface p-2.5 flex flex-col shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-line/60 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                <span>Công việc cần xử lý gấp ({urgentAndOverdueTasks.length})</span>
              </div>
              <Link
                href={`/projects/${projectId}/board`}
                className="px-2 py-0.5 rounded-md bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                Mở Board <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pt-1.5 space-y-1.5 pr-1">
              {urgentAndOverdueTasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                    t.isOverdue ? "border-accent/40 bg-accent-subtle" : "border-line bg-surface-2/60"
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-muted">#{t.number}</span>
                      <span className="font-semibold text-foreground truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                      {t.isOverdue && (
                        <span className="text-accent font-bold flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> Quá hạn ({t.dueDate?.slice(5, 10)})
                        </span>
                      )}
                      {t.assignee && (
                        <span className="flex items-center gap-1 truncate">
                          <Avatar className="h-3.5 w-3.5 text-[8px]">
                            <AvatarFallback color={t.assignee.avatarColor}>
                              {initials(t.assignee.name)}
                            </AvatarFallback>
                          </Avatar>
                          {t.assignee.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                      t.priority === "URGENT" ? "bg-accent-subtle text-accent" : "bg-surface text-muted"
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>
              ))}

              {urgentAndOverdueTasks.length === 0 && (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
                  🎉 Không có công việc nào bị quá hạn hoặc khẩn cấp!
                </div>
              )}
            </div>
          </div>

          {/* ROW 2 - LEFT 7 COLS: MEMBERS WORKLOAD / TEAMS BREAKDOWN / PROJECT ATTACHMENTS */}
          <div className="col-span-12 lg:col-span-7 lg:row-start-2 h-auto min-h-[280px] lg:min-h-0 lg:h-full rounded-xl border border-line bg-surface flex flex-col overflow-hidden shadow-sm">
            {/* Tabs Header */}
            <div className="flex items-center justify-between border-b border-line px-3 py-1.5 bg-surface-2/40 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setLeftTab("MEMBERS")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    leftTab === "MEMBERS"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <Users className="h-3 w-3" />
                  <span>Năng suất ({memberWorkloads.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTab("TEAMS")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    leftTab === "TEAMS"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <Building2 className="h-3 w-3" />
                  <span>Phòng ban ({teamBreakdown.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTab("DOCS")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    leftTab === "DOCS"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                >
                  <Paperclip className="h-3 w-3" />
                  <span>Tài liệu & Media ({(data?.project?.attachments || []).length})</span>
                </button>
              </div>

              <Link
                href={`/projects/${projectId}/reports`}
                className="px-2 py-0.5 rounded-md bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                Báo cáo KPI <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Tab Content (Scrollable internally) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 overflow-x-auto no-scrollbar">
              {leftTab === "MEMBERS" ? (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead className="text-muted text-[10px] uppercase font-bold border-b border-line/60">
                      <tr>
                        <th className="pb-1.5 pl-2 text-left">Nhân sự</th>
                        <th className="pb-1.5 px-2 text-left">Phòng ban</th>
                        <th className="pb-1.5 px-2 text-right">Tổng việc</th>
                        <th className="pb-1.5 px-2 text-right">Xong</th>
                        <th className="pb-1.5 px-2 text-right">Đang làm</th>
                        <th className="pb-1.5 px-2 text-right">Quá hạn</th>
                        <th className="pb-1.5 pr-2 text-right">Tiến độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40 text-[11px]">
                      {memberWorkloads.map((m) => (
                        <tr key={m.userId} className="hover:bg-surface-2/50 transition-colors">
                          <td className="py-1.5 pl-2 text-left">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5 text-[8px] shrink-0">
                                <AvatarFallback color={m.avatarColor}>
                                  {initials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-foreground truncate max-w-[120px]">{m.name}</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-2 text-left">
                            {m.teamName ? (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block"
                                style={{ backgroundColor: `${m.teamColor}20`, color: m.teamColor || "#6366f1" }}
                              >
                                {m.teamName}
                              </span>
                            ) : (
                              <span className="text-muted/50">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">{m.totalTasks}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-600">{m.doneTasks}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-600">{m.inProgressTasks}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">
                            {m.overdueTasks > 0 ? (
                              <span className="text-accent bg-accent-subtle px-1 rounded text-[9px]">{m.overdueTasks}</span>
                            ) : (
                              <span className="text-muted">0</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-12 h-1 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${m.completionRate}%` }} />
                              </div>
                              <span className="font-extrabold text-emerald-600 text-[10px] w-7 text-right">
                                {m.completionRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : leftTab === "TEAMS" ? (
                <div className="space-y-2">
                  {teamBreakdown.map((team) => (
                    <div key={team.id} className="p-2 rounded-lg border border-line bg-surface-2/50 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                          <span>{team.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted">{team.memberCount} thành viên</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted">
                        <span>Khối lượng: {team.totalTasks} tasks</span>
                        <span className="text-emerald-600 font-semibold">{team.doneTasks} hoàn thành</span>
                      </div>
                      <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: team.color,
                            width: `${team.totalTasks > 0 ? (team.doneTasks / team.totalTasks) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {teamBreakdown.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted">Chưa có phòng ban nào được gán cho dự án</div>
                  )}
                </div>
              ) : (
                <div className="p-1">
                  <ProjectAttachmentGallery
                    projectId={projectId || data?.project?.id || ""}
                    attachments={data?.project?.attachments || []}
                    onAttachmentsChanged={loadDashboard}
                    canUpload={true}
                    canDelete={true}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ROW 2 - RIGHT 5 COLS: REALTIME ACTIVITIES */}
          <div className="col-span-12 lg:col-span-5 lg:row-start-2 h-auto min-h-[280px] lg:min-h-0 lg:h-full rounded-xl border border-line bg-surface p-2.5 flex flex-col shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 border-b border-line/60 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <span>Hoạt động gần đây</span>
              </div>
              <span className="text-[10px] text-muted font-mono">Thời gian thực</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pt-1.5 space-y-1.5 pr-1 divide-y divide-line/40">
              {recentActivities.map((act) => (
                <div key={act.id} className="pt-1.5 first:pt-0 flex items-start gap-2 text-xs">
                  <Avatar className="h-5 w-5 text-[8px] shrink-0 mt-0.5">
                    <AvatarFallback color={act.actor.avatarColor}>
                      {initials(act.actor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-[11px]">
                    <div className="text-foreground leading-tight">
                      <strong className="font-semibold">{act.actor.name}</strong>{" "}
                      <span className="text-muted">{act.detail || act.action}</span>{" "}
                      {act.task && (
                        <span className="font-medium text-accent">#{act.task.number} - {act.task.title}</span>
                      )}
                    </div>
                    <div className="text-[9px] text-muted mt-0.5">
                      {new Date(act.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}

              {recentActivities.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-muted border border-dashed border-line rounded-lg">
                  Chưa có hoạt động nào được ghi nhận
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CÀI ĐẶT & CHỈNH SỬA DỰ ÁN                                       */}
      {/* ========================================================================= */}
      <Dialog
        header="Cài Đặt Dự Án"
        visible={settingsOpen}
        onHide={() => setSettingsOpen(false)}
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
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
          <div className="rounded-xl border border-line bg-surface-2/40 p-3 space-y-2">
            <ProjectAttachmentGallery
              projectId={projectId || data?.project?.id || ""}
              attachments={data?.project?.attachments || []}
              onAttachmentsChanged={loadDashboard}
              compact={true}
            />
          </div>

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
                  setConfirmKeyInput("");
                  setDeleteModalOpen(true);
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
              onClick={() => setSettingsOpen(false)}
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
      {/* MODAL 2: XÁC NHẬN XÓA DỰ ÁN AN TOÀN                                       */}
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
              Toàn bộ Board công việc, {data?.summary.totalTasks || 0} nhiệm vụ (tasks), các Sprint và dữ liệu liên quan của dự án <strong>{data?.project.name}</strong> sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Để xác nhận, vui lòng gõ chính xác mã Key:{" "}
              <span className="font-mono text-accent font-bold">{data?.project.key}</span>
            </Label>
            <Input
              value={confirmKeyInput}
              onChange={(e) => setConfirmKeyInput(e.target.value.toUpperCase())}
              placeholder={`Gõ "${data?.project.key}" vào đây`}
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
              disabled={deleting || confirmKeyInput !== data?.project.key}
              onClick={handleConfirmDelete}
              className="font-bold bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/25"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Xác nhận xóa vĩnh viễn
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
