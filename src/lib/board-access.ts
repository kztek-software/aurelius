import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

// Giới hạn số project trong 1 lần chọn tường minh (tránh query IN quá dài)
const MAX_SELECTED_PROJECTS = 100;

export type BoardProjectAccess = {
  id: string;
  role: string; // vai trò của user trong project (ADMIN hệ thống không là member => OWNER)
};

/**
 * Phân tích query `projects` của Board đa dự án:
 * - "all" hoặc rỗng => tất cả dự án user có quyền truy cập
 * - "id1,id2,KEY3" => danh sách id hoặc key dự án
 */
export function parseBoardProjectsParam(raw: string | null | undefined): string[] | "ALL" {
  const value = (raw ?? "").trim();
  if (!value || value.toLowerCase() === "all") return "ALL";
  const ids = Array.from(new Set(value.split(",").map((s) => s.trim()).filter(Boolean)));
  return ids.length ? ids.slice(0, MAX_SELECTED_PROJECTS) : "ALL";
}

/**
 * Lọc danh sách project được yêu cầu, CHỈ giữ lại project mà user có quyền xem
 * (là thành viên, hoặc ADMIN hệ thống). Kiểm tra hoàn toàn phía server — không tin
 * danh sách id client gửi lên. Project không tồn tại / không có quyền bị bỏ qua im lặng.
 *
 * "ALL" = mọi dự án user là THÀNH VIÊN — kể cả ADMIN (tránh tải toàn bộ dữ liệu hệ thống);
 * ADMIN muốn xem dự án mình không tham gia thì chọn tường minh theo id/key.
 */
export async function resolveBoardProjects(
  user: SessionUser,
  requested: string[] | "ALL"
): Promise<BoardProjectAccess[]> {
  const isAdmin = user.role === "ADMIN";
  const memberOnly = { members: { some: { userId: user.id } } };

  const projects = await prisma.project.findMany({
    where:
      requested === "ALL"
        ? memberOnly
        : {
            ...(isAdmin ? {} : memberOnly),
            OR: [{ id: { in: requested } }, { key: { in: requested } }],
          },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (projects.length === 0) return [];

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id, projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true, role: true },
  });
  const roleByProject = new Map(memberships.map((m) => [m.projectId, m.role]));

  return projects.map((p) => ({
    id: p.id,
    // Giữ đúng quy ước của GET /api/projects/[projectId]/tasks
    role: roleByProject.get(p.id) ?? (isAdmin ? "OWNER" : "MEMBER"),
  }));
}
