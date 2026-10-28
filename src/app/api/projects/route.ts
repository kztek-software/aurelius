import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { LABEL_COLORS, PROJECT_STATUSES } from "@/lib/constants";
import { checkUserPermission } from "@/lib/permissions-server";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const isAdmin = user.role?.toUpperCase() === "ADMIN";

    const projects = await prisma.project.findMany({
      where: isAdmin ? undefined : { members: { some: { userId: user.id } } },
      include: {
        _count: { select: { tasks: true, members: true, customerTickets: true } },
        members: {
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
        },
        owner: { select: { id: true, name: true, avatarColor: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ projects });
  } catch (err: any) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Lỗi tải danh sách dự án" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(2, "Tên dự án phải từ 2 ký tự").max(100),
  key: z.string().min(2, "Key phải từ 2-6 ký tự").max(6).regex(/^[A-Z][A-Z0-9]*$/, "Key phải viết hoa, bắt đầu bằng chữ"),
  description: z.string().max(1000).optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  teamIds: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().min(1),
        fileUrl: z.string().min(1),
        fileType: z.string().optional().default("other"),
        fileSize: z.number().optional().nullable(),
        mimeType: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const permCheck = await checkUserPermission(user.id, "projects.create", undefined, user.role);
    if (!permCheck.allowed) {
      return NextResponse.json(
        { error: "Bạn không có quyền tạo dự án mới (Yêu cầu quyền: projects.create)" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Tên ≥ 2 ký tự; key gồm 2-6 chữ cái in hoa (VD: KZ)" },
        { status: 400 }
      );
    }

    const { name, key, description, status, teamIds, memberIds, attachments } = parsed.data;

    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ error: `Key "${key}" đã tồn tại trên hệ thống` }, { status: 409 });
    }

    // Thu thập danh sách userId từ teamIds và memberIds
    const targetUserIds = new Set<string>();
    targetUserIds.add(user.id); // Chủ dự án luôn có mặt

    if (memberIds && memberIds.length > 0) {
      for (const uid of memberIds) {
        targetUserIds.add(uid);
      }
    }

    // Giao diện đã tự chọn sẵn thành viên của team vào memberIds (người dùng có thể bỏ tick bớt),
    // nên chỉ mở rộng teamIds khi client không gửi memberIds — tránh thêm lại người đã bị bỏ chọn
    if (teamIds && teamIds.length > 0 && memberIds === undefined) {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: { in: teamIds } },
        select: { id: true },
      });
      for (const tm of teamMembers) {
        targetUserIds.add(tm.id);
      }
    }

    // Chuẩn bị danh sách ProjectMember tạo mới
    const memberCreateData = Array.from(targetUserIds).map((uid) => ({
      userId: uid,
      role: uid === user.id ? "OWNER" : "MEMBER",
    }));

    const project = await prisma.project.create({
      data: {
        name,
        key,
        description: description?.trim() || null,
        status,
        ownerId: user.id,
        members: {
          create: memberCreateData,
        },
        attachments:
          attachments && attachments.length > 0
            ? {
                create: attachments.map((att) => ({
                  fileName: att.fileName,
                  fileUrl: att.fileUrl,
                  fileType: att.fileType || "other",
                  fileSize: att.fileSize || null,
                  mimeType: att.mimeType || null,
                  uploaderId: user.id,
                })),
              }
            : undefined,
        labels: {
          create: ["frontend", "backend", "bug", "design", "hardware", "firmware"].map((name, i) => ({
            name,
            color: LABEL_COLORS[i % LABEL_COLORS.length],
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true, title: true, email: true } },
          },
        },
        owner: { select: { id: true, name: true, avatarColor: true } },
        attachments: {
          include: {
            uploader: { select: { id: true, name: true, avatarColor: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err: any) {
    if (err instanceof Response && err.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/projects error:", err);
    return NextResponse.json({ error: "Lỗi tạo dự án" }, { status: 500 });
  }
}
