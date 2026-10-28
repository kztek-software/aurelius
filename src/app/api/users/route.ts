import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  title: z.string().max(100).optional().nullable(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  role: z.string().default("MEMBER"),
  teamId: z.string().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  discordUserId: z.string().max(32).optional().nullable(),
});

export async function GET() {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      avatarColor: true,
      role: true,
      teamId: true,
      phone: true,
      zaloUserId: true,
      zaloLinkedAt: true,
      discordUserId: true,
      discordUsername: true,
      discordLinkedAt: true,
      team: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
      createdAt: true,
      _count: {
        select: {
          assignedTasks: true,
          createdTasks: true,
          memberships: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users, currentUserId: currentUser.id });
}

export async function POST(req: NextRequest) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin người dùng không hợp lệ" }, { status: 400 });
  }

  const { name, email, password, title, avatarColor, role, teamId, phone, discordUserId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email này đã được sử dụng" }, { status: 400 });
  }

  // discordUserId là @unique — báo lỗi rõ ràng thay vì để DB ném P2002
  if (discordUserId) {
    const discordOwner = await prisma.user.findUnique({ where: { discordUserId } });
    if (discordOwner) {
      return NextResponse.json({ error: "Discord User ID này đã liên kết với người dùng khác" }, { status: 400 });
    }
  }

  const passwordHash = hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      // Tài khoản do Admin tạo -> buộc đổi mật khẩu khởi tạo ở lần đăng nhập đầu tiên
      mustChangePassword: true,
      title: title || null,
      avatarColor,
      role,
      teamId: teamId || null,
      phone: phone || null,
      discordUserId: discordUserId || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      avatarColor: true,
      role: true,
      teamId: true,
      phone: true,
      discordUserId: true,
      team: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
      createdAt: true,
    },
  });

  return NextResponse.json({ user: newUser }, { status: 201 });
}
