"use client";

import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  KanbanSquare,
  Ticket,
  Bell,
  Settings,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  ChevronLeft,
  Send,
  LogOut,
  Server,
  User as UserIcon,
  ShieldAlert,
  Smartphone,
  Check,
} from "lucide-react";
import { Dropdown } from "primereact/dropdown";

export default function MobileSimulatorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [serverUrl, setServerUrl] = useState<string>("http://localhost:3000");

  // Login form state
  const [email, setEmail] = useState("admin@kztek.net");
  const [password, setPassword] = useState("Kztek@2026");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // App Navigation
  const [activeTab, setActiveTab] = useState<"DASHBOARD" | "BOARD" | "TICKETS" | "NOTIFICATIONS" | "SETTINGS">("DASHBOARD");
  const [phoneFrame, setPhoneFrame] = useState(true);

  // Data states
  const [projects, setProjects] = useState<any[]>([]);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filter states
  const [statusTab, setStatusTab] = useState("TODO");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail / Modal states
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");

  // Auto-login or initial check
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setLoginError(data.error || "Tài khoản hoặc mật khẩu không chính xác");
        return;
      }

      if (data.user?.mustChangePassword) {
        document.cookie = `flowboard_session=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        window.location.href = "/change-password";
        return;
      }

      setToken(data.token);
      setCurrentUser(data.user);
      await loadInitialData(data.token);
    } catch (err: any) {
      setLoginError("Không thể kết nối đến máy chủ: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInitialData = async (authToken: string) => {
    try {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      // 1. Projects
      const projRes = await fetch("/api/projects", { headers });
      const projData = await projRes.json();
      const projList = projData.projects || [];
      setProjects(projList);

      const selectedProj = projList[0] || null;
      setCurrentProject(selectedProj);

      // 2. Tasks
      if (selectedProj) {
        const taskRes = await fetch(`/api/projects/${selectedProj.id}/tasks`, { headers });
        const taskData = await taskRes.json();
        setTasks(taskData.tasks || []);
      }

      // 3. Tickets
      const ticketRes = await fetch("/api/tickets", { headers });
      const ticketData = await ticketRes.json();
      setTickets(ticketData.tickets || []);

      // 4. Notifications
      const notiRes = await fetch("/api/notifications", { headers });
      const notiData = await notiRes.json();
      const notiList = notiData.notifications || [];
      setNotifications(notiList);
      setUnreadCount(notiData.unreadCount ?? notiList.filter((n: any) => !n.read).length);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const refreshTasks = async () => {
    if (!token || !currentProject) return;
    const headers = { Authorization: `Bearer ${token}` };
    const taskRes = await fetch(`/api/projects/${currentProject.id}/tasks`, { headers });
    const taskData = await taskRes.json();
    setTasks(taskData.tasks || []);
  };

  const handleAdvanceStatus = async (task: any) => {
    if (!token || !currentProject) return;
    const nextStatus =
      task.status === "BACKLOG"
        ? "TODO"
        : task.status === "TODO"
        ? "IN_PROGRESS"
        : task.status === "IN_PROGRESS"
        ? "IN_REVIEW"
        : "DONE";

    try {
      await fetch(`/api/projects/${currentProject.id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      await refreshTasks();
      if (selectedTask && selectedTask.id === task.id) {
        setSelectedTask({ ...selectedTask, status: nextStatus });
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    window.location.href = "/login";
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentProject || !newTaskTitle.trim()) return;

    try {
      await fetch(`/api/projects/${currentProject.id}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          priority: newTaskPriority,
          status: "TODO",
          type: "TASK",
        }),
      });

      setNewTaskTitle("");
      setNewTaskDesc("");
      setIsCreateTaskOpen(false);
      await refreshTasks();
      setActiveTab("BOARD");
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentProject || !selectedTask || !newComment.trim()) return;

    try {
      await fetch(`/api/projects/${currentProject.id}/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: newComment.trim() }),
      });

      setNewComment("");
      // Reload task detail
      const res = await fetch(`/api/projects/${currentProject.id}/tasks/${selectedTask.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.task) setSelectedTask(data.task);
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      const ticketRes = await fetch("/api/tickets", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ticketData = await ticketRes.json();
      setTickets(ticketData.tickets || []);
    } catch (err) {
      console.error("Error resolving ticket:", err);
    }
  };

  const handleMarkNotificationRead = async (notiId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/notifications/${notiId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notiId ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchStatus = statusTab === "ALL" ? true : t.status === statusTab;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.number.toString().includes(q) ||
      (t.assignee?.name && t.assignee.name.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const todoCount = tasks.filter((t) => t.status === "TODO" || t.status === "BACKLOG").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW").length;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const urgentCount = tasks.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Top Banner Control */}
      <div className="w-full max-w-md mb-3 flex items-center justify-between px-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-300">C# Avalonia Mobile Client — Live API Simulation</span>
        </div>
        <button
          onClick={() => setPhoneFrame(!phoneFrame)}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 transition"
        >
          <Smartphone size={13} />
          {phoneFrame ? "Khung Điện thoại" : "Toàn màn hình"}
        </button>
      </div>

      {/* Main Container / Phone Mockup */}
      <div
        className={`w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden relative ${
          phoneFrame
            ? "max-w-[412px] h-[850px] rounded-[40px] shadow-2xl border-[10px] border-slate-800"
            : "max-w-xl min-h-[780px] rounded-2xl shadow-xl"
        }`}
      >
        {/* Phone Notch / Speaker Island */}
        {phoneFrame && (
          <div className="w-full h-6 bg-slate-900 flex items-center justify-center relative select-none">
            <div className="w-28 h-4 bg-slate-950 rounded-b-xl flex items-center justify-center">
              <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
            </div>
          </div>
        )}

        {/* NOT LOGGED IN: Login Screen */}
        {!token ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between bg-slate-50">
            <div className="pt-8">
              {/* Brand Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#251C53] rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-900/30 mb-3">
                  <span className="text-white text-3xl font-black">K</span>
                </div>
                <h1 className="text-2xl font-black tracking-wider text-[#251C53]">KZTEK WORK</h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">Hệ Thống Quản Trị Công Việc & Dự Án</p>
                <div className="inline-block mt-2 px-2.5 py-0.5 bg-[#F05922]/10 text-[#F05922] text-[11px] font-bold rounded-full">
                  Avalonia Mobile Client v3.0
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-base font-bold text-slate-800">Đăng nhập tài khoản</h2>

                {loginError && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tài khoản / Email</label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#251C53]"
                    placeholder="admin@kztek.net"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#251C53]"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Máy chủ REST API</label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#251C53] hover:bg-[#342875] text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {isLoading ? "Đang xác thực..." : "ĐĂNG NHẬP"}
                </button>
              </form>
            </div>

            <div className="text-center text-[11px] text-slate-400 pb-4">
              Demo: admin@kztek.net / Kztek@2026
            </div>
          </div>
        ) : (
          /* LOGGED IN: App Shell with Top Bar, Views & Bottom Nav */
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            
            {/* Mobile Top Header */}
            <div className="bg-[#251C53] text-white px-4 py-3.5 flex items-center justify-between shadow-md z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F05922] flex items-center justify-center font-bold text-white text-base shadow">
                  K
                </div>
                <div>
                  <div className="text-[10px] text-orange-300 font-bold uppercase tracking-wider">KZTEK WORK</div>
                  <div className="text-sm font-bold truncate max-w-[190px]">
                    {activeTab === "DASHBOARD" && "Tổng quan"}
                    {activeTab === "BOARD" && (currentProject?.name || "Bảng việc")}
                    {activeTab === "TICKETS" && "Báo lỗi Khách hàng"}
                    {activeTab === "NOTIFICATIONS" && "Thông báo"}
                    {activeTab === "SETTINGS" && "Cài đặt & Tài khoản"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab("NOTIFICATIONS")}
                  className="relative p-2 text-white/90 hover:text-white rounded-full transition"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-[#F05922] text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Content Views Area */}
            <div className="flex-1 overflow-y-auto pb-20">
              
              {/* VIEW 1: DASHBOARD */}
              {activeTab === "DASHBOARD" && (
                <div key="DASHBOARD" className="p-4 space-y-4 animate-tab-fade">
                  {/* Current Project Banner */}
                  <div className="bg-gradient-to-br from-[#251C53] to-[#3B2F73] text-white p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#F05922] uppercase tracking-wider">Dự án hiện tại</span>
                      <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full font-bold">{currentProject?.key || "KZ"}</span>
                    </div>
                    <h3 className="text-lg font-black leading-snug">{currentProject?.name || "Chọn dự án"}</h3>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-xs text-slate-300">{tasks.length} công việc đang theo dõi</span>
                      <button
                        onClick={() => setActiveTab("BOARD")}
                        className="px-3 py-1.5 bg-[#F05922] text-white font-bold text-xs rounded-xl shadow flex items-center gap-1"
                      >
                        Vào Bảng <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* KPI 4 Cards Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-2xl">
                      <div className="text-xs font-semibold text-blue-700">Cần làm (TODO)</div>
                      <div className="text-2xl font-black text-blue-900 mt-1">{todoCount}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-3.5 rounded-2xl">
                      <div className="text-xs font-semibold text-orange-700">Đang xử lý</div>
                      <div className="text-2xl font-black text-orange-900 mt-1">{inProgressCount}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl">
                      <div className="text-xs font-semibold text-emerald-700">Đã hoàn thành</div>
                      <div className="text-2xl font-black text-emerald-900 mt-1">{doneCount}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-3.5 rounded-2xl">
                      <div className="text-xs font-semibold text-orange-700">Khẩn cấp / Cao</div>
                      <div className="text-2xl font-black text-orange-900 mt-1">{urgentCount}</div>
                    </div>
                  </div>

                  {/* Urgent Tasks */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-500" /> Việc Ưu Tiên Cao & Gấp
                      </h4>
                      <button onClick={() => setActiveTab("BOARD")} className="text-xs font-bold text-[#F05922]">
                        Xem tất cả
                      </button>
                    </div>

                    <div className="space-y-2">
                      {tasks
                        .filter((t) => t.priority === "URGENT" || t.priority === "HIGH")
                        .slice(0, 4)
                        .map((task) => (
                          <div
                            key={task.id}
                            onClick={() => {
                              setSelectedTask(task);
                              setIsTaskDetailOpen(true);
                            }}
                            className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-300 transition"
                          >
                            <div className="space-y-1 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#F05922]">#{task.number}</span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    task.priority === "URGENT" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {task.priority}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-slate-800 line-clamp-1">{task.title}</div>
                            </div>
                            <button className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg">
                              Chi tiết
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: KANBAN BOARD */}
              {activeTab === "BOARD" && (
                <div key="BOARD" className="p-3 space-y-3 animate-tab-fade">
                  {/* Action bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm công việc..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#251C53]"
                      />
                    </div>
                    <button
                      onClick={() => setIsCreateTaskOpen(true)}
                      className="px-3 py-2 bg-[#F05922] text-white text-xs font-bold rounded-xl shadow flex items-center gap-1 shrink-0"
                    >
                      <Plus size={14} /> Tạo việc
                    </button>
                  </div>

                  {/* Mobile Column Tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                    {["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "ALL"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setStatusTab(tab)}
                        className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                          statusTab === tab
                            ? "bg-[#251C53] text-white shadow-sm"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {tab === "TODO" && "Cần làm"}
                        {tab === "IN_PROGRESS" && "Đang làm"}
                        {tab === "IN_REVIEW" && "Duyệt"}
                        {tab === "DONE" && "Hoàn thành"}
                        {tab === "ALL" && "Tất cả"}
                      </button>
                    ))}
                  </div>

                  {/* Task List */}
                  <div className="space-y-2.5">
                    {filteredTasks.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                        Không có công việc nào trong danh mục này
                      </div>
                    ) : (
                      filteredTasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#F05922]">#{task.number}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  task.priority === "URGENT"
                                    ? "bg-orange-100 text-orange-700"
                                    : task.priority === "HIGH"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                task.status === "DONE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : task.status === "IN_PROGRESS"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>

                          <div
                            onClick={() => {
                              setSelectedTask(task);
                              setIsTaskDetailOpen(true);
                            }}
                            className="text-sm font-bold text-slate-800 cursor-pointer hover:text-[#251C53]"
                          >
                            {task.title}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                            <span className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">
                              {task.assignee?.name || "Chưa gán"}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {task.status !== "DONE" && (
                                <button
                                  onClick={() => handleAdvanceStatus(task)}
                                  className="px-2 py-1 text-[11px] font-bold bg-orange-50 text-[#F05922] border border-orange-200 rounded-lg hover:bg-orange-100"
                                >
                                  Chuyển tiếp →
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTask(task);
                                  setIsTaskDetailOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold bg-[#251C53] text-white rounded-lg"
                              >
                                Xem
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: TICKETS */}
              {activeTab === "TICKETS" && (
                <div key="TICKETS" className="p-3 space-y-3 animate-tab-fade">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Phiếu Báo Lỗi Khách Hàng</h3>
                    <span className="text-xs text-slate-500 font-semibold">{tickets.length} tickets</span>
                  </div>

                  <div className="space-y-2.5">
                    {tickets.map((t) => (
                      <div key={t.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#F05922]">{t.trackingCode}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              t.status === "RESOLVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : t.status === "OPEN"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-slate-800">{t.title}</div>
                        <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-500">KH: {t.customerName}</span>
                          {t.status !== "RESOLVED" && (
                            <button
                              onClick={() => handleResolveTicket(t.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm"
                            >
                              Hoàn tất ✓
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW 4: NOTIFICATIONS */}
              {activeTab === "NOTIFICATIONS" && (
                <div key="NOTIFICATIONS" className="p-3 space-y-3 animate-tab-fade">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Trung tâm Thông báo</h3>
                    <span className="text-xs font-bold text-[#F05922]">{unreadCount} chưa đọc</span>
                  </div>

                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-2xl border transition ${
                          n.read ? "bg-white border-slate-200" : "bg-orange-50/50 border-orange-200 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-slate-800">{n.title}</div>
                            <div className="text-xs text-slate-600">{n.message}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(n.createdAt).toLocaleString("vi-VN")}
                            </div>
                          </div>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkNotificationRead(n.id)}
                              className="text-[11px] font-bold text-[#F05922] whitespace-nowrap"
                            >
                              Đã đọc
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW 5: SETTINGS */}
              {activeTab === "SETTINGS" && (
                <div key="SETTINGS" className="p-4 space-y-4 animate-tab-fade">
                  {/* Profile Card */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#251C53] text-white font-black text-lg flex items-center justify-center shadow">
                      {currentUser?.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-800">{currentUser?.name || "Administrator"}</div>
                      <div className="text-xs text-slate-500">{currentUser?.email || "admin@kztek.net"}</div>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                        {currentUser?.role || "ADMIN"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Hệ thống</h4>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-600">Phiên bản Web Mobile</span>
                      <span className="font-bold text-[#251C53]">v2.4.0-prime</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-600">API Status</span>
                      <span className="font-bold text-emerald-600">Online 🟢</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-red-50 text-red-600 border border-red-200 font-bold rounded-2xl text-xs hover:bg-red-100 transition shadow-sm"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}

            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around shadow-lg z-20">
              <button
                onClick={() => setActiveTab("DASHBOARD")}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                  activeTab === "DASHBOARD" ? "text-[#251C53] font-bold" : "text-slate-400"
                }`}
              >
                <LayoutDashboard size={20} />
                <span className="text-[10px]">Tổng quan</span>
              </button>

              <button
                onClick={() => setActiveTab("BOARD")}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                  activeTab === "BOARD" ? "text-[#251C53] font-bold" : "text-slate-400"
                }`}
              >
                <KanbanSquare size={20} />
                <span className="text-[10px]">Bảng việc</span>
              </button>

              <button
                onClick={() => setActiveTab("TICKETS")}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                  activeTab === "TICKETS" ? "text-[#251C53] font-bold" : "text-slate-400"
                }`}
              >
                <Ticket size={20} />
                <span className="text-[10px]">Báo lỗi</span>
              </button>

              <button
                onClick={() => setActiveTab("NOTIFICATIONS")}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer relative ${
                  activeTab === "NOTIFICATIONS" ? "text-[#251C53] font-bold" : "text-slate-400"
                }`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-3 w-3.5 h-3.5 bg-[#F05922] text-white text-[8px] font-black rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
                <span className="text-[10px]">Thông báo</span>
              </button>

              <button
                onClick={() => setActiveTab("SETTINGS")}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer ${
                  activeTab === "SETTINGS" ? "text-[#251C53] font-bold" : "text-slate-400"
                }`}
              >
                <Settings size={20} />
                <span className="text-[10px]">Tài khoản</span>
              </button>
            </div>

          </div>
        )}

        {/* MODAL: TASK DETAIL */}
        {isTaskDetailOpen && selectedTask && (
          <div className="absolute inset-0 bg-black/60 z-30 flex flex-col justify-end">
            <div className="bg-white rounded-t-3xl max-h-[85%] overflow-y-auto p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  onClick={() => setIsTaskDetailOpen(false)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500"
                >
                  <ChevronLeft size={16} /> Đóng
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F05922]">#{selectedTask.number}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                    {selectedTask.status}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">{selectedTask.title}</h3>
                <p className="text-xs text-slate-600 mt-1">{selectedTask.description || "Không có mô tả"}</p>
              </div>

              {/* Status Switcher */}
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-700">Đổi trạng thái:</div>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleAdvanceStatus({ ...selectedTask, status: st === "TODO" ? "BACKLOG" : st === "IN_PROGRESS" ? "TODO" : st === "IN_REVIEW" ? "IN_PROGRESS" : "IN_REVIEW" })}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-semibold text-slate-700"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-800">Thảo luận</h4>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Viết bình luận..."
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-[#251C53] text-white text-xs font-bold rounded-xl flex items-center gap-1"
                  >
                    <Send size={12} /> Gửi
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE TASK */}
        {isCreateTaskOpen && (
          <div className="absolute inset-0 bg-black/60 z-30 flex flex-col justify-end">
            <form
              onSubmit={handleCreateTask}
              className="bg-white rounded-t-3xl max-h-[85%] overflow-y-auto p-5 space-y-4 animate-in slide-in-from-bottom duration-200"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900">Tạo công việc mới</h3>
                <button
                  type="button"
                  onClick={() => setIsCreateTaskOpen(false)}
                  className="text-xs font-bold text-slate-500"
                >
                  Hủy
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề công việc *</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Nhập tên việc cần làm..."
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả</label>
                <textarea
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Mô tả chi tiết..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ ưu tiên</label>
                <Dropdown
                  value={newTaskPriority}
                  options={[
                    { label: "LOW (Thấp)", value: "LOW" },
                    { label: "MEDIUM (Trung bình)", value: "MEDIUM" },
                    { label: "HIGH (Cao)", value: "HIGH" },
                    { label: "URGENT (Khẩn cấp)", value: "URGENT" },
                  ]}
                  onChange={(e) => setNewTaskPriority(e.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#F05922] hover:bg-[#D94814] text-white font-bold text-xs rounded-xl shadow transition"
              >
                Lưu công việc
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
