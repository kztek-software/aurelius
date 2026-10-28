"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type PermissionsContextType = {
  permissions: string[];
  role: string;
  projectRole: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  canCreateProject: boolean;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  canAll: (...permissions: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
};

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: [],
  role: "MEMBER",
  projectRole: null,
  isAdmin: false,
  isOwner: false,
  canCreateProject: false,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  refreshPermissions: async () => {},
});

export function PermissionsProvider({
  children,
  projectId,
  initialPermissions = [],
  initialRole = "MEMBER",
  initialProjectRole = null,
  initialIsAdmin = false,
  initialIsOwner = false,
  initialCanCreateProject = false,
}: {
  children: React.ReactNode;
  projectId?: string;
  initialPermissions?: string[];
  initialRole?: string;
  initialProjectRole?: string | null;
  initialIsAdmin?: boolean;
  initialIsOwner?: boolean;
  initialCanCreateProject?: boolean;
}) {
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);
  const [role, setRole] = useState<string>(initialRole);
  const [projectRole, setProjectRole] = useState<string | null>(initialProjectRole);
  const [isAdmin, setIsAdmin] = useState<boolean>(initialIsAdmin);
  const [isOwner, setIsOwner] = useState<boolean>(initialIsOwner);
  const [canCreateProject, setCanCreateProject] = useState<boolean>(initialCanCreateProject);

  const refreshPermissions = useCallback(async () => {
    try {
      const url = projectId ? `/api/auth/me?projectId=${projectId}` : "/api/auth/me";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || []);
        setRole(data.role || "MEMBER");
        setProjectRole(data.projectRole || null);
        setIsAdmin(Boolean(data.isAdmin));
        setIsOwner(Boolean(data.isOwner));
        setCanCreateProject(Boolean(data.canCreateProject));
      }
    } catch (err) {
      console.error("Lỗi cập nhật phân quyền:", err);
    }
  }, [projectId]);

  useEffect(() => {
    // Initial fetch if empty (khi layout không truyền initialPermissions)
    if (permissions.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được biên async
      refreshPermissions();
    }

    // Lắng nghe sự kiện toàn cục khi phân quyền hoặc vai trò thay đổi
    // (được dispatch tường minh từ admin actions, KHÔNG dùng window.focus vì
    //  nó trigger re-fetch trên mỗi lần user đổi tab → gây storm DB queries)
    const handlePermissionsUpdated = () => {
      refreshPermissions();
    };

    window.addEventListener("permissions-updated", handlePermissionsUpdated);

    return () => {
      window.removeEventListener("permissions-updated", handlePermissionsUpdated);
    };
  }, [refreshPermissions, permissions.length]);

  const can = useCallback(
    (perm: string) => {
      if (isAdmin) return true;
      if (isOwner) {
        // Owner có toàn quyền trong dự án (trừ system.*)
        const isSystem =
          perm.startsWith("system.") ||
          perm === "users.manage" ||
          perm === "roles.manage" ||
          perm === "email.config";
        if (!isSystem) return true;
      }
      return permissions.includes(perm);
    },
    [isAdmin, isOwner, permissions]
  );

  const canAny = useCallback(
    (...perms: string[]) => {
      if (isAdmin) return true;
      return perms.some((p) => can(p));
    },
    [isAdmin, can]
  );

  const canAll = useCallback(
    (...perms: string[]) => {
      if (isAdmin) return true;
      return perms.every((p) => can(p));
    },
    [isAdmin, can]
  );

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        role,
        projectRole,
        isAdmin,
        isOwner,
        canCreateProject,
        can,
        canAny,
        canAll,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
