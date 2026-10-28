"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  BarChart3,
  Rocket,
  LogOut,
  Plus,
  ChevronDown,
  ChevronsUpDown,
  ArrowRightLeft,
  Users,
  Check,
  FolderKanban,
  Settings,
  Sparkles,
  Search,
  Building2,
  FolderPlus,
  Loader2,
  X,
  LifeBuoy,
  Shield,
  Clock,
  UserCheck,
  Menu,
  Calculator,
  FileText,
  Keyboard,
  Command,
  Sun,
  Moon,
  Pin,
  MessageCircle,
  Bell,
  Bot,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/desktop/command-palette";
import { ZaloLinkModal } from "@/components/account/zalo-link-modal";
import { DiscordLinkModal } from "@/components/account/discord-link-modal";
import { NotificationPreferencesModal } from "@/components/account/notification-preferences-modal";
import { ShortcutsModal } from "@/components/desktop/shortcuts-modal";
import { SmartWorkCalculator } from "@/components/desktop/smart-work-calculator";
import { DesktopScratchpad } from "@/components/desktop/desktop-scratchpad";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "primereact/dialog";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { FileUploadZone, type UploadedFileItem } from "@/components/ui/file-upload-zone";
import { PROJECT_STATUSES, projectStatusMeta } from "@/lib/constants";
import type { UserLite } from "@/lib/types";

import { usePermissions } from "@/lib/permissions-context";
import { useTheme } from "@/lib/theme-context";
import { prefetchTab } from "@/lib/tab-cache";
import { useLocalStorageRaw, writeLocalStorage } from "@/lib/client-store";

type ProjectInfo = {
  id: string;
  name: string;
  key: string;
  status?: string;
  members: { id: string; role: string; user: UserLite & { team?: { name: string; color: string } | null } }[];
};

const PROJECT_GRADIENTS = [
  "from-orange-500 to-amber-600",
  "from-blue-600 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-purple-600 to-pink-600",
  "from-[#F05922] to-[#251C53]",
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

type TeamData = {
  id: string;
  name: string;
  code: string;
  color: string;
  members: { id: string; name: string; email: string; avatarColor: string; title: string | null }[];
};

type UserData = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  title: string | null;
  teamId: string | null;
  team?: { id: string; name: string; code: string; color: string } | null;
};

export function AppShell({
  user,
  project,
  projects,
  children,
}: {
  user: UserLite;
  project: ProjectInfo;
  projects: { id: string; name: string; key: string; status?: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [searchProject, setSearchProject] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Create Project Modal State
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectKey, setNewProjectKey] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectStatus, setNewProjectStatus] = useState<string>("PLANNING");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newProjectAttachments, setNewProjectAttachments] = useState<UploadedFileItem[]>([]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");

  // Teams & Users Data for creation
  const [availableTeams, setAvailableTeams] = useState<TeamData[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserData[]>([]);
  const [loadingModalData, setLoadingModalData] = useState(false);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Mobile Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Desktop Productivity Tools & Modal States
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isZaloLinkOpen, setIsZaloLinkOpen] = useState(false);
  const [isDiscordLinkOpen, setIsDiscordLinkOpen] = useState(false);
  const [isNotificationPrefsOpen, setIsNotificationPrefsOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);

  // Pinned Sidebar Nav Items (ghim mục điều hướng lên đầu sidebar) — lưu theo từng user trên trình duyệt.
  // localStorage là external store: đọc trực tiếp qua useSyncExternalStore thay vì
  // hydrate bằng setState trong useEffect (tránh render thừa sau mount).
  const pinnedStorageKey = `kztek_pinned_nav_items_${user.id}`;
  const pinnedRaw = useLocalStorageRaw(pinnedStorageKey);
  const persistedPinned = useMemo<string[]>(() => {
    if (!pinnedRaw) return [];
    try {
      const parsed = JSON.parse(pinnedRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [pinnedRaw]);

  // `pinnedOverride` giữ thay đổi của phiên hiện tại và được ưu tiên hơn
  // localStorage, nhờ đó ghim vẫn hoạt động khi localStorage bị chặn.
  const [pinnedOverride, setPinnedOverride] = useState<string[] | null>(null);
  const pinnedHrefs = pinnedOverride ?? persistedPinned;

  function togglePinnedNav(href: string) {
    const next = pinnedHrefs.includes(href)
      ? pinnedHrefs.filter((h) => h !== href)
      : [...pinnedHrefs, href];
    setPinnedOverride(next);
    writeLocalStorage(pinnedStorageKey, JSON.stringify(next));
  }

  // Global Keyboard Shortcuts Listener for AppShell
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === "input" || targetTag === "textarea" || (e.target as HTMLElement)?.isContentEditable;

      // Ctrl + K / Cmd + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Alt + C -> Smart Calculator
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIsCalculatorOpen((prev) => !prev);
        return;
      }

      // Alt + S -> Scratchpad
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsScratchpadOpen((prev) => !prev);
        return;
      }

      // Shortcuts help (? or Ctrl+/)
      if ((e.key === "?" && !isInput) || ((e.ctrlKey || e.metaKey) && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile drawer when route changes.
  // Điều chỉnh trong lúc render thay vì useEffect: drawer đóng ngay ở lượt render
  // đầu của route mới, không nhấp nháy thêm một lượt.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileDrawerOpen(false);
  }

  // Xử lý kết quả redirect về từ Discord OAuth callback (?discord_oauth=connected|error)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const discordOauthStatus = searchParams.get("discord_oauth");
    if (!discordOauthStatus) return;

    if (discordOauthStatus === "error") {
      alert(searchParams.get("discord_oauth_message") || "Kết nối Discord thất bại");
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mở modal một lần theo kết quả redirect OAuth trên URL; URL bị xoá ngay sau đó nên không thể derive trong render
    setIsDiscordLinkOpen(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProjectMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load teams and users when create modal is opened
  useEffect(() => {
    if (createProjectOpen && availableTeams.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open: cờ loading phải bật ngay khi modal mở, dữ liệu về trong .then()
      setLoadingModalData(true);
      Promise.all([
        fetch("/api/teams").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ])
        .then(([teamsData, usersData]) => {
          if (teamsData.teams) setAvailableTeams(teamsData.teams);
          if (usersData.users) setAvailableUsers(usersData.users);
        })
        .catch(() => {})
        .finally(() => setLoadingModalData(false));
    }
  }, [createProjectOpen, availableTeams.length]);

  const { can, canCreateProject, isAdmin, isOwner } = usePermissions();
  const { theme, toggleTheme } = useTheme();

  const mainNav = [
    { href: `/projects/${project.id}/dashboard`, label: "Dashboard Dự Án", icon: LayoutDashboard },
    { href: `/projects/${project.id}/board`, label: "Board Công Việc", icon: KanbanSquare },
    { href: `/projects/${project.id}/tickets`, label: "Hộp Thư Ticket KH", icon: LifeBuoy },
    { href: `/projects/${project.id}/sprints`, label: "Sprints & Kế Hoạch", icon: Rocket },
    { href: `/projects/${project.id}/reports`, label: "Báo Cáo & KPI", icon: BarChart3 },
  ];

  const systemNav = [
    {
      href: `/projects/${project.id}/all-projects`,
      label: "Tất Cả Dự Án",
      icon: FolderKanban,
      visible: isAdmin || can("projects.view_all"),
    },
    {
      href: `/projects/${project.id}/users`,
      label: "Người Dùng & Phân Quyền",
      icon: Users,
      visible: isAdmin || isOwner || can("users.manage") || can("roles.manage"),
    },
    {
      href: `/projects/${project.id}/settings`,
      label: "Cấu hình & Cài đặt",
      icon: Settings,
      visible: isAdmin || isOwner || can("projects.edit") || can("email.config"),
    },
    {
      href: `/projects/${project.id}/notion`,
      label: "Tích Hợp Notion Hub",
      icon: ArrowRightLeft,
      visible: isAdmin || isOwner || can("notion.migrate"),
    },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  // Auto-generate project key from name
  function handleNameChange(val: string) {
    setNewProjectName(val);
    if (!newProjectKey || newProjectKey.length <= 4) {
      const words = val.trim().split(/\s+/);
      const generated = words
        .map((w) => w[0]?.toUpperCase() || "")
        .join("")
        .slice(0, 4);
      if (generated) setNewProjectKey(generated);
    }
  }

  // Handle Team selection with auto-selecting members
  function toggleTeam(teamId: string) {
    const isSelected = selectedTeamIds.includes(teamId);
    const team = availableTeams.find((t) => t.id === teamId);
    const teamMemberIds = team ? team.members.map((m) => m.id) : [];

    if (isSelected) {
      // Bỏ chọn team -> bỏ chọn teamId và các thành viên của team đó (nếu không thuộc team khác đã chọn)
      setSelectedTeamIds((prev) => prev.filter((id) => id !== teamId));
      setSelectedMemberIds((prev) => {
        const remainingTeams = availableTeams.filter((t) => selectedTeamIds.includes(t.id) && t.id !== teamId);
        const otherSelectedUserIds = new Set(remainingTeams.flatMap((t) => t.members.map((m) => m.id)));
        return prev.filter((uid) => otherSelectedUserIds.has(uid) || !teamMemberIds.includes(uid));
      });
    } else {
      // Chọn team -> thêm teamId và auto-select toàn bộ thành viên của team đó
      setSelectedTeamIds((prev) => [...prev, teamId]);
      setSelectedMemberIds((prev) => {
        const newSet = new Set([...prev, ...teamMemberIds]);
        return Array.from(newSet);
      });
    }
  }

  // Toggle individual member
  function toggleMember(userId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreateProjectError("");
    setCreatingProject(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          key: newProjectKey.trim().toUpperCase(),
          description: newProjectDesc.trim() || undefined,
          status: newProjectStatus,
          teamIds: selectedTeamIds,
          memberIds: selectedMemberIds,
          attachments: newProjectAttachments.map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileType: att.fileType,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateProjectError(data.error || "Không tạo được dự án");
        return;
      }

      setCreateProjectOpen(false);
      setNewProjectName("");
      setNewProjectKey("");
      setNewProjectDesc("");
      setNewProjectStatus("PLANNING");
      setSelectedTeamIds([]);
      setSelectedMemberIds([]);
      setNewProjectAttachments([]);
      setProjectMenuOpen(false);

      // Redirect directly to the new project dashboard
      router.push(`/projects/${data.project.id}/dashboard`);
      router.refresh();
    } catch {
      setCreateProjectError("Lỗi kết nối máy chủ");
    } finally {
      setCreatingProject(false);
    }
  }

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchProject.toLowerCase()) ||
      p.key.toLowerCase().includes(searchProject.toLowerCase())
  );

  const activeProjectStatusMeta = projectStatusMeta(project.status);

  // Compute current page label once — used for both breadcrumb text and title tooltip
  const currentPageLabel =
    pathname.endsWith("/board") ? "Board Công Việc" :
    pathname.endsWith("/sprints") ? "Sprints & Kế Hoạch" :
    pathname.endsWith("/reports") ? "Báo Cáo & KPI" :
    pathname.endsWith("/tickets") ? "Tickets Khách Hàng" :
    pathname.endsWith("/notion") ? "Tích Hợp Notion Hub" :
    pathname.endsWith("/users") ? "Người Dùng & Phân Quyền" :
    pathname.endsWith("/settings") ? "Cấu Hình Hệ Thống" :
    pathname.endsWith("/all-projects") ? "Tất Cả Dự Án" :
    (pathname.endsWith("/dashboard") || pathname === `/projects/${project.id}`) ? "Tổng Quan" :
    "";

  // Danh sách phẳng toàn bộ mục nav (đã lọc visible) — dùng để tra cứu icon/label cho mục đã ghim
  const allVisibleNavItems = [...mainNav, ...systemNav.filter((item) => item.visible)];
  const pinnedNavItems = pinnedHrefs
    .map((href) => allVisibleNavItems.find((item) => item.href === href))
    .filter((item): item is (typeof allVisibleNavItems)[number] => Boolean(item));

  // Helper: render 1 mục nav sidebar kèm nút ghim/bỏ ghim (dùng chung cho mainNav, systemNav và mục "Đã ghim")
  function renderNavItem(
    item: { href: string; label: string; icon: typeof LayoutDashboard },
    isMobile: boolean,
    keyPrefix: string = ""
  ) {
    const active =
      pathname === item.href || (item.href.endsWith("/dashboard") && pathname === `/projects/${project.id}`);
    const pinned = pinnedHrefs.includes(item.href);
    const handlePrefetch = () => {
      if (item.href.endsWith("/dashboard")) {
        prefetchTab(`/api/projects/${project.id}/dashboard`);
      } else if (item.href.endsWith("/board")) {
        prefetchTab(`/api/projects/${project.id}/tasks`);
      } else if (item.href.endsWith("/sprints")) {
        prefetchTab(`/api/projects/${project.id}/tasks`);
        prefetchTab(`/api/projects/${project.id}/sprints`);
      } else if (item.href.endsWith("/reports")) {
        prefetchTab(`/api/projects/${project.id}/reports`);
      } else if (item.href.endsWith("/users")) {
        prefetchTab(`/api/users`);
        prefetchTab(`/api/teams`);
        prefetchTab(`/api/roles`);
      } else if (item.href.endsWith("/all-projects")) {
        prefetchTab(`/api/projects`);
      } else if (item.href.endsWith("/tickets")) {
        prefetchTab(`/api/projects/${project.id}/tickets`);
      }
    };

    return (
      <div key={`${keyPrefix}${item.href}`} className="group relative flex items-center">
        <Link
          href={item.href}
          onMouseEnter={handlePrefetch}
          onFocus={handlePrefetch}
          onClick={() => {
            if (isMobile) setMobileDrawerOpen(false);
          }}
          className={cn(
            "flex flex-1 min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 pr-8 text-xs font-semibold transition-all duration-150 active:scale-[0.97] group/link",
            active
              ? "bg-accent text-white shadow-md shadow-accent/25 font-bold"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          )}
        >
          <item.icon
            className={cn(
              "h-4 w-4 shrink-0 transition-transform group-hover/link:scale-110",
              active ? "text-white" : "text-muted group-hover/link:text-foreground"
            )}
          />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePinnedNav(item.href);
          }}
          className={cn(
            "absolute right-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-all cursor-pointer",
            pinned
              ? active
                ? "opacity-100 text-white hover:bg-white/15"
                : "opacity-100 text-accent hover:bg-accent/15"
              : active
              ? "opacity-0 group-hover:opacity-100 text-white/70 hover:bg-white/15 hover:text-white"
              : "opacity-0 group-hover:opacity-100 text-muted hover:bg-surface-3 hover:text-foreground"
          )}
          title={pinned ? "Bỏ ghim mục này" : "Ghim mục này lên đầu Sidebar"}
        >
          <Pin className={cn("h-3.5 w-3.5", pinned && "fill-current")} />
        </button>
      </div>
    );
  }

  // Helper function to render sidebar content for both desktop and mobile drawer
  const renderSidebarContent = (isMobile: boolean = false) => (
    <>
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-line px-4 bg-surface/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#F05922] via-[#FF6B35] to-[#FFA500] font-black text-white text-sm shadow-lg shadow-[#F05922]/30 ring-1 ring-white/20">
            KZ
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight block leading-tight text-foreground">
              KZTEK Work
            </span>
            <span className="text-[10px] text-muted block font-medium">Enterprise Management</span>
          </div>
        </div>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center border border-line bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground cursor-pointer transition-colors"
            title="Đóng menu"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div
            className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/60 ring-2 ring-emerald-500/20 animate-pulse"
            title="Máy chủ trực tuyến"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROJECT SWITCHER WIDGET WITH STATUS BADGE                                */}
      {/* ========================================================================= */}
      <div className="relative p-3 border-b border-line/70 bg-surface/50 shrink-0" ref={isMobile ? undefined : dropdownRef}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted/80 mb-1.5 px-1 flex items-center justify-between">
          <span>Dự án hiện tại</span>
          <span className="text-[9px] font-mono text-accent font-semibold">{project.key}</span>
        </div>

        <button
          onClick={() => setProjectMenuOpen((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all cursor-pointer shadow-sm group",
            projectMenuOpen
              ? "bg-surface-3 border-accent ring-2 ring-accent/30 shadow-md"
              : "bg-surface-2/80 border-line hover:border-line-strong hover:bg-surface-3"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Vibrant Project Key Avatar */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono font-bold text-xs text-white shadow-md bg-gradient-to-br",
                getProjectGradient(project.key)
              )}
            >
              {project.key.slice(0, 3)}
            </div>

            {/* Project Title, Key & Status */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-foreground group-hover:text-accent transition-colors">
                {project.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold"
                  style={{
                    backgroundColor: activeProjectStatusMeta.bg,
                    color: activeProjectStatusMeta.color,
                    border: `1px solid ${activeProjectStatusMeta.border}`,
                  }}
                >
                  {activeProjectStatusMeta.label}
                </span>
              </div>
            </div>
          </div>

          <div className="h-6 w-6 rounded-lg bg-surface flex items-center justify-center border border-line/60 group-hover:border-line-strong transition-colors shrink-0 ml-1.5">
            <ChevronsUpDown
              className={cn(
                "h-3.5 w-3.5 text-muted transition-colors group-hover:text-foreground",
                projectMenuOpen && "text-accent"
              )}
            />
          </div>
        </button>

        {/* Flyout Workspace Menu Dropdown */}
        {projectMenuOpen && (
          <div className="absolute left-3 right-3 top-[calc(100%+6px)] z-50 rounded-2xl border border-line bg-surface p-2 shadow-2xl backdrop-blur-2xl animate-fade-in-up ring-1 ring-line">
            {/* Header */}
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted flex items-center justify-between border-b border-line/50 pb-2">
              <span>{isAdmin ? `Toàn bộ dự án (${projects.length})` : `Dự án của bạn (${projects.length})`}</span>
              <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[9px] font-mono text-muted-light">
                ESC
              </span>
            </div>

            {/* Search Box if > 2 projects */}
            {projects.length > 2 && (
              <div className="relative my-2 px-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc mã dự án..."
                  value={searchProject}
                  onChange={(e) => setSearchProject(e.target.value)}
                  className="w-full h-7.5 rounded-lg border border-line bg-surface-2 pl-8 pr-2 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>
            )}

            {/* Projects List */}
            <div className="space-y-1 max-h-56 overflow-y-auto py-1 pr-0.5">
              {filteredProjects.map((p) => {
                const isActive = p.id === project.id;
                const pStatusMeta = projectStatusMeta(p.status);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}/dashboard`}
                    onClick={() => {
                      setProjectMenuOpen(false);
                      if (isMobile) setMobileDrawerOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-2.5 py-2 transition-all group/item",
                      isActive
                        ? "bg-accent/15 border border-accent/40 shadow-sm"
                        : "hover:bg-surface-2/90 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Project Initial Avatar */}
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono font-bold text-[11px] text-white shadow-sm bg-gradient-to-br",
                          getProjectGradient(p.key)
                        )}
                      >
                        {p.key.slice(0, 3)}
                      </div>

                      <div className="min-w-0">
                        <div
                          className={cn(
                            "truncate text-xs font-bold transition-colors",
                            isActive
                              ? "text-accent"
                              : "text-foreground group-hover/item:text-accent"
                          )}
                        >
                          {p.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono mt-0.5">
                          <span className="font-bold text-foreground/80">{p.key}</span>
                          <span>•</span>
                          <span
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold"
                            style={{
                              backgroundColor: pStatusMeta.bg,
                              color: pStatusMeta.color,
                              border: `1px solid ${pStatusMeta.border}`,
                            }}
                          >
                            {pStatusMeta.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shrink-0 shadow-sm">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </Link>
                );
              })}

              {filteredProjects.length === 0 && (
                <div className="p-3 text-center text-xs text-muted">
                  Không tìm thấy dự án phù hợp
                </div>
              )}
            </div>

            {/* Quick Actions: All Projects & Create New Project */}
            <div className="border-t border-line/60 pt-1.5 mt-1 space-y-1">
              {(isAdmin || can("projects.view_all")) && (
                <Link
                  href={`/projects/${project.id}/all-projects`}
                  onClick={() => {
                    setProjectMenuOpen(false);
                    if (isMobile) setMobileDrawerOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-foreground hover:bg-surface-2 hover:text-accent transition-all cursor-pointer border border-line/60 bg-surface/50"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <FolderKanban className="h-3.5 w-3.5" />
                  </div>
                  <span>Quản lý tất cả dự án</span>
                  <span className="ml-auto text-[9px] font-bold text-accent bg-accent/15 px-1.5 py-0.2 rounded">
                    ADMIN
                  </span>
                </Link>
              )}

              {canCreateProject && (
                <button
                  type="button"
                  onClick={() => {
                    setProjectMenuOpen(false);
                    if (isMobile) setMobileDrawerOpen(false);
                    setCreateProjectOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-accent hover:bg-accent/15 hover:text-accent-hover transition-all cursor-pointer"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/20 text-accent">
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  </div>
                  <span>Tạo dự án mới</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Pinned Section — các mục đã được ghim, luôn nổi lên đầu sidebar */}
        {pinnedNavItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1">
              <Pin className="h-3 w-3 fill-current" />
              Đã ghim
            </div>
            {pinnedNavItems.map((item) => renderNavItem(item, isMobile, "pinned-"))}
          </div>
        )}

        {/* Main Workspace Section */}
        <div className="space-y-1">
          <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            Quản lý dự án
          </div>
          {mainNav.map((item) => renderNavItem(item, isMobile))}
        </div>

        {/* System & Integrations Section */}
        {systemNav.some((item) => item.visible) && (
          <div className="space-y-1">
            <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              Hệ thống & Tích hợp
            </div>
            {systemNav.filter((item) => item.visible).map((item) => renderNavItem(item, isMobile))}
          </div>
        )}

        {/* Project Members List */}
        <div className="pt-2 border-t border-line/60">
          <div className="flex items-center justify-between px-2.5 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Thành viên ({project.members.length})
            </span>
            <span className="text-[10px] text-accent font-mono font-bold">{project.key}</span>
          </div>
          <div className="space-y-1">
            {project.members.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-surface-2/60 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6 shrink-0 border border-white/10">
                    <AvatarFallback color={m.user.avatarColor} className="text-[9px] font-bold">
                      {initials(m.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{m.user.name}</div>
                    <div className="truncate text-[9px] text-muted">
                      {m.user.team ? m.user.team.name : (m.user.title || m.role)}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border",
                    m.role === "OWNER"
                      ? "bg-accent/15 border-accent/30 text-accent"
                      : "bg-surface-3 border-line-strong text-foreground"
                  )}
                >
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Status Footer */}
      <div className="border-t border-line/60 p-3 bg-surface/40 flex items-center justify-between text-[11px] text-muted shrink-0">
        <div className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
          <span className="text-foreground/80 font-semibold">KZTEK Work</span>
        </div>
        <span className="font-mono text-[10px] text-muted/70 bg-surface-2 px-1.5 py-0.5 rounded border border-line">
          v2.4
        </span>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground" suppressHydrationWarning>
      {/* Modern Obsidian Sidebar (Desktop View >= lg) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-line bg-surface/95 backdrop-blur-md z-30" suppressHydrationWarning>
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Sidebar with Animated Backdrop (< lg) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" suppressHydrationWarning>
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-2xl animate-fade-in-up" suppressHydrationWarning>
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main App Content Viewport with Global Top-Right Header */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background pb-16 lg:pb-0" suppressHydrationWarning>
        {/* Global Top-Right Navigation Bar */}
        <header className="h-14 shrink-0 border-b border-line bg-surface/70 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between z-20 gap-2" suppressHydrationWarning>
          {/* Left Context & Project Info + Mobile Hamburger Trigger */}
          <div className="flex items-center gap-2 text-xs font-semibold min-w-0 flex-1" suppressHydrationWarning>
            {/* Hamburger Button for Mobile (< lg) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center border border-line bg-surface hover:bg-surface-2 text-muted hover:text-foreground shrink-0 cursor-pointer"
              title="Mở menu điều hướng"
              suppressHydrationWarning
            >
              <Menu className="h-4 w-4" />
            </button>

            <Link
              href={`/projects/${project.id}/dashboard`}
              className="text-muted hover:text-foreground flex items-center gap-1.5 transition-colors shrink-0"
              suppressHydrationWarning
            >
              <FolderKanban className="h-3.5 w-3.5 text-accent" />
              <span className="hidden sm:inline font-bold" suppressHydrationWarning>{project.name}</span>
              <span className="sm:hidden font-mono font-bold text-accent" suppressHydrationWarning>{project.key}</span>
            </Link>
            <span className="text-muted/40">/</span>
            <span
              className="text-foreground font-bold truncate"
              title={currentPageLabel}
              suppressHydrationWarning
            >
              {currentPageLabel}
            </span>
          </div>

          {/* Right Top-Bar: Desktop Tools, Notifications & User Account Profile Card */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0" suppressHydrationWarning>
            {/* Quick Command Palette Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-3 text-muted hover:text-foreground text-xs font-medium transition-all shadow-xs"
              title="Tìm kiếm và lệnh nhanh (Ctrl+K)"
              suppressHydrationWarning
            >
              <Search className="h-3.5 w-3.5 text-accent" />
              <span className="hidden lg:inline text-[11px]" suppressHydrationWarning>Lệnh nhanh</span>
              <kbd className="hidden lg:inline-flex px-1 py-0.2 text-[9px] font-mono bg-surface rounded border border-line">
                Ctrl+K
              </kbd>
            </button>

            {/* Smart Work Calculator Toggle — hidden on mobile, accessible via keyboard shortcut (Alt+C) on desktop */}
            <button
              type="button"
              onClick={() => setIsCalculatorOpen((v) => !v)}
              className={cn(
                "hidden sm:flex p-1.5 sm:px-2 sm:py-1.5 rounded-xl border text-xs font-semibold items-center gap-1.5 transition-all shadow-xs",
                isCalculatorOpen
                  ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                  : "border-line bg-surface-2/60 hover:bg-surface-3 text-muted hover:text-foreground"
              )}
              title="Mở Máy Tính Năng Suất (Alt+C)"
              suppressHydrationWarning
            >
              <Calculator className="h-4 w-4 text-orange-400" />
              <span className="hidden md:inline text-[11px]" suppressHydrationWarning>Máy tính</span>
            </button>

            {/* Notification Bell */}
            <NotificationBell projectId={project.id} currentUserEmail={user.email} />

            {/* Theme Toggle — Sun khi dark (bấm → light), Moon khi light (bấm → dark) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex p-1.5 sm:px-2 sm:py-1.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-3 text-muted hover:text-foreground items-center transition-all shadow-xs"
              title={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
              suppressHydrationWarning
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-[#4A3F8C]" />
              )}
            </button>

            <div className="h-4 w-[1px] bg-line/80" />

            {/* Top-Right User Profile Widget */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-2 sm:gap-2.5 rounded-xl border py-1.5 px-2 sm:px-2.5 transition-all cursor-pointer shadow-sm group",
                  userMenuOpen
                    ? "bg-surface-3 border-accent ring-2 ring-accent/30 shadow-md"
                    : "bg-surface-2/80 border-line hover:border-line-strong hover:bg-surface-3"
                )}
              >
                <Avatar className="h-7 w-7 shrink-0 border border-white/15 shadow-sm">
                  <AvatarFallback color={user.avatarColor} className="font-bold text-[11px] text-white">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 text-left hidden md:block">
                  <div className="truncate text-xs font-bold text-foreground group-hover:text-accent flex items-center gap-1.5">
                    <span>{user.name}</span>
                    {user.role === "ADMIN" ? (
                      <span className="px-1.5 py-0.1 rounded text-[8px] font-black bg-accent/20 text-accent border border-accent/30 font-mono">
                        ADMIN
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.1 rounded text-[8px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25 font-mono">
                        {user.role}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] text-muted font-mono">{user.email}</div>
                </div>

                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted transition-transform ml-0.5 group-hover:text-foreground",
                    userMenuOpen && "rotate-180 text-accent"
                  )}
                />
              </button>

              {/* User Profile Flyout Dropdown Menu */}
              {userMenuOpen && (
                <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+6px)] z-50 w-auto sm:w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-surface p-3 shadow-2xl backdrop-blur-2xl animate-fade-in-up ring-1 ring-line space-y-3">
                  {/* User Info Header Card */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2/80 border border-line">
                    <Avatar className="h-10 w-10 shrink-0 border border-line/50 shadow-md">
                      <AvatarFallback color={user.avatarColor} className="font-bold text-sm text-white">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">{user.name}</div>
                      <div className="text-[11px] text-muted font-mono truncate">{user.email}</div>
                      {user.title && (
                        <div className="text-[10px] text-accent font-semibold truncate mt-0.5">{user.title}</div>
                      )}
                    </div>
                  </div>

                  {/* Quick Navigation Links */}
                  <div className="space-y-1">
                    <Link
                      href={`/projects/${project.id}/users`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <Users className="h-4 w-4 text-accent" />
                      <span>Quản trị Cơ cấu & Phân quyền</span>
                    </Link>

                    <Link
                      href={`/projects/${project.id}/settings`}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      <span>Cài đặt Dự án & Cấu hình</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setIsZaloLinkOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4 text-emerald-500" />
                      <span>Kết nối Zalo (nhận thông báo)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setIsDiscordLinkOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <Bot className="h-4 w-4 text-[#5865F2]" />
                      <span>Kết nối Discord (nhận thông báo)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setIsNotificationPrefsOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <Bell className="h-4 w-4 text-accent" />
                      <span>Tùy chọn kênh nhận thông báo</span>
                    </button>
                  </div>

                  {/* Logout Button */}
                  <div className="border-t border-line/60 pt-2">
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất khỏi hệ thống</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body with smooth page transition animation */}
        <div key={pathname} className="flex-1 overflow-hidden flex flex-col animate-page-enter">
          {children}
        </div>
      </main>

      {/* Mobile Thumb-Zone Bottom Navigation Bar (< lg) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-line bg-surface/95 backdrop-blur-xl px-2 flex items-center justify-around shadow-2xl safe-bottom">
        <Link
          href={`/projects/${project.id}/dashboard`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all duration-150 active:scale-90 cursor-pointer",
            pathname === `/projects/${project.id}/dashboard` || pathname === `/projects/${project.id}`
              ? "text-accent font-bold"
              : "text-muted hover:text-foreground"
          )}
        >
          <LayoutDashboard className={cn("h-5 w-5 mb-0.5", (pathname === `/projects/${project.id}/dashboard` || pathname === `/projects/${project.id}`) && "text-accent")} />
          <span>Tổng quan</span>
        </Link>

        <Link
          href={`/projects/${project.id}/board`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all duration-150 active:scale-90 cursor-pointer",
            pathname.endsWith("/board") ? "text-accent font-bold" : "text-muted hover:text-foreground"
          )}
        >
          <KanbanSquare className={cn("h-5 w-5 mb-0.5", pathname.endsWith("/board") && "text-accent")} />
          <span>Board</span>
        </Link>

        <Link
          href={`/projects/${project.id}/sprints`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all duration-150 active:scale-90 cursor-pointer",
            pathname.endsWith("/sprints") ? "text-accent font-bold" : "text-muted hover:text-foreground"
          )}
        >
          <Rocket className={cn("h-5 w-5 mb-0.5", pathname.endsWith("/sprints") && "text-accent")} />
          <span>Sprints</span>
        </Link>

        <Link
          href={`/projects/${project.id}/tickets`}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all duration-150 active:scale-90 cursor-pointer",
            pathname.endsWith("/tickets") ? "text-accent font-bold" : "text-muted hover:text-foreground"
          )}
        >
          <LifeBuoy className={cn("h-5 w-5 mb-0.5", pathname.endsWith("/tickets") && "text-accent")} />
          <span>Tickets</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all cursor-pointer",
            mobileDrawerOpen ? "text-accent font-bold" : "text-muted hover:text-foreground"
          )}
        >
          <Menu className="h-5 w-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* MODAL: TẠO DỰ ÁN MỚI — HỖ TRỢ CHỌN TEAM AUTO-SELECT THÀNH VIÊN VÀ STATUS */}
      {/* ========================================================================= */}
      <Dialog
        header="Khởi Tạo Dự Án Mới"
        visible={createProjectOpen}
        onHide={() => setCreateProjectOpen(false)}
        className="w-full max-w-2xl border border-line bg-surface rounded-2xl shadow-2xl overflow-hidden"
        contentClassName="p-4 sm:p-5 max-h-[82vh] overflow-y-auto"
      >
        <form
          onSubmit={handleCreateProject}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleCreateProject(e);
            }
          }}
          className="space-y-4"
        >
          {createProjectError && (
            <div className="rounded-xl bg-accent-subtle border border-accent/30 p-2.5 text-xs text-accent font-medium">
              {createProjectError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tên dự án *</Label>
              <Input
                placeholder="VD: Hệ Thống Bãi Xe Thông Minh KZ-2026"
                value={newProjectName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="text-xs h-9 bg-surface-2"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Mã dự án (Key: 2-6 ký tự in hoa) *</Label>
                <span className="text-[10px] font-mono text-muted">VD: KZ, PARK</span>
              </div>
              <Input
                placeholder="VD: KZ"
                value={newProjectKey}
                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                className="text-xs h-9 bg-surface-2 font-mono uppercase"
                required
                minLength={2}
                maxLength={6}
              />
            </div>
          </div>

          {/* Trạng thái dự án ban đầu */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Trạng thái khởi tạo dự án</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {PROJECT_STATUSES.map((st) => {
                const isSelected = newProjectStatus === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setNewProjectStatus(st.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer font-bold",
                      isSelected
                        ? "border-2 shadow-sm scale-[1.02]"
                        : "border-line bg-surface-2/60 hover:bg-surface-2 opacity-80 hover:opacity-100"
                    )}
                    style={{
                      borderColor: isSelected ? st.color : undefined,
                      backgroundColor: isSelected ? `${st.color}18` : undefined,
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: isSelected ? st.color : "inherit" }}>
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả mục tiêu dự án (Tùy chọn)</Label>
            <Textarea
              placeholder="Mô tả phạm vi, kế hoạch triển khai của dự án..."
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              rows={2}
              className="text-xs bg-surface-2"
            />
          </div>

          {/* ========================================================================= */}
          {/* ĐÍNH KÈM TÀI LIỆU DỰ ÁN (FILE, ẢNH, VIDEO)                               */}
          {/* ========================================================================= */}
          <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-3.5">
            <FileUploadZone
              files={newProjectAttachments}
              onChange={setNewProjectAttachments}
              label="Tài liệu, hình ảnh & video dự án (Tùy chọn)"
              helperText="Hỗ trợ đính kèm tài liệu đặc tả, bản vẽ sơ đồ hoặc video demo (PNG, JPG, WebP, MP4, WebM, MOV, PDF, Word, Excel, Zip... Tối đa 25MB/file & 100MB/video)"
              maxFiles={10}
            />
          </div>

          {/* ========================================================================= */}
          {/* CHỌN TEAM / PHÒNG BAN THAM GIA -> TỰ ĐỘNG CHỌN THÀNH VIÊN                 */}
          {/* ========================================================================= */}
          <div className="space-y-2.5 rounded-xl border border-line bg-surface-2/40 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent" />
                <span className="text-xs font-bold text-foreground">
                  Chọn phòng ban / Team tham gia dự án
                </span>
              </div>
              <span className="text-[10px] text-muted">
                (Tự động chọn toàn bộ nhân sự của team)
              </span>
            </div>

            {loadingModalData ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Đang tải danh sách phòng ban...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableTeams.map((team) => {
                  const isChecked = selectedTeamIds.includes(team.id);
                  return (
                    <button
                      type="button"
                      key={team.id}
                      onClick={() => toggleTeam(team.id)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                        isChecked
                          ? "bg-accent/15 border-accent shadow-sm"
                          : "bg-surface border-line hover:border-line-strong hover:bg-surface-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate text-foreground">
                            {team.name}
                          </div>
                          <div className="text-[10px] text-muted">
                            {team.members.length} thành viên ({team.code})
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          isChecked
                            ? "bg-accent border-accent text-white"
                            : "border-line bg-surface-2 text-transparent"
                        )}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Danh sách thành viên được auto-select */}
            <div className="pt-2 border-t border-line/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Nhân sự tham gia dự án ({selectedMemberIds.length + 1} người)
                </span>
                <span className="text-[10px] text-muted italic">
                  * Bạn ({user.name}) tự động là Chủ dự án (Owner)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 bg-surface rounded-xl border border-line">
                {availableUsers.map((u) => {
                  const isChecked = selectedMemberIds.includes(u.id) || u.id === user.id;
                  const isCreator = u.id === user.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => !isCreator && toggleMember(u.id)}
                      className={cn(
                        "flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors select-none",
                        isCreator
                          ? "bg-accent/15 border border-accent/30 cursor-default"
                          : isChecked
                          ? "bg-surface-2 hover:bg-surface-3 cursor-pointer border border-line"
                          : "opacity-60 hover:opacity-100 hover:bg-surface-2 cursor-pointer border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Avatar className="h-5 w-5 text-[9px] shrink-0">
                          <AvatarFallback color={u.avatarColor}>
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[11px] text-foreground flex items-center gap-1">
                            {u.name}
                            {isCreator && (
                              <span className="text-[8px] font-bold text-accent bg-accent/20 px-1 rounded">
                                Owner
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "h-4 w-4 rounded flex items-center justify-center shrink-0 text-[10px]",
                          isChecked ? "text-emerald-400" : "text-transparent"
                        )}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateProjectOpen(false)}
              className="cursor-pointer"
            >
              <span>Hủy</span>
              <kbd className="text-[10px] text-muted ml-1 font-mono">Esc</kbd>
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creatingProject}
              className="font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 px-4 cursor-pointer gap-1.5"
            >
              {creatingProject ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1 stroke-[2.5]" />
              )}
              <span>Tạo dự án ngay</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold bg-white/20 text-white rounded border border-white/30">
                Ctrl+Enter
              </kbd>
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Global Desktop Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onOpenScratchpad={() => setIsScratchpadOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        projects={projects}
      />

      {/* Desktop Shortcuts Cheat-sheet Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Modal tự liên kết tài khoản Zalo cá nhân để nhận thông báo */}
      <ZaloLinkModal
        isOpen={isZaloLinkOpen}
        onClose={() => setIsZaloLinkOpen(false)}
      />

      {/* Modal tự liên kết tài khoản Discord cá nhân để nhận thông báo */}
      <DiscordLinkModal
        isOpen={isDiscordLinkOpen}
        onClose={() => setIsDiscordLinkOpen(false)}
      />

      {/* Modal tùy chọn kênh nhận thông báo cá nhân (Email/Zalo/In-app) theo từng loại sự kiện */}
      <NotificationPreferencesModal
        isOpen={isNotificationPrefsOpen}
        onClose={() => setIsNotificationPrefsOpen(false)}
      />

      {/* Floating Smart Work Calculator */}
      {isCalculatorOpen && (
        <SmartWorkCalculator onClose={() => setIsCalculatorOpen(false)} />
      )}

      {/* Floating Desktop Scratchpad */}
      {isScratchpadOpen && (
        <DesktopScratchpad onClose={() => setIsScratchpadOpen(false)} />
      )}
    </div>
  );
}
