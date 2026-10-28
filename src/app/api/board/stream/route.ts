import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { subscribe } from "@/lib/bus";
import { parseBoardProjectsParam, resolveBoardProjects } from "@/lib/board-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/board/stream?projects=all|id1,id2,...
 * Realtime SSE cho Board đa dự án: 1 kết nối duy nhất lắng nghe sự kiện của mọi dự án
 * được chọn (thay vì mở N EventSource — trình duyệt giới hạn số kết nối HTTP/1.1).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const requested = parseBoardProjectsParam(req.nextUrl.searchParams.get("projects"));
  const access = await resolveBoardProjects(user, requested);
  if (access.length === 0) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let unsubscribers: (() => void)[] = [];

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`));

      unsubscribers = access.map(({ id: projectId }) =>
        subscribe(projectId, (event) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...event, projectId })}\n\n`));
          } catch {
            // stream đã đóng
          }
        })
      );

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribers.forEach((off) => off());
        try {
          controller.close();
        } catch {
          // đã đóng
        }
      });
    },
    cancel() {
      unsubscribers.forEach((off) => off());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
