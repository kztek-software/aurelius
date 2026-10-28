import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { publish } from "@/lib/bus";
import { notifyTaskComment, notifyTaskMention } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const user = await requireUser();
  const { projectId, taskId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

  const [comments, activity] = await Promise.all([
    prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true, email: true, avatarColor: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({
      where: { taskId },
      include: { actor: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({ comments, activity });
}

const commentSchema = z.object({
  body: z.string().min(1).max(3000),
  mentionedUserIds: z.array(z.string()).optional().default([]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const user = await requireUser();
  const { projectId, taskId } = await params;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!member) return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bình luận không được để trống" }, { status: 400 });
  }

  const commentText = parsed.data.body;
  const mentionedUserIds = [...(parsed.data.mentionedUserIds || [])];

  // Tự động tìm thêm user IDs nếu trong nội dung có định dạng @[Name](userId) hoặc @username
  if (mentionedUserIds.length === 0 && commentText.includes("@")) {
    // Tìm các project members có tên được nhắc đến trong comment
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    for (const pm of projectMembers) {
      if (
        pm.user.id !== user.id &&
        (commentText.toLowerCase().includes(`@${pm.user.name.toLowerCase()}`) ||
          commentText.toLowerCase().includes(`@${pm.user.email.toLowerCase()}`))
      ) {
        if (!mentionedUserIds.includes(pm.user.id)) {
          mentionedUserIds.push(pm.user.id);
        }
      }
    }
  }

  const comment = await prisma.comment.create({
    data: { taskId, authorId: user.id, body: commentText },
    include: { author: { select: { id: true, name: true, email: true, avatarColor: true } } },
  });

  await prisma.activity.create({
    data: {
      taskId,
      actorId: user.id,
      action: "COMMENTED",
      detail: mentionedUserIds.length > 0 ? `đã bình luận và nhắc đến ${mentionedUserIds.length} thành viên` : "đã bình luận",
    },
  });

  publish(projectId, { type: "TASK_CHANGED", taskId, actorId: user.id });

  // 1. Gửi thông báo & Email trực tiếp cho những người được tag (@mention) (Async Queue, non-blocking)
  if (mentionedUserIds.length > 0) {
    notifyTaskMention({
      taskId,
      authorId: user.id,
      commentBody: commentText,
      mentionedUserIds,
      projectId,
    });
  }

  // 2. Gửi thông báo & Email bình luận thông thường cho Assignee/Creator (Async Queue, non-blocking)
  notifyTaskComment({
    taskId,
    authorId: user.id,
    commentBody: commentText,
    projectId,
    excludeUserIds: mentionedUserIds,
  });

  return NextResponse.json({ comment }, { status: 201 });
}

