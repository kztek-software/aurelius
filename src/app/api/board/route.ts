import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseBoardProjectsParam, resolveBoardProjects } from "@/lib/board-access";

const taskInclude = {
  assignee: { select: { id: true, name: true, avatarColor: true } },
  labels: { include: { label: true } },
  subtasks: true,
  attachments: true,
  _count: { select: { comments: true } },
} as const;

/**
 * GET /api/board?projects=all|id1,id2,...
 * Dữ liệu Board Công Việc của NHIỀU dự án cùng lúc. Chỉ trả về dữ liệu của các dự án
 * mà user là thành viên (hoặc ADMIN hệ thống); id không có quyền bị loại bỏ phía server.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const requested = parseBoardProjectsParam(req.nextUrl.searchParams.get("projects"));
    const access = await resolveBoardProjects(user, requested);
    const projectIds = access.map((a) => a.id);
    const roleByProject = new Map(access.map((a) => [a.id, a.role]));

    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [], tasks: [], sprints: [], labels: [], members: [] });
    }

    return NextResponse.json(await loadBoardData(projectIds, roleByProject));
  } catch (err: unknown) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/board error:", err);
    return NextResponse.json({ error: "Lỗi tải Board công việc" }, { status: 500 });
  }
}

async function loadBoardData(projectIds: string[], roleByProject: Map<string, string>) {
  const [projects, tasks, sprints, labels, members] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: projectIds } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      include: taskInclude,
      orderBy: { position: "asc" },
    }),
    prisma.sprint.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: "asc" } }),
    prisma.label.findMany({ where: { projectId: { in: projectIds } }, orderBy: { name: "asc" } }),
    prisma.projectMember.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
            title: true,
            team: { select: { id: true, name: true, code: true, color: true } },
          },
        },
      },
    }),
  ]);

  return {
    projects: projects.map((p) => ({ ...p, currentRole: roleByProject.get(p.id) ?? "MEMBER" })),
    tasks,
    sprints,
    labels,
    members,
  };
}
