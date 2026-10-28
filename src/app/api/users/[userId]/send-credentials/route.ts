import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword, generateTempPassword } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions-server";
import { sendAccountCredentialsEmail } from "@/lib/mail";

// Cấp mật khẩu tạm mới + gửi email tài khoản/mật khẩu cho người dùng.
// Mật khẩu chỉ lưu dạng hash nên không thể gửi lại mật khẩu cũ — luôn sinh mật khẩu mới
// và bật mustChangePassword để buộc người dùng đổi ở lần đăng nhập kế tiếp.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (!(await hasPermission(currentUser.role, "users.manage"))) {
    return NextResponse.json({ error: "Bạn không có quyền quản lý tài khoản" }, { status: 403 });
  }

  const { userId } = await params;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  }

  const password = generateTempPassword();
  const log = await sendAccountCredentialsEmail({
    recipientName: target.name,
    recipientEmail: target.email,
    password,
    senderName: currentUser.name,
  });

  // Gửi SMTP thất bại -> giữ nguyên mật khẩu cũ để người dùng không bị khóa ngoài
  if (log.status === "FAILED") {
    return NextResponse.json({ error: `Gửi email thất bại: ${log.error ?? "lỗi SMTP"}` }, { status: 502 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(password), mustChangePassword: true },
  });

  // Chưa cấu hình SMTP (Simulated) -> email không thực sự được gửi, trả mật khẩu để Admin tự bàn giao
  return NextResponse.json({
    ok: true,
    status: log.status,
    password: log.status === "SIMULATED" ? password : undefined,
  });
}
