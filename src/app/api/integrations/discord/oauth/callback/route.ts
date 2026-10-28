import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { exchangeDiscordAuthCode, DiscordApiError } from "@/lib/discord/client";
import { getAppBaseUrl } from "@/lib/system-config";

/**
 * Discord redirect user về đây sau khi họ đồng ý cấp quyền `identify`, kèm `?code=...&state=<returnTo>`.
 * Route này đổi code lấy id + username Discord, gắn vào tài khoản đang đăng nhập (qua cookie session —
 * KHÔNG cần smuggle userId qua state vì đây là full-page redirect, cookie vẫn còn nguyên).
 */
export async function GET(req: NextRequest) {
  const rawState = req.nextUrl.searchParams.get("state") || "/";
  const returnTo = rawState.startsWith("/") ? rawState : "/";

  const redirectTo = (status: "connected" | "error", message?: string) => {
    const url = new URL(returnTo, getAppBaseUrl());
    url.searchParams.set("discord_oauth", status);
    if (message) url.searchParams.set("discord_oauth_message", message);
    return NextResponse.redirect(url);
  };

  const currentUser = await getSessionUser(req);
  if (!currentUser) {
    return redirectTo("error", "Bạn cần đăng nhập trước khi kết nối Discord");
  }

  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectTo("error", `Discord từ chối cấp quyền: ${oauthError}`);
  }
  if (!code) {
    return redirectTo("error", "Thiếu tham số code từ Discord callback");
  }

  try {
    const redirectUri = `${getAppBaseUrl()}/api/integrations/discord/oauth/callback`;
    const { discordUserId, discordUsername } = await exchangeDiscordAuthCode(code, redirectUri);

    // discordUserId là @unique -> phải gỡ liên kết
    // cũ (nếu tài khoản Discord này trước đó đã gắn với 1 user khác) trước khi gắn cho user hiện tại.
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { discordUserId, id: { not: currentUser.id } },
        data: { discordUserId: null, discordUsername: null, discordLinkedAt: null },
      }),
      prisma.user.update({
        where: { id: currentUser.id },
        data: { discordUserId, discordUsername, discordLinkedAt: new Date() },
      }),
    ]);

    return redirectTo("connected");
  } catch (error) {
    const message = error instanceof DiscordApiError ? error.message : "Lỗi không xác định khi kết nối Discord";
    console.error("Lỗi khi xử lý Discord OAuth callback:", error);
    return redirectTo("error", message);
  }
}
