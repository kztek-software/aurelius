import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Route cũ /projects/[projectId]/board — Board Công Việc đã chuyển ra /board (đa dự án).
 * Giữ lại để không gãy link cũ (email, thông báo, bookmark): chuyển hướng sang /board
 * với đúng dự án này được chọn, giữ nguyên các query khác (taskId, sprintId...).
 * Quyền truy cập dự án được kiểm tra lại ở /board và API /api/board.
 */
export default async function LegacyProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ projectId }, query, user] = await Promise.all([params, searchParams, getSessionUser()]);
  if (!user) redirect("/login");

  // projectId trên URL có thể là id hoặc key dự án -> quy về id (chỉ dự án user có quyền)
  const project = await prisma.project.findFirst({
    where:
      user.role === "ADMIN"
        ? { OR: [{ id: projectId }, { key: projectId }] }
        : { OR: [{ id: projectId }, { key: projectId }], members: { some: { userId: user.id } } },
    select: { id: true },
  });

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "projects" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) next.append(key, v);
  }
  if (project) next.set("projects", project.id);

  const qs = next.toString();
  redirect(qs ? `/board?${qs}` : "/board");
}
