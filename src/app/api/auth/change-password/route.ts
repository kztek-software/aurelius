import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const currentUser = await getSessionUser(req);
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự" }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { passwordHash: true },
  });
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
