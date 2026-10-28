import { publish } from "@/lib/bus";
import { prisma } from "@/lib/prisma";
import type { CustomerTicketDto, TicketCommentDto, AttachmentDto } from "@/lib/types";

export function generateTrackingCode(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 4; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TK-${dateStr}-${random}`;
}

export type CreateTicketParams = {
  projectId?: string | null;
  title: string;
  description: string;
  type?: string;
  priority?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  environment?: string | null;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number | null;
    mimeType?: string | null;
  }>;
};

export async function createTicket(params: CreateTicketParams): Promise<CustomerTicketDto> {
  let trackingCode = generateTrackingCode();
  
  // Ensure unique tracking code
  while (true) {
    const existing = await prisma.customerTicket.findUnique({ where: { trackingCode } });
    if (!existing) break;
    trackingCode = generateTrackingCode();
  }

  const created = await prisma.customerTicket.create({
    data: {
      trackingCode,
      projectId: params.projectId || null,
      title: params.title,
      description: params.description,
      type: params.type || "BUG",
      status: "OPEN",
      priority: params.priority || "MEDIUM",
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone || null,
      customerCompany: params.customerCompany || null,
      environment: params.environment || null,
      attachments: params.attachments && params.attachments.length > 0 ? {
        create: params.attachments.map(att => ({
          fileName: att.fileName,
          fileUrl: att.fileUrl,
          fileType: att.fileType || "other",
          fileSize: att.fileSize || null,
          mimeType: att.mimeType || null,
        }))
      } : undefined,
    },
    include: {
      comments: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      project: { select: { id: true, name: true, key: true } },
      convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
    }
  });

  if (params.projectId) {
    publish(params.projectId, {
      type: "TICKET_CREATED",
      ticketId: created.id,
      actorId: "customer",
    });
  }

  return formatPrismaTicket(created, false);
}

export async function getTicketByTrackingCode(trackingCode: string): Promise<CustomerTicketDto | null> {
  const row = await prisma.customerTicket.findFirst({
    where: { trackingCode: { equals: trackingCode } },
    include: {
      comments: { where: { isInternalOnly: false }, orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      project: { select: { id: true, name: true, key: true } },
      convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
    }
  });

  if (!row) return null;
  return formatPrismaTicket(row, false);
}

export async function getTicketById(id: string, includeInternal = true): Promise<CustomerTicketDto | null> {
  const row = await prisma.customerTicket.findUnique({
    where: { id },
    include: {
      comments: {
        where: includeInternal ? undefined : { isInternalOnly: false },
        orderBy: { createdAt: "asc" }
      },
      attachments: { orderBy: { createdAt: "asc" } },
      project: { select: { id: true, name: true, key: true } },
      convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
    }
  });

  if (!row) return null;
  return formatPrismaTicket(row, includeInternal);
}

export async function getTicketsByProject(
  projectId: string,
  options?: {
    status?: string;
    priority?: string;
    type?: string;
    search?: string;
    unassignedOnly?: boolean;
    includeUnassigned?: boolean;
  }
): Promise<{
  tickets: CustomerTicketDto[];
  stats: {
    total: number;
    open: number;
    triaged: number;
    inProgress: number;
    resolved: number;
    closed: number;
    unassigned: number;
  };
}> {
  const whereClause: any = {};

  if (options?.unassignedOnly || projectId === "UNASSIGNED") {
    whereClause.projectId = null;
  } else if (projectId === "ALL") {
    // No project restriction
  } else if (options?.includeUnassigned) {
    whereClause.OR = [{ projectId }, { projectId: null }];
  } else {
    whereClause.projectId = projectId;
  }

  if (options?.status && options.status !== "ALL") {
    whereClause.status = options.status;
  }

  if (options?.priority && options.priority !== "ALL") {
    whereClause.priority = options.priority;
  }

  if (options?.type && options.type !== "ALL") {
    whereClause.type = options.type;
  }

  if (options?.search && options.search.trim()) {
    const term = options.search.trim();
    whereClause.AND = [
      ...(whereClause.AND || []),
      {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { trackingCode: { contains: term, mode: "insensitive" } },
          { customerName: { contains: term, mode: "insensitive" } },
          { customerEmail: { contains: term, mode: "insensitive" } },
        ]
      }
    ];
  }

  const [rows, allStatusCounts, unassignedCount] = await Promise.all([
    prisma.customerTicket.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } },
        project: { select: { id: true, name: true, key: true } },
        convertedTask: { select: { id: true, number: true, title: true, status: true, type: true } },
      }
    }),
    prisma.customerTicket.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: projectId === "ALL"
        ? undefined
        : options?.includeUnassigned
        ? { OR: [{ projectId }, { projectId: null }] }
        : { projectId }
    }),
    prisma.customerTicket.count({ where: { projectId: null } })
  ]);

  const stats = {
    total: 0,
    open: 0,
    triaged: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    unassigned: unassignedCount,
  };

  for (const r of allStatusCounts) {
    const count = r._count._all;
    stats.total += count;
    if (r.status === "OPEN") stats.open = count;
    else if (r.status === "TRIAGED") stats.triaged = count;
    else if (r.status === "IN_PROGRESS") stats.inProgress = count;
    else if (r.status === "RESOLVED") stats.resolved = count;
    else if (r.status === "CLOSED" || r.status === "REJECTED") stats.closed += count;
  }

  const tickets = rows.map((r) => formatPrismaTicket(r, true));
  return { tickets, stats };
}

export async function dispatchTicketToProject(params: {
  ticketId: string;
  targetProjectId: string;
  adminUser: { id: string; name: string };
}): Promise<CustomerTicketDto | null> {
  const targetProject = await prisma.project.findUnique({
    where: { id: params.targetProjectId },
    select: { id: true, name: true, key: true },
  });

  if (!targetProject) throw new Error("Không tìm thấy dự án đích để điều phối");

  const current = await prisma.customerTicket.findUnique({
    where: { id: params.ticketId },
    select: { status: true },
  });
  if (!current) throw new Error("Không tìm thấy ticket cần điều phối");

  const newStatus = current.status === "OPEN" ? "TRIAGED" : current.status;

  await prisma.customerTicket.update({
    where: { id: params.ticketId },
    data: {
      projectId: targetProject.id,
      status: newStatus,
    },
  });

  await addTicketComment({
    ticketId: params.ticketId,
    authorName: params.adminUser.name,
    isStaff: true,
    isInternalOnly: true,
    message: `[Điều phối hệ thống] Quản trị viên ${params.adminUser.name} đã điều phối ticket này tới dự án ${targetProject.name} (${targetProject.key}).`,
  });

  publish(targetProject.id, {
    type: "TICKET_UPDATED",
    ticketId: params.ticketId,
    actorId: params.adminUser.id,
  });

  return getTicketById(params.ticketId);
}

export async function updateTicket(
  id: string,
  data: {
    projectId?: string | null;
    status?: string;
    priority?: string;
    type?: string;
    internalNotes?: string | null;
    resolutionNotes?: string | null;
    convertedTaskId?: string | null;
  }
): Promise<CustomerTicketDto | null> {
  const current = await prisma.customerTicket.findUnique({ where: { id } });
  if (!current) return null;

  const now = new Date();
  let resolvedAt = current.resolvedAt;

  if (data.status === "RESOLVED" && current.status !== "RESOLVED") {
    resolvedAt = now;
  } else if (data.status && data.status !== "RESOLVED") {
    resolvedAt = null;
  }

  await prisma.customerTicket.update({
    where: { id },
    data: {
      projectId: data.projectId !== undefined ? data.projectId : undefined,
      status: data.status,
      priority: data.priority,
      type: data.type,
      internalNotes: data.internalNotes !== undefined ? data.internalNotes : undefined,
      resolutionNotes: data.resolutionNotes !== undefined ? data.resolutionNotes : undefined,
      convertedTaskId: data.convertedTaskId !== undefined ? data.convertedTaskId : undefined,
      resolvedAt,
    },
  });

  const finalProjectId = data.projectId !== undefined ? data.projectId : current.projectId;
  if (finalProjectId) {
    publish(finalProjectId, {
      type: "TICKET_UPDATED",
      ticketId: id,
      actorId: "staff",
    });
  }

  return getTicketById(id);
}

export async function addTicketComment(params: {
  ticketId: string;
  authorName: string;
  authorEmail?: string | null;
  isStaff?: boolean;
  isInternalOnly?: boolean;
  message: string;
}): Promise<TicketCommentDto> {
  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: params.ticketId,
      authorName: params.authorName,
      authorEmail: params.authorEmail || null,
      isStaff: !!params.isStaff,
      isInternalOnly: !!params.isInternalOnly,
      message: params.message,
    }
  });

  // Touch ticket's updatedAt
  const ticket = await prisma.customerTicket.update({
    where: { id: params.ticketId },
    data: { updatedAt: new Date() },
    select: { projectId: true }
  });

  if (ticket && ticket.projectId) {
    publish(ticket.projectId, {
      type: "TICKET_UPDATED",
      ticketId: params.ticketId,
      actorId: params.isStaff ? "staff" : "customer",
    });
  }

  return {
    id: comment.id,
    ticketId: comment.ticketId,
    authorName: comment.authorName,
    authorEmail: comment.authorEmail,
    isStaff: comment.isStaff,
    isInternalOnly: comment.isInternalOnly,
    message: comment.message,
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function getTicketComments(
  ticketId: string,
  includeInternal = true
): Promise<TicketCommentDto[]> {
  const rows = await prisma.ticketComment.findMany({
    where: {
      ticketId,
      isInternalOnly: includeInternal ? undefined : false,
    },
    orderBy: { createdAt: "asc" }
  });

  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    isStaff: r.isStaff,
    isInternalOnly: r.isInternalOnly,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

function formatPrismaTicket(row: any, includeInternal: boolean): CustomerTicketDto {
  const comments: TicketCommentDto[] = (row.comments || []).map((c: any) => ({
    id: c.id,
    ticketId: c.ticketId,
    authorName: c.authorName,
    authorEmail: c.authorEmail,
    isStaff: Boolean(c.isStaff),
    isInternalOnly: Boolean(c.isInternalOnly),
    message: c.message,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
  }));

  const attachments: AttachmentDto[] = (row.attachments || []).map((a: any) => ({
    id: a.id,
    ticketId: a.ticketId,
    taskId: a.taskId,
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    fileType: a.fileType,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
  }));

  return {
    id: row.id,
    trackingCode: row.trackingCode,
    projectId: row.projectId,
    project: row.project,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    customerCompany: row.customerCompany,
    environment: row.environment,
    convertedTaskId: row.convertedTaskId,
    convertedTask: row.convertedTask,
    internalNotes: includeInternal ? row.internalNotes : undefined,
    resolutionNotes: row.resolutionNotes,
    resolvedAt: row.resolvedAt
      ? row.resolvedAt instanceof Date
        ? row.resolvedAt.toISOString()
        : String(row.resolvedAt)
      : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    comments,
    attachments,
    _count: { comments: comments.length },
  };
}
