import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { PermissionsProvider } from "@/lib/permissions-context";
import { getUserPermissionContext } from "@/lib/permissions-server";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const [initialProject, projects] = await Promise.all([
    prisma.project.findFirst({
      where: user.role === "ADMIN"
        ? { OR: [{ id: projectId }, { key: projectId }] }
        : { OR: [{ id: projectId }, { key: projectId }], members: { some: { userId: user.id } } },
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
    prisma.project.findMany({
      where: user.role === "ADMIN" ? undefined : { members: { some: { userId: user.id } } },
      select: { id: true, name: true, key: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  let project = initialProject;

  if (!project) {
    project = await prisma.project.findFirst({
      where: user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } },
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
      orderBy: { createdAt: "asc" },
    });
  }

  if (!project) redirect("/");

  const permCtx = await getUserPermissionContext(user.id, project.id, user.role);

  return (
    <PermissionsProvider
      projectId={project.id}
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
          id: project.id,
          name: project.name,
          key: project.key,
          members: project.members.map((m) => ({
            id: m.id,
            role: m.role,
            user: m.user,
          })),
        }}
        projects={projects}
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
