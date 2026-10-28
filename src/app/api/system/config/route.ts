import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getSystemConfigAsync, updateSystemConfigAsync } from "@/lib/system-config";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Bảo mật: Chỉ ADMIN mới có quyền truy cập cấu hình hệ thống
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Truy cập bị từ chối. Chỉ Quản trị viên (ADMIN) mới có quyền xem cấu hình hệ thống." },
        { status: 403 }
      );
    }

    const config = await getSystemConfigAsync();
    return NextResponse.json({ config, currentUserRole: user.role });
  } catch (error) {
    console.error("Lỗi khi tải cấu hình hệ thống:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lấy cấu hình" }, { status: 500 });
  }
}

const updateConfigSchema = z.object({
  smtp: z
    .object({
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      user: z.string().optional(),
      pass: z.string().optional(),
      secure: z.boolean().optional(),
      from: z.string().optional(),
      fromName: z.string().optional(),
    })
    .optional(),
  branding: z
    .object({
      systemName: z.string().optional(),
      companyName: z.string().optional(),
      hotline: z.string().optional(),
      supportEmail: z.string().optional(),
      website: z.string().optional(),
      appUrl: z.string().optional(),
    })
    .optional(),
  notifications: z
    .object({
      notifyOnAssign: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
      enableRealtimeSse: z.boolean().optional(),
    })
    .optional(),
  zalo: z
    .object({
      enabled: z.boolean().optional(),
      appId: z.string().optional(),
      appSecret: z.string().optional(),
      oaId: z.string().optional(),
      oaSecretKey: z.string().optional(),
      znsTemplateId: z.string().optional(),
      notifyOnAssign: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
    })
    .optional(),
  discord: z
    .object({
      enabled: z.boolean().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      botToken: z.string().optional(),
      webhookUrl: z.string().optional(),
      notifyOnAssign: z.boolean().optional(),
      notifyOnStatusChange: z.boolean().optional(),
      notifyOnComment: z.boolean().optional(),
      webhookOnAssign: z.boolean().optional(),
      webhookOnStatusChange: z.boolean().optional(),
      webhookOnComment: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  console.log("\n=======================================================");
  console.log("⚙️ [POST /api/system/config] Nhận yêu cầu lưu cấu hình...");
  try {
    const user = await getSessionUser();
    console.log("  👤 User:", user?.name, "| Role:", user?.role);
    if (!user) {
      console.log("  ❌ Chưa đăng nhập");
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Bảo mật: Chỉ ADMIN mới có quyền lưu cấu hình
    if (user.role !== "ADMIN") {
      console.log("  ❌ Không phải ADMIN:", user.role);
      return NextResponse.json(
        { error: "Truy cập bị từ chối. Chỉ Quản trị viên (ADMIN) mới có quyền thay đổi cấu hình hệ thống." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    console.log("  📦 Body received:", JSON.stringify(body, null, 2));

    const parsed = updateConfigSchema.safeParse(body);
    if (!parsed.success) {
      console.log("  ❌ Dữ liệu không hợp lệ:", parsed.error.issues);
      return NextResponse.json(
        { error: "Dữ liệu cấu hình không hợp lệ", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updatedConfig = await updateSystemConfigAsync(parsed.data, user.name);
    console.log("  ✅ Đã lưu PostgreSQL thành công! App URL mới:", updatedConfig.branding?.appUrl);

    return NextResponse.json({
      success: true,
      message: "Cập nhật cấu hình hệ thống thành công",
      config: updatedConfig,
    });
  } catch (error) {
    console.error("  ❌ Lỗi khi lưu cấu hình hệ thống:", error);
    return NextResponse.json({ error: "Lỗi máy chủ khi lưu cấu hình" }, { status: 500 });
  }
}
