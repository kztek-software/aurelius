import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTicketsByProject } from "@/lib/tickets";
import { TicketListView } from "@/components/tickets/ticket-list-view";

export const dynamic = "force-dynamic";

export default async function ProjectTicketsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const [project, sprints, members, ticketData] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, members: { some: { userId: user.id } } },
      select: { id: true, name: true, key: true, description: true },
    }),
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, avatarColor: true, title: true } },
      },
    }),
    getTicketsByProject(projectId),
  ]);

  if (!project) redirect("/");

  return (
    <TicketListView
      project={project}
      sprints={sprints.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        status: s.status,
        startDate: s.startDate ? s.startDate.toISOString() : null,
        endDate: s.endDate ? s.endDate.toISOString() : null,
      }))}
      members={members.map((m) => ({
        id: m.id,
        role: m.role,
        user: m.user,
      }))}
      initialTickets={ticketData.tickets}
      initialStats={ticketData.stats}
    />
  );
}
