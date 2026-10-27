import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

function getClientBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const baseUrl = getClientBaseUrl(req);
    let email = "";
    let password = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (body) {
        email = String(body.email || "").trim();
        password = String(body.password || "");
      }
    } else {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        email = String(formData.get("email") || "").trim();
        password = String(formData.get("password") || "");
      }
    }

    if (!email || !password) {
      if (!contentType.includes("application/json")) {
        return new Response(null, {
          status: 303,
          headers: { Location: "/login?error=missing_fields" },
        });
      }
      return NextResponse.json({ error: "Tài khoản và mật khẩu là bắt buộc" }, { status: 400 });
    }

    const input = email.toLowerCase().trim();

    // Hỗ trợ đăng nhập bằng username ("admin") hoặc email ("admin@kztek.net", v.v.)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input },
          { email: input === "admin" ? "admin@kztek.net" : input },
          { email: `${input}@kztek.net` },
          { email: `${input}@demo.dev` },
          { name: { equals: input } },
        ],
      },
    });

    const isPasswordValid = verifyPassword(password, user?.passwordHash || "");

    if (!user || !isPasswordValid) {
      if (!contentType.includes("application/json")) {
        return new Response(null, {
          status: 303,
          headers: { Location: "/login?error=invalid_credentials" },
        });
      }
      return NextResponse.json({ error: "Tài khoản hoặc mật khẩu không đúng" }, { status: 401 });
    }

    const token = await createSession(user.id);

    // Nếu gửi bằng form HTML thông thường (legacy fallback)
    if (!contentType.includes("application/json")) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": `flowboard_session=${token}; Path=/; Max-Age=604800; SameSite=Lax`,
        },
      });
    }

    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
        title: user.title,
        role: user.role,
      },
    });

    res.cookies.set("flowboard_session", token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
