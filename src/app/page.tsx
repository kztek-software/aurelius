import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  // 1. Tìm project đầu tiên mà user có quyền truy cập
  const targetProject = await prisma.project.findFirst({
    where: user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  // 2. Nếu user chưa tham gia project nào, chuyển hướng về trang /welcome
  if (!targetProject) {
    redirect("/welcome");
  }

  // 3. Chuyển hướng về Dashboard của dự án
  redirect(`/projects/${targetProject.id}/dashboard`);
}
