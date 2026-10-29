import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PermissionsProvider } from "@/lib/permissions-context";
import { getUserPermissionContext } from "@/lib/permissions-server";
import { parseBoardProjectsParam } from "@/lib/board-access";
import { BoardView } from "./board-view";

export const dynamic = "force-dynamic";

/**
 * Board Công Việc cấp ngoài (không gắn với 1 dự án): /board?projects=all|id1,id2
 * Sidebar vẫn cần 1 "dự án ngữ cảnh" (switcher, thành viên, link cài đặt...) —
 * lấy dự án đầu tiên trong lựa chọn trên URL, mặc định là dự án đầu tiên user có quyền.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const projectRows = await prisma.project.findMany({
    where: user.role === "ADMIN" ? undefined : { members: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      key: true,
      status: true,
      members: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (projectRows.length === 0) redirect("/welcome");

  const projects = projectRows.map(({ id, name, key, status }) => ({ id, name, key, status }));
  // "Tất cả dự án" trên Board chỉ gồm dự án user là thành viên (kể cả ADMIN) — khớp /api/board
  const memberProjectIds = projectRows.filter((p) => p.members.length > 0).map((p) => p.id);

  const { projects: projectsQuery } = await searchParams;
  const requested = parseBoardProjectsParam(typeof projectsQuery === "string" ? projectsQuery : null);
  const contextProjectId =
    (requested !== "ALL" &&
      projects.find((p) => requested.includes(p.id) || requested.includes(p.key))?.id) ||
    memberProjectIds[0] ||
    projects[0].id;

  const [contextProject, permCtx] = await Promise.all([
    prisma.project.findUnique({
      where: { id: contextProjectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
                title: true,
                team: { select: { id: true, name: true, code: true, color: true } },
              },
            },
          },
        },
      },
    }),
    getUserPermissionContext(user.id, contextProjectId, user.role),
  ]);
  if (!contextProject) redirect("/");

  return (
    <PermissionsProvider
      projectId={contextProject.id}
      initialPermissions={permCtx.permissions}
      initialRole={permCtx.role}
      initialProjectRole={permCtx.projectRole}
      initialIsAdmin={permCtx.isAdmin}
      initialIsOwner={permCtx.isOwner}
      initialCanCreateProject={permCtx.canCreateProject}
    >
      <AppShell
        user={user}
        project={{
          id: contextProject.id,
          name: contextProject.name,
          key: contextProject.key,
          status: contextProject.status,
          members: contextProject.members.map((m) => ({
            id: m.id,
            role: m.role,
            user: m.user,
          })),
        }}
        projects={projects}
      >
        <BoardView
          userId={user.id}
          projects={projects}
          memberProjectIds={memberProjectIds}
          defaultProjectId={contextProject.id}
        />
      </AppShell>
    </PermissionsProvider>
  );
}
