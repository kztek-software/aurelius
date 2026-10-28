import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "flowboard-dev-secret-change-me-in-production"
);
const COOKIE_NAME = "flowboard_session";
const SESSION_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Sinh mật khẩu tạm ngẫu nhiên (bỏ các ký tự dễ nhầm như 0/O, 1/l/I) */
export function generateTempPassword(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  title: string | null;
  role?: string;
  mustChangePassword?: boolean;
};

export async function createJwtToken(userId: string): Promise<string> {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(SECRET);
}

export async function createSession(userId: string): Promise<string> {
  const token = await createJwtToken(userId);

  try {
    const store = await cookies();
    store.set(COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
      path: "/",
    });
  } catch {
    // In pure API context where cookie store cannot be modified, ignore
  }

  return token;
}

export async function destroySession() {
  try {
    const store = await cookies();
    store.set(COOKIE_NAME, "", {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      maxAge: 0,
      path: "/",
    });
  } catch {
    // Ignore error if cookie store cannot be modified
  }
}

export async function getSessionUser(req?: Request | null): Promise<SessionUser | null> {
  let token: string | undefined;

  // 1. Kiểm tra Header Authorization & Cookie từ request truyền vào
  if (req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
    if (!token) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
        if (match) token = match[1];
      }
    }
  }

  // 2. Kiểm tra Header Authorization từ next/headers
  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get("authorization") || headerStore.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // headers() có thể ném exception nếu chạy ngoài request context
    }
  }

  // 3. Fallback kiểm tra Cookie session
  if (!token) {
    try {
      const store = await cookies();
      token = store.get(COOKIE_NAME)?.value;
    } catch {
      // cookies() có thể ném exception
    }
  }

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, avatarColor: true, title: true, role: true, mustChangePassword: true },
    });
    return user;
  } catch (err) {
    console.error("getSessionUser error:", err);
    return null;
  }
}

export async function requireUser(req?: Request | null): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}
