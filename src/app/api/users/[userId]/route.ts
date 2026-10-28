import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).optional(),
  title: z.string().max(100).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  role: z.string().optional(),
  teamId: z.string().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  discordUserId: z.string().max(32).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const { userId } = await params;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ" }, { status: 400 });
  }

  const { name, email, password, title, avatarColor, role, teamId, phone, discordUserId } = parsed.data;

  if (email && email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email này đã tồn tại" }, { status: 400 });
    }
  }

  const updateData: {
    name?: string;
    email?: string;
    passwordHash?: string;
    title?: string | null;
    avatarColor?: string;
    role?: string;
    teamId?: string | null;
    phone?: string | null;
    discordUserId?: string | null;
    discordUsername?: string | null;
    discordLinkedAt?: Date | null;
  } = {};

  if (name) updateData.name = name;
  if (email) updateData.email = email;
  if (password) updateData.passwordHash = hashPassword(password);
  if (title !== undefined) updateData.title = title;
  if (avatarColor) updateData.avatarColor = avatarColor;
  if (role) updateData.role = role;
  if (teamId !== undefined) updateData.teamId = teamId;
  if (phone !== undefined) updateData.phone = phone;

  if (discordUserId !== undefined) {
    // Admin nhập tay Discord User ID -> gỡ liên kết cũ (nếu ID này trước đó gắn với user khác) tránh trùng,
    // và đánh dấu là gắn thủ công (không có discordUsername/linkedAt xác thực qua OAuth)
    if (discordUserId) {
      await prisma.user.updateMany({
        where: { discordUserId, id: { not: userId } },
        data: { discordUserId: null, discordUsername: null, discordLinkedAt: null },
      });
    }
    updateData.discordUserId = discordUserId;
    updateData.discordUsername = discordUserId ? target.discordUsername : null;
    updateData.discordLinkedAt = discordUserId ? new Date() : null;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
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
    },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const { userId } = await params;

  if (currentUser.id === userId) {
    return NextResponse.json({ error: "Không thể tự xóa tài khoản của chính mình" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
