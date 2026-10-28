"use client";

import { useEffect, useState, useRef } from "react";
import { getTabCache, setTabCache } from "@/lib/tab-cache";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Search,
  Edit2,
  Trash2,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bell,
  Send,
  Sparkles,
  Sliders,
  Eye,
  Check,
  Plus,
  Lock,
  Building2,
  UserCheck,
  Save,
  ChevronRight,
  FolderKanban,
  Briefcase,
  UserCog,
  CheckSquare,
  Copy,
  RotateCcw,
  Info,
  Settings2,
  Palette,
  Crown,
  Layers,
  Filter,
  ArrowUpDown,
  Phone,
  Building,
  Hash,
  ShieldCheck,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  BriefcaseIcon,
  Tag,
  AtSign,
  User,
  MessageCircle,
} from "lucide-react";

// PrimeReact UI Components (LTS 10.9.3)
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";

import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PermissionCategory } from "@/lib/permissions";

type TeamItem = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string;
  leaderId: string | null;
  leader: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
    title: string | null;
    role: string;
  } | null;
  members: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
    title: string | null;
    role: string;
  }[];
  memberCount: number;
  taskCount: number;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  avatarColor: string;
  role: string;
  teamId: string | null;
  phone: string | null;
  zaloUserId?: string | null;
  zaloLinkedAt?: string | null;
  discordUserId?: string | null;
  discordUsername?: string | null;
  discordLinkedAt?: string | null;
  team: {
    id: string;
    name: string;
    code: string;
    color: string;
  } | null;
  createdAt: string;
  _count: {
    assignedTasks: number;
    createdTasks: number;
    memberships: number;
  };
};

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
};

interface UsersCacheData {
  users: UserItem[];
  teams: TeamItem[];
  roles: RoleItem[];
  categories: PermissionCategory[];
  currentUserId: string;
  currentUserRole: string;
}

const USERS_CACHE_KEY = "kztek_users_page_data";

const AVATAR_COLORS = [
  "#F05922",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
  "#F05922",
  "#06B6D4",
];

export default function UsersManagementPage() {
  const toast = useRef<Toast>(null);
  const cached = getTabCache<UsersCacheData>(USERS_CACHE_KEY);

  const [users, setUsers] = useState<UserItem[]>(cached?.users || []);
  const [teams, setTeams] = useState<TeamItem[]>(cached?.teams || []);
  const [roles, setRoles] = useState<RoleItem[]>(cached?.roles || []);
  const [categories, setCategories] = useState<PermissionCategory[]>(cached?.categories || []);
  const [currentUserId, setCurrentUserId] = useState<string>(cached?.currentUserId || "");
  const [currentUserRole, setCurrentUserRole] = useState<string>(cached?.currentUserRole || "MEMBER");
  const [loading, setLoading] = useState(!cached);

  const [globalFilter, setGlobalFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"users" | "teams" | "roles">("users");

  // ==========================================
  // TEAM MODALS STATE
  // ==========================================
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamColor, setTeamColor] = useState("#F05922");
  const [teamLeaderId, setTeamLeaderId] = useState<string | null>(null);
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);

  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamItem | null>(null);

  // ==========================================
  // USER MODALS STATE
  // ==========================================
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createRole, setCreateRole] = useState("MEMBER");
  const [createTeamId, setCreateTeamId] = useState<string | null>(null);
  const [createColor, setCreateColor] = useState("#F05922");
  const [createPhone, setCreatePhone] = useState("");
  const [createDiscordUserId, setCreateDiscordUserId] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editRole, setEditRole] = useState("MEMBER");
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editColor, setEditColor] = useState("#F05922");
  const [editPhone, setEditPhone] = useState("");
  const [editDiscordUserId, setEditDiscordUserId] = useState("");
  const [updatingUser, setUpdatingUser] = useState(false);
  const [sendingCredentialsId, setSendingCredentialsId] = useState<string | null>(null);

  // ==========================================
  // ROLES & PERMISSIONS STATE
  // ==========================================
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("TECH_LEAD");
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Modal Tạo vai trò mới
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");
  const [newRolePreset, setNewRolePreset] = useState("MEMBER");
  const [creatingRole, setCreatingRole] = useState(false);

  // Modal Sửa vai trò
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [editingRoleItem, setEditingRoleItem] = useState<RoleItem | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleDesc, setEditRoleDesc] = useState("");
  const [editRoleColor, setEditRoleColor] = useState("#6366f1");
  const [updatingRole, setUpdatingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState(false);

  // Modal Xác nhận Xóa vai trò
  const [deleteRoleConfirmOpen, setDeleteRoleConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleItem | null>(null);



  // Load Initial Data
  async function loadAllData() {
    try {
      const [resUsers, resTeams, resRoles, resMe] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/teams"),
        fetch("/api/roles"),
        fetch("/api/auth/me"),
      ]);

      let nextUsers = users;
      let nextTeams = teams;
      let nextRoles = roles;
      let nextCats = categories;
      let nextUid = currentUserId;
      let nextRole = currentUserRole;

      if (resUsers.ok) {
        const d = await resUsers.json();
        nextUsers = d.users || [];
        setUsers(nextUsers);
      }
      if (resTeams.ok) {
        const d = await resTeams.json();
        nextTeams = d.teams || [];
        setTeams(nextTeams);
      }
      if (resRoles.ok) {
        const d = await resRoles.json();
        nextRoles = d.roles || [];
        nextCats = d.categories || [];
        setRoles(nextRoles);
        setCategories(nextCats);
        if (nextRoles?.length > 0 && !selectedRoleKey) {
          setSelectedRoleKey(nextRoles[0].key);
          setActivePermissions(nextRoles[0].permissions);
        }
      }
      if (resMe.ok) {
        const d = await resMe.json();
        nextUid = d.user?.id || "";
        nextRole = d.user?.role || "MEMBER";
        setCurrentUserId(nextUid);
        setCurrentUserRole(nextRole);
      }

      setTabCache(USERS_CACHE_KEY, {
        users: nextUsers,
        teams: nextTeams,
        roles: nextRoles,
        categories: nextCats,
        currentUserId: nextUid,
        currentUserRole: nextRole,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  // Nạp lại danh sách quyền khi đổi vai trò đang chọn (hoặc khi `roles` vừa
  // được tải). `activePermissions` vẫn là state vì người dùng tick/untick được,
  // nên dùng pattern điều chỉnh state trong lúc render thay vì useEffect.
  const [prevRoleSync, setPrevRoleSync] = useState({ key: selectedRoleKey, roles });
  if (prevRoleSync.key !== selectedRoleKey || prevRoleSync.roles !== roles) {
    setPrevRoleSync({ key: selectedRoleKey, roles });
    const r = roles.find((role) => role.key === selectedRoleKey);
    if (r) setActivePermissions(r.permissions);
  }

  // ==========================================
  // TEAM HANDLERS
  // ==========================================
  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || !teamCode.trim()) return;
    setSavingTeam(true);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          code: teamCode.trim().toUpperCase(),
          description: teamDesc.trim() || undefined,
          color: teamColor,
          leaderId: teamLeaderId || undefined,
          memberIds: teamMemberIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không tạo được nhóm" });
        return;
      }

      toast.current?.show({ severity: "success", summary: "Thành công", detail: `Đã tạo nhóm ${data.team.name}` });
      setCreateTeamOpen(false);
      setTeamName("");
      setTeamCode("");
      setTeamDesc("");
      setTeamLeaderId(null);
      setTeamMemberIds([]);
      loadAllData();
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
    } finally {
      setSavingTeam(false);
    }
  }

  function openEditTeam(t: TeamItem) {
    setEditingTeam(t);
    setTeamName(t.name);
    setTeamCode(t.code);
    setTeamDesc(t.description || "");
    setTeamColor(t.color);
    setTeamLeaderId(t.leaderId);
    setTeamMemberIds(t.members.map((m) => m.id));
    setEditTeamOpen(true);
  }

  async function handleUpdateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeam) return;
    setSavingTeam(true);

    const updatedTeamObj: TeamItem = {
      ...editingTeam,
      name: teamName.trim(),
      code: teamCode.trim().toUpperCase(),
      description: teamDesc.trim() || null,
      color: teamColor,
      leaderId: teamLeaderId,
      leader: teamLeaderId ? (users.find((u) => u.id === teamLeaderId) as any) : null,
      members: users.filter((u) => teamMemberIds.includes(u.id)) as any,
    };

    // Cập nhật UI tức thì
    setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? updatedTeamObj : t)));
    setEditTeamOpen(false);
    toast.current?.show({ severity: "success", summary: "Thành công", detail: "Đã cập nhật thông tin nhóm" });

    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          code: teamCode.trim().toUpperCase(),
          description: teamDesc.trim() || undefined,
          color: teamColor,
          leaderId: teamLeaderId,
          memberIds: teamMemberIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không cập nhật được nhóm" });
        loadAllData();
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
      loadAllData();
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleDeleteTeam(t: TeamItem) {
    if (!confirm(`Bạn có chắc muốn xóa nhóm "${t.name}"? Các thành viên sẽ tự động được gỡ khỏi nhóm.`)) return;

    // Optimistic delete tức thì trên UI
    setTeams((prev) => prev.filter((item) => item.id !== t.id));
    toast.current?.show({ severity: "success", summary: "Thành công", detail: "Đã xóa nhóm thành công" });

    try {
      const res = await fetch(`/api/teams/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: d.error ?? "Không xóa được nhóm" });
        loadAllData();
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
      loadAllData();
    }
  }

  // ==========================================
  // USER HANDLERS
  // ==========================================
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatingUser(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim(),
          password: createPassword,
          title: createTitle.trim() || undefined,
          role: createRole,
          teamId: createTeamId || undefined,
          avatarColor: createColor,
          phone: createPhone.trim() || undefined,
          discordUserId: createDiscordUserId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không tạo được tài khoản" });
        return;
      }

      toast.current?.show({ severity: "success", summary: "Thành công", detail: `Đã tạo tài khoản ${data.user.name}` });
      setCreateUserOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateTitle("");
      setCreateTeamId(null);
      setCreatePhone("");
      setCreateDiscordUserId("");
      loadAllData();
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
    } finally {
      setCreatingUser(false);
    }
  }

  function openEditUser(u: UserItem) {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditTitle(u.title || "");
    setEditRole(u.role);
    setEditTeamId(u.teamId);
    setEditColor(u.avatarColor);
    setEditPhone(u.phone || "");
    setEditDiscordUserId(u.discordUserId || "");
    setEditUserOpen(true);
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setUpdatingUser(true);

    const updatedUserObj: UserItem = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim(),
      title: editTitle.trim() || null,
      role: editRole,
      teamId: editTeamId,
      avatarColor: editColor,
      phone: editPhone.trim() || null,
      discordUserId: editDiscordUserId.trim() || null,
    };

    // Optimistic update tức thì trên UI
    setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updatedUserObj : u)));
    setEditUserOpen(false);
    toast.current?.show({ severity: "success", summary: "Thành công", detail: "Cập nhật tài khoản thành công" });

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          password: editPassword.trim() || undefined,
          title: editTitle.trim() || undefined,
          role: editRole,
          teamId: editTeamId,
          avatarColor: editColor,
          phone: editPhone.trim() || null,
          discordUserId: editDiscordUserId.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không cập nhật được tài khoản" });
        loadAllData();
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
      loadAllData();
    } finally {
      setUpdatingUser(false);
    }
  }

  async function handleSendCredentials(u: UserItem) {
    if (
      !confirm(
        `Gửi email tài khoản + mật khẩu mới đến ${u.email}?\nMật khẩu hiện tại của "${u.name}" sẽ bị thay thế và người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.`
      )
    )
      return;

    setSendingCredentialsId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/send-credentials`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không gửi được email" });
        return;
      }
      if (data.status === "SIMULATED") {
        // Chưa cấu hình SMTP: email chỉ nằm trong Outbox giả lập -> hiển thị mật khẩu để Admin tự bàn giao
        toast.current?.show({
          severity: "warn",
          summary: "Chưa cấu hình SMTP",
          detail: `Email chưa thực sự được gửi. Mật khẩu tạm của ${u.name}: ${data.password}`,
          sticky: true,
        });
      } else {
        toast.current?.show({ severity: "success", summary: "Thành công", detail: `Đã gửi thông tin tài khoản đến ${u.email}` });
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
    } finally {
      setSendingCredentialsId(null);
    }
  }

  async function handleDeleteUser(u: UserItem) {
    if (u.id === currentUserId) {
      toast.current?.show({ severity: "warn", summary: "Cảnh báo", detail: "Không thể tự xóa tài khoản của chính bạn!" });
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${u.name}"?`)) return;

    // Optimistic delete tức thì trên UI
    setUsers((prev) => prev.filter((item) => item.id !== u.id));
    toast.current?.show({ severity: "success", summary: "Thành công", detail: "Đã xóa tài khoản" });

    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: d.error ?? "Không xóa được tài khoản" });
        loadAllData();
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
      loadAllData();
    }
  }

  // ==========================================
  // PERMISSION TOGGLES & BULK ACTIONS
  // ==========================================
  function togglePermission(key: string) {
    if (selectedRoleKey === "ADMIN") return;
    setActivePermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleSelectAllPermissions() {
    if (selectedRoleKey === "ADMIN") return;
    const allKeys = categories.flatMap((c) => c.permissions.map((p) => p.key));
    setActivePermissions(allKeys);
  }

  function handleDeselectAllPermissions() {
    if (selectedRoleKey === "ADMIN") return;
    setActivePermissions([]);
  }

  function handleSelectCategoryPermissions(cat: PermissionCategory) {
    if (selectedRoleKey === "ADMIN") return;
    const catKeys = cat.permissions.map((p) => p.key);
    setActivePermissions((prev) => Array.from(new Set([...prev, ...catKeys])));
  }

  function handleDeselectCategoryPermissions(cat: PermissionCategory) {
    if (selectedRoleKey === "ADMIN") return;
    const catKeys = new Set(cat.permissions.map((p) => p.key));
    setActivePermissions((prev) => prev.filter((k) => !catKeys.has(k)));
  }

  function handleToggleCategoryPermissions(cat: PermissionCategory) {
    if (selectedRoleKey === "ADMIN") return;
    const catKeys = cat.permissions.map((p) => p.key);
    const allChecked = catKeys.every((k) => activePermissions.includes(k));
    if (allChecked) {
      setActivePermissions((prev) => prev.filter((k) => !catKeys.includes(k)));
    } else {
      setActivePermissions((prev) => Array.from(new Set([...prev, ...catKeys])));
    }
  }

  function handleApplyPreset(presetRoleKey: string) {
    if (selectedRoleKey === "ADMIN") return;
    const preset = roles.find((r) => r.key === presetRoleKey);
    if (preset) {
      setActivePermissions([...preset.permissions]);
      toast.current?.show({
        severity: "info",
        summary: "Đã nạp mẫu quyền",
        detail: `Đã áp dụng mẫu phân quyền từ "${preset.name}" (${preset.permissions.length} quyền)`,
      });
    }
  }

  async function savePermissions() {
    setSavingPermissions(true);
    try {
      const res = await fetch(`/api/roles/${selectedRoleKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: activePermissions }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không lưu được phân quyền" });
        return;
      }

      setRoles((prev) =>
        prev.map((r) => (r.key === selectedRoleKey ? { ...r, permissions: activePermissions } : r))
      );
      toast.current?.show({ severity: "success", summary: "Thành công", detail: `Đã lưu cấu hình phân quyền cho "${data.role.name}"` });

      // Phát sự kiện toàn cục để toàn bộ UI tự động cập nhật phân quyền tức thì
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("permissions-updated"));
      }
    } finally {
      setSavingPermissions(false);
    }
  }

  // ==========================================
  // ROLE CRUD HANDLERS
  // ==========================================
  function openCreateRole() {
    setNewRoleName("");
    setNewRoleKey("");
    setNewRoleDesc("");
    setNewRoleColor("#6366f1");
    setNewRolePreset("MEMBER");
    setCreateRoleOpen(true);
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim() || !newRoleKey.trim()) return;
    setCreatingRole(true);

    const formattedKey = newRoleKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const presetObj = roles.find((r) => r.key === newRolePreset);
    const initialPerms = presetObj ? presetObj.permissions : [];

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: formattedKey,
          name: newRoleName.trim(),
          description: newRoleDesc.trim() || undefined,
          color: newRoleColor,
          permissions: initialPerms,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không tạo được vai trò mới" });
        return;
      }

      toast.current?.show({ severity: "success", summary: "Thành công", detail: `Đã tạo vai trò mới "${data.role.name}"` });
      setCreateRoleOpen(false);
      await loadAllData();
      setSelectedRoleKey(data.role.key);
      setActivePermissions(data.role.permissions);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("permissions-updated"));
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
    } finally {
      setCreatingRole(false);
    }
  }

  function openEditRole(r: RoleItem) {
    setEditingRoleItem(r);
    setEditRoleName(r.name);
    setEditRoleDesc(r.description || "");
    setEditRoleColor(r.color);
    setEditRoleOpen(true);
  }

  async function handleUpdateRoleInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoleItem) return;
    setUpdatingRole(true);

    const updatedRoleItem: RoleItem = {
      ...editingRoleItem,
      name: editRoleName.trim(),
      description: editRoleDesc.trim() || null,
      color: editRoleColor,
    };

    // Optimistic update tức thì trên UI
    setRoles((prev) => prev.map((r) => (r.key === editingRoleItem.key ? updatedRoleItem : r)));
    setEditRoleOpen(false);
    toast.current?.show({ severity: "success", summary: "Thành công", detail: "Đã cập nhật thông tin vai trò" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("permissions-updated"));
    }

    try {
      const res = await fetch(`/api/roles/${editingRoleItem.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editRoleName.trim(),
          description: editRoleDesc.trim() || undefined,
          color: editRoleColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không cập nhật được vai trò" });
        loadAllData();
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
      loadAllData();
    } finally {
      setUpdatingRole(false);
    }
  }

  function confirmDeleteRole(r: RoleItem) {
    if (r.isSystem) {
      toast.current?.show({
        severity: "warn",
        summary: "Cảnh báo",
        detail: `Không thể xóa vai trò hệ thống mặc định ("${r.name}")!`,
      });
      return;
    }
    setRoleToDelete(r);
    setDeleteRoleConfirmOpen(true);
  }

  async function executeDeleteRole() {
    if (!roleToDelete) return;
    const targetKey = roleToDelete.key;
    const targetName = roleToDelete.name;

    // Optimistic delete tức thì trên UI
    setRoles((prev) => prev.filter((r) => r.key !== targetKey));
    setDeleteRoleConfirmOpen(false);
    if (selectedRoleKey === targetKey) {
      setSelectedRoleKey("MEMBER");
    }
    toast.current?.show({
      severity: "success",
      summary: "Thành công",
      detail: `Đã xóa vai trò "${targetName}". Các tài khoản liên quan đã được chuyển về vai trò "Thành viên (Member)".`,
    });
    setRoleToDelete(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("permissions-updated"));
    }

    setDeletingRole(true);
    try {
      const res = await fetch(`/api/roles/${targetKey}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.current?.show({ severity: "error", summary: "Lỗi", detail: data.error ?? "Không xóa được vai trò" });
        loadAllData();
      }
    } catch {
      toast.current?.show({ severity: "error", summary: "Lỗi", detail: "Lỗi kết nối máy chủ" });
      loadAllData();
    } finally {
      setDeletingRole(false);
    }
  }

  async function handleDeleteRole(r: RoleItem) {
    confirmDeleteRole(r);
  }

  const filteredUsers = users.filter((u) => {
    if (teamFilter !== "ALL") {
      if (teamFilter === "NO_TEAM" && u.teamId) return false;
      if (teamFilter !== "NO_TEAM" && u.teamId !== teamFilter) return false;
    }
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    return true;
  });

  const selectedRole = roles.find((r) => r.key === selectedRoleKey);
  const totalTasksCount = users.reduce((sum, u) => sum + (u._count?.assignedTasks || 0), 0);

  // User Table Column Templates (PrimeReact)
  const userBodyTemplate = (rowData: UserItem) => (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9 border border-white/10 shadow-sm shrink-0">
        <AvatarFallback color={rowData.avatarColor} className="text-xs font-bold">
          {initials(rowData.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-bold text-foreground flex items-center gap-1.5 text-xs truncate">
          <span>{rowData.name}</span>
          {rowData.id === currentUserId && (
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 text-[9px] font-bold text-emerald-600">
              Bạn
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted font-mono truncate">{rowData.email}</div>
      </div>
    </div>
  );

  const titleBodyTemplate = (rowData: UserItem) => (
    <span className="text-xs font-medium text-foreground/90">
      {rowData.title || <span className="text-muted/60 italic">—</span>}
    </span>
  );

  const teamBodyTemplate = (rowData: UserItem) => (
    rowData.team ? (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
        style={{
          backgroundColor: `${rowData.team.color}18`,
          color: rowData.team.color,
          border: `1px solid ${rowData.team.color}35`,
        }}
      >
        <Building2 className="h-3.5 w-3.5" />
        {rowData.team.name}
      </span>
    ) : (
      <button
        onClick={() => openEditUser(rowData)}
        className="inline-flex items-center gap-1 text-[11px] text-muted/70 hover:text-accent font-medium hover:underline cursor-pointer"
      >
        <Plus className="h-3 w-3" /> Gán phòng ban
      </button>
    )
  );

  const roleBodyTemplate = (rowData: UserItem) => {
    const r = roles.find((role) => role.key === rowData.role);
    const color = r?.color || "#6366f1";
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
        style={{
          backgroundColor: `${color}18`,
          color: color,
          border: `1px solid ${color}35`,
        }}
      >
        <Shield className="h-3.5 w-3.5" />
        {r?.name || rowData.role}
      </span>
    );
  };

  const projectCountTemplate = (rowData: UserItem) => (
    <div className="text-center">
      <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-md bg-surface-2 border border-line text-xs font-mono font-bold text-foreground">
        {rowData._count?.memberships || 0}
      </span>
    </div>
  );

  const taskCountTemplate = (rowData: UserItem) => (
    <div className="text-center">
      <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-md bg-accent/15 border border-accent/30 text-xs font-mono font-bold text-accent">
        {rowData._count?.assignedTasks || 0}
      </span>
    </div>
  );

  const actionBodyTemplate = (rowData: UserItem) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => openEditUser(rowData)}
        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
        title="Chỉnh sửa tài khoản / Gán nhóm"
      >
        <Edit2 className="h-4 w-4" />
      </button>

      {rowData.id !== currentUserId && (
        <button
          onClick={() => handleSendCredentials(rowData)}
          disabled={sendingCredentialsId === rowData.id}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent-subtle transition-colors cursor-pointer disabled:opacity-50"
          title="Gửi email tài khoản + mật khẩu khởi tạo"
        >
          {sendingCredentialsId === rowData.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      )}

      {rowData.id !== currentUserId && (
        <button
          onClick={() => handleDeleteUser(rowData)}
          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent-subtle transition-colors cursor-pointer"
          title="Xóa tài khoản"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <Toast ref={toast} />

      {/* Top Header & Prime Tabs Navigation */}
      <div className="flex flex-col lg:flex-row min-h-16 shrink-0 lg:items-center justify-between border-b border-line px-4 sm:px-6 py-3 lg:py-0 bg-surface/50 backdrop-blur-md gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2.5 font-bold text-foreground text-sm shrink-0">
            <div className="h-8 w-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="leading-tight">Quản trị Cơ cấu & Phân quyền</div>
              <div className="text-[10px] text-muted font-normal">Hệ thống phân cấp phòng ban & vai trò KZTEK</div>
            </div>
          </div>

          <div className="flex items-center overflow-x-auto no-scrollbar rounded-xl bg-surface-2 p-1 border border-line shrink-0">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 cursor-pointer ${
                activeTab === "users"
                  ? "bg-accent text-white shadow-sm shadow-accent/25"
                  : "text-muted hover:text-foreground hover:bg-surface-3/60"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Nhân Sự ({users.length})
            </button>

            <button
              onClick={() => setActiveTab("teams")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 cursor-pointer ${
                activeTab === "teams"
                  ? "bg-accent text-white shadow-sm shadow-accent/25"
                  : "text-muted hover:text-foreground hover:bg-surface-3/60"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Nhóm / Phòng Ban ({teams.length})
            </button>

            <button
              onClick={() => setActiveTab("roles")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 cursor-pointer ${
                activeTab === "roles"
                  ? "bg-accent text-white shadow-sm shadow-accent/25"
                  : "text-muted hover:text-foreground hover:bg-surface-3/60"
              }`}
            >
              <Lock className="h-3.5 w-3.5" />
              Ma trận Phân quyền ({roles.length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
          {activeTab === "users" && (
            <Button
              size="sm"
              onClick={() => {
                setEditingUser(null);
                setCreateUserOpen(true);
              }}
              className="h-9 px-3.5 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Thêm nhân sự mới
            </Button>
          )}

          {activeTab === "teams" && (
            <Button
              size="sm"
              onClick={() => {
                setTeamName("");
                setTeamCode("");
                setTeamDesc("");
                setTeamLeaderId(null);
                setTeamMemberIds([]);
                setEditingTeam(null);
                setCreateTeamOpen(true);
              }}
              className="h-9 px-3.5 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Thêm nhóm / phòng ban
            </Button>
          )}

          {activeTab === "roles" && (
            <Button
              size="sm"
              onClick={openCreateRole}
              className="h-9 px-3.5 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Tạo vai trò mới
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DANH SÁCH TÀI KHOẢN (PRIMEREACT DATATABLE) */}
      {/* ========================================================================= */}
      {activeTab === "users" && (
        <div key="users" className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 w-full max-w-[1600px] mx-auto animate-tab-fade">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-line bg-surface p-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Tổng nhân sự</div>
                <div className="text-2xl font-extrabold text-foreground mt-0.5">{users.length}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Phòng ban nội bộ</div>
                <div className="text-2xl font-extrabold text-foreground mt-0.5">{teams.length}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Vai trò hệ thống</div>
                <div className="text-2xl font-extrabold text-foreground mt-0.5">{roles.length}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                <Shield className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="text-[11px] font-bold text-muted uppercase tracking-wider">Tasks đang phụ trách</div>
                <div className="text-2xl font-extrabold text-accent mt-0.5">{totalTasksCount}</div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <CheckSquare className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Controls Filter Bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-surface p-3.5 rounded-2xl border border-line shadow-sm">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {/* Search Box */}
              <div className="relative min-w-[260px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none z-10" />
                <Input
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder="Tìm kiếm tên, email, chức danh..."
                  className="pl-9 h-9 text-xs bg-surface-2 border-line rounded-xl w-full"
                />
              </div>

              {/* Team Filter */}
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted" />
                <Dropdown
                  value={teamFilter}
                  options={[
                    { label: `Tất cả phòng ban (${users.length})`, value: "ALL" },
                    { label: "Chưa phân nhóm", value: "NO_TEAM" },
                    ...teams.map((t) => ({ label: `${t.name} (${t.memberCount})`, value: t.id })),
                  ]}
                  onChange={(e) => setTeamFilter(e.value)}
                  className="p-inputtext-sm h-9 text-xs bg-surface-2 border border-line rounded-xl"
                />
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-muted" />
                <Dropdown
                  value={roleFilter}
                  options={[
                    { label: `Tất cả vai trò (${users.length})`, value: "ALL" },
                    ...roles.map((r) => ({ label: r.name, value: r.key })),
                  ]}
                  onChange={(e) => setRoleFilter(e.value)}
                  className="p-inputtext-sm h-9 text-xs bg-surface-2 border border-line rounded-xl"
                />
              </div>
            </div>

            <div className="text-xs text-muted font-medium pr-2">
              Hiển thị: <strong className="text-foreground">{filteredUsers.length}</strong> / {users.length} nhân sự
            </div>
          </div>

          {/* PrimeReact DataTable (Polished Obsidian Dark Theme) */}
          <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-lg">
            <DataTable
              value={filteredUsers}
              paginator
              rows={10}
              rowsPerPageOptions={[5, 10, 20, 50]}
              globalFilter={globalFilter}
              emptyMessage="Không tìm thấy nhân sự nào phù hợp"
              className="w-full text-xs"
              tableStyle={{ minWidth: "50rem" }}
            >
              <Column field="name" header="Nhân sự" body={userBodyTemplate} sortable style={{ width: "26%" }} />
              <Column field="title" header="Chức danh" body={titleBodyTemplate} sortable style={{ width: "18%" }} />
              <Column field="team.name" header="Phòng ban / Nhóm" body={teamBodyTemplate} sortable style={{ width: "22%" }} />
              <Column field="role" header="Vai trò hệ thống" body={roleBodyTemplate} sortable style={{ width: "18%" }} />
              <Column field="_count.memberships" header="Dự án" body={projectCountTemplate} sortable style={{ width: "8%" }} />
              <Column field="_count.assignedTasks" header="Tasks" body={taskCountTemplate} sortable style={{ width: "8%" }} />
              <Column header="Thao tác" body={actionBodyTemplate} style={{ width: "8%" }} />
            </DataTable>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: QUẢN LÝ NHÓM / PHÒNG BAN (TEAMS & DEPARTMENTS) */}
      {/* ========================================================================= */}
      {activeTab === "teams" && (
        <div key="teams" className="flex-1 space-y-4 sm:space-y-6 overflow-y-auto p-3 sm:p-6 w-full max-w-[1600px] mx-auto animate-tab-fade">
          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm hover:border-line-strong hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Card Header: Color Tag & Code */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: team.color, boxShadow: `0 0 10px ${team.color}80` }}
                      />
                      <span className="font-mono font-bold text-xs text-muted">
                        [{team.code}]
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditTeam(team)}
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 cursor-pointer transition-colors"
                        title="Chỉnh sửa nhóm"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team)}
                        className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent-subtle cursor-pointer transition-colors"
                        title="Xóa nhóm"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Team Title & Description */}
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-snug">{team.name}</h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                      {team.description || "Chưa có mô tả phòng ban"}
                    </p>
                  </div>

                  {/* Team Leader Badge */}
                  <div className="rounded-xl border border-line bg-surface-2/60 p-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted uppercase flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-amber-600" />
                      Trưởng nhóm
                    </span>
                    {team.leader ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-white/10">
                          <AvatarFallback color={team.leader.avatarColor} className="text-[9px] font-bold">
                            {initials(team.leader.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-bold text-foreground">{team.leader.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted/70 italic">Chưa chỉ định</span>
                    )}
                  </div>

                  {/* Members Stack & Chips */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-muted">
                      <span>Thành viên ({team.memberCount})</span>
                      <span className="font-bold text-accent">{team.taskCount} tasks đang làm</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {team.members.slice(0, 6).map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-line px-2.5 py-1 text-[11px] font-medium text-foreground"
                        >
                          <Avatar className="h-4 w-4">
                            <AvatarFallback color={m.avatarColor} className="text-[8px]">
                              {initials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[85px]">{m.name}</span>
                        </span>
                      ))}
                      {team.memberCount > 6 && (
                        <span className="rounded-full bg-surface-2 border border-line px-2 py-0.5 text-[10px] font-bold text-muted flex items-center">
                          +{team.memberCount - 6}
                        </span>
                      )}
                      {team.memberCount === 0 && (
                        <span className="text-xs text-muted/60 italic">Chưa có thành viên nào</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                  <span className="text-muted">Cấp bậc: <strong>Phòng ban</strong></span>
                  <button
                    onClick={() => openEditTeam(team)}
                    className="font-bold text-accent hover:underline cursor-pointer flex items-center gap-1"
                  >
                    Phân bổ nhân sự <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MA TRẬN PHÂN QUYỀN (ROLES & RBAC) */}
      {/* ========================================================================= */}
      {activeTab === "roles" && (
        <div key="roles" className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-line animate-tab-fade">
          {/* Left Column: Roles Selector List */}
          <div className="p-4 space-y-3 overflow-y-auto bg-surface/30 flex flex-col h-full">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Danh sách vai trò ({roles.length})
              </span>
              <button
                onClick={openCreateRole}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline cursor-pointer"
                title="Tạo vai trò tùy chỉnh mới"
              >
                <Plus className="h-3 w-3" /> Thêm vai trò
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
              {roles.map((r) => {
                const isSelected = r.key === selectedRoleKey;
                return (
                  <div
                    key={r.key}
                    onClick={() => setSelectedRoleKey(r.key)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                      isSelected
                        ? "bg-surface-2 border-accent shadow-md ring-1 ring-accent/40"
                        : "bg-surface/60 border-line hover:border-line-strong hover:bg-surface-2/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: r.color, boxShadow: `0 0 8px ${r.color}80` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-foreground truncate flex items-center gap-1.5">
                          <span className="truncate">{r.name}</span>
                          {r.isSystem && (
                            <span className="rounded bg-surface-3 px-1 py-0.2 text-[8px] font-mono text-muted shrink-0">
                              SYSTEM
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted font-mono truncate">{r.key}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="rounded-full bg-surface-3 px-2 py-0.5 text-[9px] font-bold text-muted"
                        title={`${r.permissions.length} quyền hạn được gán`}
                      >
                        {r.permissions.length}
                      </span>

                      {!r.isSystem && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditRole(r);
                            }}
                            className="p-1.5 rounded text-muted hover:text-foreground hover:bg-surface-3 cursor-pointer transition-colors"
                            title="Sửa thông tin vai trò"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteRole(r);
                            }}
                            className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                            title="Xóa vai trò này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      <ChevronRight
                        className={`h-3.5 w-3.5 text-muted transition-transform ${
                          isSelected ? "text-accent translate-x-0.5" : ""
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Create Role CTA */}
            <div className="pt-2 border-t border-line/60">
              <Button
                variant="outline"
                size="sm"
                onClick={openCreateRole}
                className="w-full text-xs font-bold border-dashed border-line-strong hover:border-accent hover:text-accent"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Tạo vai trò mới
              </Button>
            </div>
          </div>

          {/* Right Column: Permission Matrix */}
          <div className="flex flex-col overflow-hidden bg-background">
            {/* Header of Selected Role */}
            <div className="flex items-center justify-between border-b border-line p-4 bg-surface/40 backdrop-blur-md gap-4 flex-wrap">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full shadow-sm"
                      style={{ backgroundColor: selectedRole?.color || "#6366f1" }}
                    />
                    {selectedRole?.name}
                  </h2>
                  <span className="rounded-md bg-surface-2 border border-line px-2 py-0.5 text-[10px] font-mono font-bold text-muted">
                    KEY: {selectedRole?.key}
                  </span>
                  {selectedRole?.isSystem ? (
                    <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                      Vai trò hệ thống mặc định
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                      Vai trò tùy chỉnh (Custom)
                    </span>
                  )}
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted font-medium">
                    👤 {selectedRole?.userCount || 0} tài khoản đang áp dụng
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {selectedRole?.description || "Chưa có mô tả chi tiết cho vai trò này."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedRole && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditRole(selectedRole)}
                    className="h-8 text-xs font-semibold cursor-pointer"
                    title="Chỉnh sửa tên, màu sắc, mô tả vai trò"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Sửa thông tin
                  </Button>
                )}

                {selectedRole && !selectedRole.isSystem && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => confirmDeleteRole(selectedRole)}
                    disabled={deletingRole}
                    className="h-8 text-xs font-bold text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/50 cursor-pointer shadow-sm"
                    title="Xóa vai trò tùy chỉnh này khỏi hệ thống"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa vai trò
                  </Button>
                )}

                {selectedRole && selectedRole.isSystem && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-line text-[11px] font-semibold text-muted"
                    title="Vai trò hệ thống mặc định được bảo vệ để đảm bảo an toàn vận hành"
                  >
                    <Lock className="h-3 w-3 text-muted/70" /> Vai trò hệ thống
                  </span>
                )}

                <Button
                  size="sm"
                  onClick={savePermissions}
                  disabled={savingPermissions || selectedRole?.key === "ADMIN"}
                  className="h-8 text-xs font-bold bg-accent hover:bg-accent/90 text-white shadow-md shadow-accent/25 cursor-pointer"
                >
                  {savingPermissions ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  Lưu phân quyền
                </Button>
              </div>
            </div>

            {/* Quick Bulk Tools Bar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-line bg-surface-2/30 text-xs gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-muted">
                <span>
                  Đang cấp:{" "}
                  <strong className="text-accent font-bold">
                    {selectedRole?.key === "ADMIN"
                      ? categories.reduce((sum, c) => sum + c.permissions.length, 0)
                      : activePermissions.length}
                  </strong>
                  /{categories.reduce((sum, c) => sum + c.permissions.length, 0)} quyền
                </span>
                {selectedRole?.key === "ADMIN" && (
                  <span className="text-[11px] text-amber-600 font-medium">
                    (ADMIN luôn sở hữu toàn bộ quyền trong hệ thống)
                  </span>
                )}
              </div>

              {selectedRole?.key !== "ADMIN" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted font-medium">Thao tác nhanh:</span>
                  <button
                    type="button"
                    onClick={handleSelectAllPermissions}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-2 hover:bg-surface border border-line text-[11px] font-bold text-foreground cursor-pointer transition-colors"
                  >
                    <CheckSquare className="h-3 w-3 text-emerald-600" /> Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllPermissions}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[11px] font-bold text-red-500 cursor-pointer transition-colors"
                    title="Xóa toàn bộ quyền đã chọn của vai trò này"
                  >
                    <Trash2 className="h-3 w-3" /> Xóa toàn bộ quyền
                  </button>

                  <div className="h-3.5 w-[1px] bg-line mx-1" />

                  <span className="text-[11px] text-muted">Sao chép mẫu từ:</span>
                  <Dropdown
                    value=""
                    options={[
                      { label: "-- Chọn vai trò mẫu --", value: "", disabled: true },
                      ...roles.map((r) => ({ label: `${r.name} (${r.permissions.length} quyền)`, value: r.key })),
                    ]}
                    onChange={(e) => {
                      if (e.value) {
                        handleApplyPreset(e.value);
                      }
                    }}
                    placeholder="-- Chọn vai trò mẫu --"
                    className="p-inputtext-sm h-6.5 text-[11px] bg-surface border border-line rounded-md"
                  />
                </div>
              )}
            </div>

            {/* Matrix Grid */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const catKeys = cat.permissions.map((p) => p.key);
                const selectedInCat =
                  selectedRole?.key === "ADMIN"
                    ? catKeys.length
                    : catKeys.filter((k) => activePermissions.includes(k)).length;
                const isAllSelectedInCat = selectedInCat === catKeys.length;

                return (
                  <div
                    key={cat.id}
                    className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-3 flex flex-col"
                  >
                    <div className="flex items-center justify-between border-b border-line pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{cat.name}</h4>
                        <p className="text-[10px] text-muted">{cat.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-accent">
                          {selectedInCat}/{catKeys.length}
                        </span>
                        {selectedRole?.key !== "ADMIN" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSelectCategoryPermissions(cat)}
                              disabled={isAllSelectedInCat}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Cấp toàn bộ quyền trong mục này"
                            >
                              + Cấp cả mục
                            </button>
                            <span className="text-muted/30">|</span>
                            <button
                              type="button"
                              onClick={() => handleDeselectCategoryPermissions(cat)}
                              disabled={selectedInCat === 0}
                              className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-500/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Xóa/Bỏ chọn toàn bộ quyền trong mục này"
                            >
                              ✕ Xóa quyền mục này
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 flex-1">
                      {cat.permissions.map((perm) => {
                        const isChecked =
                          activePermissions.includes(perm.key) || selectedRole?.key === "ADMIN";
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-start gap-2 p-2 rounded-xl transition-all ${
                              selectedRole?.key === "ADMIN"
                                ? "cursor-not-allowed opacity-90"
                                : "hover:bg-surface-2 cursor-pointer"
                            } ${isChecked ? "bg-surface-2/60 border border-accent/20" : "border border-transparent"}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="mt-0.5 h-3.5 w-3.5 accent-accent cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-foreground flex items-center justify-between">
                                <span>{perm.name}</span>
                                <span className="text-[9px] font-mono text-muted/70">{perm.key}</span>
                              </div>
                              <div className="text-[10px] text-muted">{perm.description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* MODAL: TẠO / SỬA NHÓM (CREATE / EDIT TEAM DIALOG) */}
      {/* ========================================================================= */}
      <Dialog
        header={editingTeam ? `Chỉnh sửa Nhóm: ${editingTeam.name}` : "Tạo Nhóm / Phòng Ban Mới"}
        visible={createTeamOpen || editTeamOpen}
        onHide={() => {
          setCreateTeamOpen(false);
          setEditTeamOpen(false);
          setEditingTeam(null);
        }}
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tên phòng ban / nhóm *</Label>
            <Input
              placeholder="VD: Phòng Kỹ thuật Phần cứng & Bo mạch"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="text-xs h-9 bg-surface-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mã nhóm (Viết tắt in hoa) *</Label>
              <Input
                placeholder="VD: HARDWARE, QA_QC"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                className="text-xs h-9 bg-surface-2 font-mono uppercase"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Trưởng nhóm (Leader)</Label>
              <Dropdown
                value={teamLeaderId || ""}
                options={[
                  { label: "Chưa chỉ định trưởng nhóm", value: "" },
                  ...users.map((u) => ({ label: `${u.name} (${u.title || u.role})`, value: u.id })),
                ]}
                onChange={(e) => setTeamLeaderId(e.value || null)}
                className="h-9 w-full text-xs bg-surface-2 border border-line rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả chức năng nhiệm vụ</Label>
            <Textarea
              placeholder="Nhiệm vụ cốt lõi của phòng ban/nhóm..."
              value={teamDesc}
              onChange={(e) => setTeamDesc(e.target.value)}
              rows={2}
              className="text-xs bg-surface-2"
            />
          </div>

          {/* Members Multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Phân bổ nhân sự vào nhóm ({teamMemberIds.length} đã chọn)</Label>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-line bg-surface-2/40 p-2 space-y-1">
              {users.map((u) => {
                const isMember = teamMemberIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isMember}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTeamMemberIds((prev) => [...prev, u.id]);
                          } else {
                            setTeamMemberIds((prev) => prev.filter((id) => id !== u.id));
                          }
                        }}
                        className="h-3.5 w-3.5 accent-accent cursor-pointer"
                      />
                      <Avatar className="h-5 w-5">
                        <AvatarFallback color={u.avatarColor} className="text-[8px]">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{u.name}</span>
                    </div>
                    <span className="text-[10px] text-muted">{u.title || u.role}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Màu đại diện nhóm</Label>
            <div className="flex items-center gap-2 pt-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTeamColor(c)}
                  className="h-6 w-6 rounded-full cursor-pointer transition-transform flex items-center justify-center"
                  style={{
                    backgroundColor: c,
                    transform: teamColor === c ? "scale(1.2)" : "scale(1)",
                    border: teamColor === c ? "2px solid white" : "none",
                  }}
                >
                  {teamColor === c && <Check className="h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateTeamOpen(false);
                setEditTeamOpen(false);
                setEditingTeam(null);
              }}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={savingTeam} className="font-bold bg-accent hover:bg-accent/90 text-white">
              {savingTeam ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {editingTeam ? "Lưu cập nhật" : "Tạo nhóm mới"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: TẠO / SỬA USER (CREATE / EDIT USER DIALOG) */}
      {/* ========================================================================= */}
      <Dialog
        header={editingUser ? `Cập nhật tài khoản: ${editingUser.name}` : "Thêm Nhân Sự Mới"}
        visible={createUserOpen || editUserOpen}
        onHide={() => {
          setCreateUserOpen(false);
          setEditUserOpen(false);
          setEditingUser(null);
        }}
        className="w-full max-w-md border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-3.5 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Họ và tên *</Label>
            <Input
              value={editingUser ? editName : createName}
              onChange={(e) => (editingUser ? setEditName(e.target.value) : setCreateName(e.target.value))}
              className="text-xs h-9 bg-surface-2"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Email công ty *</Label>
            <Input
              type="email"
              value={editingUser ? editEmail : createEmail}
              onChange={(e) => (editingUser ? setEditEmail(e.target.value) : setCreateEmail(e.target.value))}
              className="text-xs h-9 bg-surface-2 font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                {editingUser ? "Mật khẩu mới (Tùy chọn)" : "Mật khẩu khởi tạo *"}
              </Label>
              {editingUser && <span className="text-[10px] text-muted">Để trống nếu giữ nguyên</span>}
            </div>
            <Input
              type="password"
              placeholder={editingUser ? "••••••••" : "Tối thiểu 6 ký tự..."}
              value={editingUser ? editPassword : createPassword}
              onChange={(e) => (editingUser ? setEditPassword(e.target.value) : setCreatePassword(e.target.value))}
              className="text-xs h-9 bg-surface-2 font-mono"
              required={!editingUser}
              minLength={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Chức danh</Label>
              <Input
                value={editingUser ? editTitle : createTitle}
                onChange={(e) => (editingUser ? setEditTitle(e.target.value) : setCreateTitle(e.target.value))}
                placeholder="VD: Senior Hardware"
                className="text-xs h-9 bg-surface-2"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Vai trò hệ thống</Label>
              <Dropdown
                value={editingUser ? editRole : createRole}
                options={roles.map((r) => ({ label: r.name, value: r.key }))}
                onChange={(e) => (editingUser ? setEditRole(e.value) : setCreateRole(e.value))}
                className="h-9 w-full text-xs bg-surface-2 border border-line rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              Số điện thoại
              <span className="text-[10px] text-muted font-normal normal-case">(dùng gửi thông báo Zalo ZNS)</span>
            </Label>
            <Input
              value={editingUser ? editPhone : createPhone}
              onChange={(e) => (editingUser ? setEditPhone(e.target.value) : setCreatePhone(e.target.value))}
              placeholder="VD: 0983090189"
              className="text-xs h-9 bg-surface-2 font-mono"
            />
            {editingUser?.zaloUserId && (
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 pt-0.5">
                <MessageCircle className="h-3 w-3" /> User đã tự liên kết Zalo (nhận thông báo qua OA miễn phí)
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              Discord User ID
              <span className="text-[10px] text-muted font-normal normal-case">(dùng gửi DM Discord — cần Bật Chế độ Nhà phát triển trong Discord để lấy ID)</span>
            </Label>
            <Input
              value={editingUser ? editDiscordUserId : createDiscordUserId}
              onChange={(e) => (editingUser ? setEditDiscordUserId(e.target.value) : setCreateDiscordUserId(e.target.value))}
              placeholder="VD: 123456789012345678"
              className="text-xs h-9 bg-surface-2 font-mono"
            />
            {editingUser?.discordUserId && (
              <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 pt-0.5">
                <Hash className="h-3 w-3" />
                {editingUser.discordUsername
                  ? `Đã liên kết Discord: ${editingUser.discordUsername}`
                  : "Đã gắn Discord User ID (nhập tay, chưa xác thực qua OAuth)"}
              </p>
            )}
          </div>

          {/* Team / Department Assignment */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Thuộc Nhóm / Phòng ban</Label>
            <Dropdown
              value={editingUser ? editTeamId || "" : createTeamId || ""}
              options={[
                { label: "Chưa phân nhóm", value: "" },
                ...teams.map((t) => ({ label: `🏢 ${t.name} (${t.code})`, value: t.id })),
              ]}
              onChange={(e) =>
                editingUser
                  ? setEditTeamId(e.value || null)
                  : setCreateTeamId(e.value || null)
              }
              className="h-9 w-full text-xs bg-surface-2 border border-line rounded-lg"
            />
          </div>

          {/* Avatar Color */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Màu Avatar</Label>
            <div className="flex items-center gap-2 pt-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => (editingUser ? setEditColor(c) : setCreateColor(c))}
                  className="h-6 w-6 rounded-full cursor-pointer transition-transform flex items-center justify-center"
                  style={{
                    backgroundColor: c,
                    transform: (editingUser ? editColor : createColor) === c ? "scale(1.2)" : "scale(1)",
                    border: (editingUser ? editColor : createColor) === c ? "2px solid white" : "none",
                  }}
                >
                  {(editingUser ? editColor : createColor) === c && <Check className="h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateUserOpen(false);
                setEditUserOpen(false);
                setEditingUser(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creatingUser || updatingUser}
              className="font-bold bg-accent hover:bg-accent/90 text-white"
            >
              {creatingUser || updatingUser ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              {editingUser ? "Lưu cập nhật" : "Tạo tài khoản"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: TẠO VAI TRÒ MỚI (CREATE CUSTOM ROLE DIALOG) */}
      {/* ========================================================================= */}
      <Dialog
        header="Tạo Vai Trò & Phân Quyền Tùy Ý"
        visible={createRoleOpen}
        onHide={() => setCreateRoleOpen(false)}
        className="w-full max-w-lg border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleCreateRole} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tên vai trò mới *</Label>
            <Input
              placeholder="VD: Trưởng nhóm R&D, UI/UX Designer, DevOps Lead..."
              value={newRoleName}
              onChange={(e) => {
                const val = e.target.value;
                setNewRoleName(val);
                if (!newRoleKey || newRoleKey === newRoleName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")) {
                  const slug = val
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "_")
                    .replace(/_+/g, "_");
                  setNewRoleKey(slug);
                }
              }}
              className="text-xs h-9 bg-surface-2"
              required
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Mã Key vai trò (In hoa & gạch dưới) *</Label>
              <span className="text-[10px] text-muted">Dùng định danh trong phân quyền</span>
            </div>
            <Input
              placeholder="VD: RD_LEAD, DESIGNER, DEVOPS"
              value={newRoleKey}
              onChange={(e) => setNewRoleKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
              className="text-xs h-9 bg-surface-2 font-mono uppercase"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả chức năng & quyền hạn</Label>
            <Textarea
              placeholder="Mô tả tóm tắt vai trò và phạm vi công việc..."
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              rows={2}
              className="text-xs bg-surface-2"
            />
          </div>

          {/* Sao chép mẫu quyền */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Sao chép mẫu quyền hạn ban đầu từ</Label>
            <Dropdown
              value={newRolePreset}
              options={roles.map((r) => ({ label: `${r.name} (${r.permissions.length} quyền)`, value: r.key }))}
              onChange={(e) => setNewRolePreset(e.value)}
              className="h-9 w-full text-xs bg-surface-2 border border-line rounded-lg"
            />
          </div>

          {/* Màu đại diện vai trò */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Màu sắc nhận diện vai trò</Label>
            <div className="flex items-center gap-2 pt-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewRoleColor(c)}
                  className="h-6 w-6 rounded-full cursor-pointer transition-transform flex items-center justify-center"
                  style={{
                    backgroundColor: c,
                    transform: newRoleColor === c ? "scale(1.2)" : "scale(1)",
                    border: newRoleColor === c ? "2px solid white" : "none",
                  }}
                >
                  {newRoleColor === c && <Check className="h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateRoleOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creatingRole}
              className="font-bold bg-accent hover:bg-accent/90 text-white"
            >
              {creatingRole ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Tạo vai trò
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: SỬA VAI TRÒ (EDIT ROLE DIALOG) */}
      {/* ========================================================================= */}
      <Dialog
        header={`Chỉnh sửa vai trò: ${editingRoleItem?.name}`}
        visible={editRoleOpen}
        onHide={() => setEditRoleOpen(false)}
        className="w-full max-w-md border border-line bg-surface rounded-2xl shadow-2xl"
      >
        <form onSubmit={handleUpdateRoleInfo} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Tên vai trò *</Label>
            <Input
              value={editRoleName}
              onChange={(e) => setEditRoleName(e.target.value)}
              className="text-xs h-9 bg-surface-2"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mã Key vai trò (Không thay đổi)</Label>
            <Input
              value={editingRoleItem?.key || ""}
              readOnly
              disabled
              className="text-xs h-9 bg-surface-2 font-mono opacity-70 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Mô tả vai trò</Label>
            <Textarea
              value={editRoleDesc}
              onChange={(e) => setEditRoleDesc(e.target.value)}
              rows={2}
              className="text-xs bg-surface-2"
            />
          </div>

          {/* Màu đại diện vai trò */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Màu sắc nhận diện vai trò</Label>
            <div className="flex items-center gap-2 pt-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditRoleColor(c)}
                  className="h-6 w-6 rounded-full cursor-pointer transition-transform flex items-center justify-center"
                  style={{
                    backgroundColor: c,
                    transform: editRoleColor === c ? "scale(1.2)" : "scale(1)",
                    border: editRoleColor === c ? "2px solid white" : "none",
                  }}
                >
                  {editRoleColor === c && <Check className="h-3 w-3 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-line">
            {!editingRoleItem?.isSystem ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditRoleOpen(false);
                  if (editingRoleItem) confirmDeleteRole(editingRoleItem);
                }}
                className="text-xs font-bold text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/50 cursor-pointer mr-auto"
                title="Xóa vai trò này"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa vai trò
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditRoleOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updatingRole}
                className="font-bold bg-accent hover:bg-accent/90 text-white cursor-pointer"
              >
                {updatingRole ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA VAI TRÒ (CONFIRM DELETE ROLE DIALOG) */}
      {/* ========================================================================= */}
      <Dialog
        header="Xác Nhận Xóa Vai Trò"
        visible={deleteRoleConfirmOpen}
        onHide={() => setDeleteRoleConfirmOpen(false)}
        className="w-full max-w-md border border-red-500/30 bg-surface rounded-2xl shadow-2xl"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold">Hành động này sẽ xóa vĩnh viễn cấu hình vai trò!</div>
              <div className="text-muted leading-relaxed">
                Bạn đang chuẩn bị xóa vai trò <strong className="text-foreground">{roleToDelete?.name}</strong> (Mã key: <code className="font-mono text-[11px] bg-surface-2 px-1 py-0.5 rounded">{roleToDelete?.key}</code>).
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/60 p-3.5 space-y-2 text-xs">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Tác động nhân sự:</div>
            <div className="font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <span>{roleToDelete?.userCount || 0} tài khoản đang được gán vai trò này</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Sau khi xóa, tất cả các tài khoản nhân sự và thành viên dự án đang giữ vai trò này sẽ tự động được chuyển về vai trò <strong>&quot;Thành viên (Member)&quot;</strong> để đảm bảo hệ thống không bị gián đoạn.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteRoleConfirmOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={deletingRole}
              onClick={executeDeleteRole}
              className="font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 cursor-pointer"
            >
              {deletingRole ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1" />
              )}
              Xác nhận xóa vai trò
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
