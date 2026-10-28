"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Search,
  Plus,
  Filter,
  ExternalLink,
  KanbanSquare,
  Bug,
  HelpCircle,
  Sparkles,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Building,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Flame,
  ArrowUpDown,
  Mail,
  FolderKanban,
  ArrowRightLeft,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Paginator, type PaginatorPageChangeEvent } from "primereact/paginator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TicketDrawer } from "./ticket-drawer";
import type { CustomerTicketDto, SprintDto, MemberDto, ProjectDto } from "@/lib/types";

interface TicketListViewProps {
  project: ProjectDto;
  sprints: SprintDto[];
  members: MemberDto[];
  initialTickets: CustomerTicketDto[];
  initialStats: {
    total: number;
    open: number;
    triaged: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
}

export function TicketListView({
  project,
  sprints,
  members,
  initialTickets,
  initialStats,
}: TicketListViewProps) {
  const [tickets, setTickets] = useState<CustomerTicketDto[]>(initialTickets);
  const [stats, setStats] = useState<{
    total: number;
    open: number;
    triaged: number;
    inProgress: number;
    resolved: number;
    closed: number;
    unassigned?: number;
  }>(initialStats);
  const [loading, setLoading] = useState(false);

  // Scope & Admin Dispatch filters
  const [scopeFilter, setScopeFilter] = useState<"PROJECT" | "UNASSIGNED" | "ALL">("PROJECT");
  const [allProjects, setAllProjects] = useState<Array<{ id: string; name: string; key: string }>>([]);
  const [userRole, setUserRole] = useState<string>("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Pagination State
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(10);

  // Selected Ticket for Drawer
  const [selectedTicket, setSelectedTicket] = useState<CustomerTicketDto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Create Ticket Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<"BUG" | "SUPPORT" | "FEATURE_REQ" | "INQUIRY">("BUG");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");
  const [newEnvironment, setNewEnvironment] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scope", scopeFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/projects/${project.id}/tickets?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets);
        setStats(data.stats);
        if (data.allProjects) setAllProjects(data.allProjects);
        if (data.userRole) setUserRole(data.userRole);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách ticket:", err);
    } finally {
      setLoading(false);
    }
  }

  const isFirstRender = useRef(true);
  useEffect(() => {
    // Dữ liệu ban đầu (initialTickets/initialStats) đã được server render sẵn đúng bộ lọc mặc định
    // -> bỏ qua lần fetch đầu tiên để tránh gọi API thừa và tránh bảng bị mờ ngay khi vừa vào trang.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchTickets();
  }, [scopeFilter, statusFilter, priorityFilter, typeFilter]);

  // Reset trang về 1 khi thay đổi bộ lọc hoặc tìm kiếm.
  // Điều chỉnh ngay trong lúc render (thay vì useEffect) để tránh render thừa
  // với danh sách đã phân trang sai — xem "Adjusting state when a prop changes".
  const filterKey = `${scopeFilter}|${statusFilter}|${priorityFilter}|${typeFilter}|${search}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setFirst(0);
  }

  // Cắt lát danh sách ticket theo trang hiện tại
  const paginatedTickets = useMemo(() => {
    return tickets.slice(first, first + rows);
  }, [tickets, first, rows]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchTickets();
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!newCustomerName.trim() || !newCustomerEmail.trim() || !newTitle.trim() || !newDescription.trim()) {
      setCreateError("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          type: newType,
          priority: newPriority,
          customerName: newCustomerName.trim(),
          customerEmail: newCustomerEmail.trim(),
          customerPhone: newCustomerPhone.trim() || null,
          customerCompany: newCustomerCompany.trim() || null,
          environment: newEnvironment.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Không thể tạo ticket");
      } else {
        setCreateModalOpen(false);
        // Reset form
        setNewTitle("");
        setNewDescription("");
        setNewCustomerName("");
        setNewCustomerEmail("");
        setNewCustomerPhone("");
        setNewCustomerCompany("");
        setNewEnvironment("");
        await fetchTickets();
        setSelectedTicket(data.ticket);
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error("Lỗi tạo ticket:", err);
      setCreateError("Lỗi kết nối máy chủ");
    } finally {
      setCreating(false);
    }
  }

  const statusBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
    OPEN: { label: "Mới tiếp nhận", bg: "bg-blue-500/15", text: "text-blue-600", border: "border-blue-500/30" },
    TRIAGED: { label: "Đã phân loại", bg: "bg-purple-500/15", text: "text-purple-600", border: "border-purple-500/30" },
    IN_PROGRESS: { label: "Đang xử lý", bg: "bg-amber-500/15", text: "text-amber-600", border: "border-amber-500/30" },
    RESOLVED: { label: "Đã giải quyết", bg: "bg-emerald-500/15", text: "text-emerald-600", border: "border-emerald-500/30" },
    CLOSED: { label: "Đã đóng", bg: "bg-slate-500/15", text: "text-slate-600", border: "border-slate-500/30" },
    REJECTED: { label: "Từ chối", bg: "bg-accent/15", text: "text-accent", border: "border-accent/30" },
  };

  const priorityBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
    LOW: { label: "Thấp", bg: "bg-slate-500/15", text: "text-slate-400", border: "border-slate-500/30" },
    MEDIUM: { label: "Trung bình", bg: "bg-yellow-500/15", text: "text-yellow-600", border: "border-yellow-500/30" },
    HIGH: { label: "Cao", bg: "bg-orange-500/15", text: "text-orange-500", border: "border-orange-500/30" },
    URGENT: { label: "Khẩn cấp", bg: "bg-accent/15", text: "text-accent", border: "border-accent/30" },
  };

  const typeIcons: Record<string, any> = {
    BUG: Bug,
    SUPPORT: Wrench,
    FEATURE_REQ: Sparkles,
    INQUIRY: HelpCircle,
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header Bar */}
      <div className="p-4 sm:p-6 border-b border-line bg-surface/80 backdrop-blur-md shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/30 shadow-md">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                  Hộp Thư Ticket & Báo Lỗi Khách Hàng
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                  {project.key}
                </span>
              </div>
              <p className="text-xs text-muted">
                Tiếp nhận sự cố từ portal công khai, phân loại và chuyển đổi trực tiếp sang Kanban Board.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href={`/portal/${project.key}`}
              target="_blank"
              className="h-9 px-3.5 rounded-xl border border-line bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>Cổng Portal Khách Hàng</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <Button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="h-9 px-4 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-xl shadow-md shadow-accent/25 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Ghi Nhận Ticket Mới</span>
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div
            onClick={() => setStatusFilter("ALL")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "border-accent bg-accent/10 shadow-md ring-1 ring-accent/30"
                : "border-line bg-surface-2/60 hover:bg-surface-2"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Tổng số ticket</div>
            <div className="text-xl font-black text-foreground mt-1">{stats.total}</div>
          </div>

          <div
            onClick={() => setStatusFilter("OPEN")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "OPEN"
                ? "border-blue-500 bg-blue-950/30 shadow-md ring-1 ring-blue-500/40"
                : "border-line bg-surface-2/60 hover:bg-surface-2"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Mới tiếp nhận</div>
            <div className="text-xl font-black text-blue-400 mt-1">{stats.open}</div>
          </div>

          <div
            onClick={() => setStatusFilter("IN_PROGRESS")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "IN_PROGRESS"
                ? "border-amber-500 bg-amber-950/30 shadow-md ring-1 ring-amber-500/40"
                : "border-line bg-surface-2/60 hover:bg-surface-2"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Đang xử lý / Kanban</div>
            <div className="text-xl font-black text-amber-400 mt-1">{stats.inProgress}</div>
          </div>

          <div
            onClick={() => setStatusFilter("RESOLVED")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === "RESOLVED"
                ? "border-emerald-500 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/40"
                : "border-line bg-surface-2/60 hover:bg-surface-2"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Đã giải quyết</div>
            <div className="text-xl font-black text-emerald-400 mt-1">{stats.resolved}</div>
          </div>
        </div>
      </div>

      {/* Scope Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-line bg-surface-2/40 px-3 sm:px-6 pt-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setScopeFilter("PROJECT")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            scopeFilter === "PROJECT"
              ? "border-accent text-accent bg-surface/50 rounded-t-lg"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5 text-accent" />
          <span>Dự án này ({project.name})</span>
        </button>

        <button
          type="button"
          onClick={() => setScopeFilter("UNASSIGNED")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            scopeFilter === "UNASSIGNED"
              ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-surface/50 rounded-t-lg"
              : "border-transparent text-muted hover:text-amber-700 dark:hover:text-amber-300"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Chờ Admin Điều Phối</span>
          {typeof stats.unassigned === "number" && stats.unassigned > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-black border border-amber-400/50 dark:border-amber-500/30">
              {stats.unassigned}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setScopeFilter("ALL")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            scopeFilter === "ALL"
              ? "border-purple-400 text-purple-400 bg-surface/50 rounded-t-lg"
              : "border-transparent text-muted hover:text-purple-300"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-purple-400" />
          <span>Tất Cả Tickets Hệ Thống</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 sm:px-6 border-b border-line bg-surface/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none z-10" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã TK-XXXX, tiêu đề, tên hoặc email khách..."
            className="pl-9 h-8 bg-surface-2 border-line text-xs"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <Dropdown
            value={statusFilter}
            options={[
              { label: "Mọi trạng thái", value: "ALL" },
              { label: "Mới (OPEN)", value: "OPEN" },
              { label: "Đã phân loại (TRIAGED)", value: "TRIAGED" },
              { label: "Đang xử lý (IN_PROGRESS)", value: "IN_PROGRESS" },
              { label: "Đã giải quyết (RESOLVED)", value: "RESOLVED" },
              { label: "Đã đóng (CLOSED)", value: "CLOSED" },
              { label: "Từ chối (REJECTED)", value: "REJECTED" },
            ]}
            onChange={(e) => setStatusFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          {/* Priority filter */}
          <Dropdown
            value={priorityFilter}
            options={[
              { label: "Mọi mức độ", value: "ALL" },
              { label: "Khẩn cấp", value: "URGENT" },
              { label: "Cao", value: "HIGH" },
              { label: "Trung bình", value: "MEDIUM" },
              { label: "Thấp", value: "LOW" },
            ]}
            onChange={(e) => setPriorityFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          {/* Type filter */}
          <Dropdown
            value={typeFilter}
            options={[
              { label: "Mọi loại lỗi", value: "ALL" },
              { label: "Lỗi phần mềm", value: "BUG" },
              { label: "Hỗ trợ kỹ thuật", value: "SUPPORT" },
              { label: "Tính năng mới", value: "FEATURE_REQ" },
              { label: "Hỏi đáp", value: "INQUIRY" },
            ]}
            onChange={(e) => setTypeFilter(e.value)}
            className="p-inputtext-sm h-8 text-xs font-semibold bg-surface-2 border border-line rounded-lg"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTickets}
            className="h-8 px-2 text-xs text-muted hover:text-foreground"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Table / List View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading && tickets.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-xs font-semibold text-muted flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-accent" />
              Đang tải danh sách ticket...
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-20 text-center space-y-3 rounded-2xl border border-line/60 bg-surface/30">
            <div className="w-12 h-12 rounded-full bg-surface-2 text-muted flex items-center justify-center mx-auto">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Chưa có ticket nào phù hợp</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Không tìm thấy ticket báo lỗi theo tiêu chí lọc hiện tại, hoặc chưa có khách hàng gửi báo lỗi.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl border border-line bg-surface/90 overflow-hidden shadow-xl transition-opacity",
              loading && "opacity-50 pointer-events-none"
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line bg-surface-2/80 text-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Mã Tra Cứu</th>
                    <th className="py-3 px-4">Tiêu Đề Sự Cố</th>
                    <th className="py-3 px-4">Dự Án Phụ Trách</th>
                    <th className="py-3 px-4">Khách Hàng</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                    <th className="py-3 px-4">Ưu Tiên</th>
                    <th className="py-3 px-4">Kanban Task</th>
                    <th className="py-3 px-4 text-right">Thời Gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {paginatedTickets.map((t) => {
                    const statusMeta = statusBadges[t.status] || statusBadges.OPEN;
                    const priorityMeta = priorityBadges[t.priority] || priorityBadges.MEDIUM;
                    const TypeIcon = typeIcons[t.type] || Bug;

                    return (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setSelectedTicket(t);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-surface-2/80 transition-colors cursor-pointer group"
                      >
                        {/* Tracking Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-accent">
                          <span className="group-hover:underline">{t.trackingCode}</span>
                        </td>

                        {/* Title & Type */}
                        <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className="w-3.5 h-3.5 text-muted shrink-0" />
                            <span className="font-bold text-foreground group-hover:text-accent transition-colors truncate">
                              {t.title}
                            </span>
                            {t._count && t._count.comments > 0 ? (
                              <span className="px-1.5 py-0.1 rounded text-[9px] bg-surface-3 text-muted border border-line">
                                {t._count.comments}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Project Assignment */}
                        <td className="py-3.5 px-4">
                          {t.project ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-surface-3 text-foreground border border-line">
                              <FolderKanban className="w-3 h-3 text-accent" />
                              <span>{t.project.name}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50 dark:border-amber-500/40">
                              <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                              <span>Chờ điều phối</span>
                            </span>
                          )}
                        </td>

                        {/* Customer Info */}
                        <td className="py-3.5 px-4">
                          <div className="truncate font-medium text-foreground">{t.customerName}</div>
                          <div className="truncate text-[10px] text-muted font-mono">{t.customerEmail}</div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityMeta.bg} ${priorityMeta.text} ${priorityMeta.border}`}
                          >
                            {priorityMeta.label}
                          </span>
                        </td>

                        {/* Converted Kanban Task */}
                        <td className="py-3.5 px-4">
                          {t.convertedTaskId && t.convertedTask ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-500 border border-purple-500/30">
                              <KanbanSquare className="w-3 h-3 text-purple-500" />
                              <span>#{t.convertedTask.number}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted">Chưa tạo</span>
                          )}
                        </td>

                        {/* Time */}
                        <td className="py-3.5 px-4 text-right text-[11px] text-muted font-mono">
                          {format(new Date(t.createdAt), "dd/MM/yyyy HH:mm")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-line bg-surface-2/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted font-medium">
                Hiển thị <strong className="text-foreground">{tickets.length > 0 ? first + 1 : 0}</strong> -{" "}
                <strong className="text-foreground">{Math.min(first + rows, tickets.length)}</strong> trên tổng số{" "}
                <strong className="text-foreground">{tickets.length}</strong> ticket
              </div>
              <Paginator
                first={first}
                rows={rows}
                totalRecords={tickets.length}
                rowsPerPageOptions={[5, 10, 20, 50]}
                onPageChange={(e: PaginatorPageChangeEvent) => {
                  setFirst(e.first);
                  setRows(e.rows);
                }}
                className="!bg-transparent !p-0 !border-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details Drawer */}
      <TicketDrawer
        ticket={selectedTicket}
        projectId={project.id}
        sprints={sprints}
        members={members}
        allProjects={allProjects}
        userRole={userRole}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onTicketUpdated={async () => {
          await fetchTickets();
          if (selectedTicket) {
            const res = await fetch(`/api/tickets/${selectedTicket.id}`);
            const data = await res.json();
            if (res.ok && data.ticket) setSelectedTicket(data.ticket);
          }
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL: TẠO TICKET BÁO LỖI NỘI BỘ (STAFF INTAKE MODAL)                    */}
      {/* ========================================================================= */}
      <Dialog
        header="Ghi Nhận Ticket Báo Lỗi Khách Hàng (Nội Bộ)"
        visible={createModalOpen}
        onHide={() => setCreateModalOpen(false)}
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 pt-2 text-xs">
          {createError && (
            <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên khách hàng *</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nguyễn Văn A..."
                className="h-8 bg-surface-2 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Email khách hàng *</Label>
              <Input
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="customer@domain.com..."
                className="h-8 bg-surface-2 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Số điện thoại</Label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="0912..."
                className="h-8 bg-surface-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Đơn vị / Công ty</Label>
              <Input
                value={newCustomerCompany}
                onChange={(e) => setNewCustomerCompany(e.target.value)}
                placeholder="KZTEK..."
                className="h-8 bg-surface-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Phân loại</Label>
              <Dropdown
                value={newType}
                options={[
                  { label: "Báo lỗi phần mềm (BUG)", value: "BUG" },
                  { label: "Hỗ trợ kỹ thuật (SUPPORT)", value: "SUPPORT" },
                  { label: "Tính năng mới (FEATURE_REQ)", value: "FEATURE_REQ" },
                  { label: "Hỏi đáp & Tư vấn (INQUIRY)", value: "INQUIRY" },
                ]}
                onChange={(e) => setNewType(e.value)}
                className="w-full h-8 text-xs font-medium bg-surface-2 border border-line rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mức độ ưu tiên</Label>
              <Dropdown
                value={newPriority}
                options={[
                  { label: "Thấp (LOW)", value: "LOW" },
                  { label: "Trung bình (MEDIUM)", value: "MEDIUM" },
                  { label: "Cao (HIGH)", value: "HIGH" },
                  { label: "Khẩn cấp (URGENT)", value: "URGENT" },
                ]}
                onChange={(e) => setNewPriority(e.value)}
                className="w-full h-8 text-xs font-medium bg-surface-2 border border-line rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tiêu đề sự cố *</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tóm tắt sự cố khách hàng phản ánh..."
              className="h-8 bg-surface-2 text-xs font-semibold"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả chi tiết *</Label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Chi tiết phản ánh từ khách hàng..."
              rows={3}
              className="bg-surface-2 text-xs"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Môi trường / Thiết bị</Label>
            <Input
              value={newEnvironment}
              onChange={(e) => setNewEnvironment(e.target.value)}
              placeholder="VD: App mobile v2.1, iOS 17..."
              className="h-8 bg-surface-2 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creating}
              className="bg-accent hover:bg-accent-hover text-white font-bold cursor-pointer"
            >
              {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
              <span>Lưu & Sinh Mã Tra Cứu</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
