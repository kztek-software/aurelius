import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

const DAY_MS = 86400000;
const OPEN_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW"];
const MAX_RANGE_DAYS = 366;
// Khoảng ≤ 45 ngày vẽ xu hướng theo ngày, dài hơn thì gom theo tuần
const DAILY_BUCKET_MAX_DAYS = 45;
// Số ngày tới coi là "sắp đến hạn"
const UPCOMING_DAYS = 7;

/**
 * Thời điểm hết hạn thực tế của task: dueDate được lưu dạng "chỉ ngày" (00:00 UTC)
 * thì coi là hết hạn vào cuối ngày đó; nếu có giờ cụ thể thì dùng nguyên giá trị.
 */
function dueEnd(due: Date): number {
  const t = due.getTime();
  return t % DAY_MS === 0 ? t + DAY_MS - 1 : t;
}

/**
 * Thời điểm hoàn thành: ưu tiên completedAt (được set khi chuyển sang DONE);
 * task DONE cũ/import không có completedAt thì dùng updatedAt làm giá trị gần đúng.
 */
function completionTime(t: { status: string; completedAt: Date | null; updatedAt: Date }): Date | null {
  if (t.status !== "DONE") return null;
  return t.completedAt ?? t.updatedAt;
}

/**
 * GET /api/me/stats?from=ISO&to=ISO&tz=<phút lệch so với UTC>&projectId=...&scope=me|team&teamId=...&memberId=...
 * - scope=me (mặc định): thống kê task được giao cho CHÍNH người dùng đang đăng nhập.
 * - scope=team: thống kê task của thành viên trong nhóm người dùng quản lý
 *   (trưởng nhóm — Team.leaderId; ADMIN xem được mọi nhóm). memberId để lọc 1 thành viên.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const now = new Date();

  const to = sp.get("to") ? new Date(sp.get("to")!) : now;
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - 30 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Khoảng thời gian không hợp lệ" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return NextResponse.json(
      { error: `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày` },
      { status: 400 }
    );
  }

  // Độ lệch múi giờ của trình duyệt (phút, VN = +420) để gom theo ngày/tuần đúng giờ địa phương
  const tzRaw = Number(sp.get("tz"));
  const tzMs = (Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 14 * 60 ? tzRaw : 0) * 60000;
  const localDayKey = (d: Date) => new Date(d.getTime() + tzMs).toISOString().slice(0, 10);

  const projectId = sp.get("projectId") || null;
  const scope: "me" | "team" = sp.get("scope") === "team" ? "team" : "me";

  // Các nhóm người dùng được xem thống kê: nhóm mình làm trưởng nhóm; ADMIN xem mọi nhóm
  const manageableTeams = await prisma.team.findMany({
    where: user.role === "ADMIN" ? {} : { leaderId: user.id },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      members: { select: { id: true, name: true, avatarColor: true, title: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  let assigneeIds = [user.id];
  let team: (typeof manageableTeams)[number] | null = null;
  if (scope === "team") {
    team = manageableTeams.find((t) => t.id === sp.get("teamId")) ?? null;
    if (!team) {
      return NextResponse.json({ error: "Bạn không có quyền xem thống kê của nhóm này" }, { status: 403 });
    }
    assigneeIds = team.members.map((m) => m.id);
    const memberId = sp.get("memberId");
    if (memberId) {
      if (!assigneeIds.includes(memberId)) {
        return NextResponse.json({ error: "Thành viên không thuộc nhóm này" }, { status: 400 });
      }
      assigneeIds = [memberId];
    }
  }

  // Cả cá nhân lẫn nhóm: chỉ lấy task ở các dự án người xem đang tham gia
  // (trưởng nhóm không thấy dự án mình không tham gia); ADMIN không giới hạn.
  const projectScope = user.role === "ADMIN" ? {} : { project: { members: { some: { userId: user.id } } } };

  const allTasks = await prisma.task.findMany({
    where: { assigneeId: { in: assigneeIds }, ...projectScope },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      priority: true,
      storyPoints: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      assigneeId: true,
      assignee: { select: { id: true, name: true, avatarColor: true } },
      project: { select: { id: true, name: true, key: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Danh sách dự án để làm bộ lọc (lấy từ chính các task được giao)
  const projectMap = new Map<string, { id: string; name: string; key: string }>();
  for (const t of allTasks) projectMap.set(t.project.id, t.project);
  const projects = [...projectMap.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));

  const tasks = projectId ? allTasks.filter((t) => t.project.id === projectId) : allTasks;

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const nowMs = now.getTime();
  const inRange = (d: Date | null) => !!d && d.getTime() >= fromMs && d.getTime() <= toMs;

  // ---- Chỉ số trong kỳ ----
  const assignedInPeriod = tasks.filter((t) => inRange(t.createdAt));
  const completedInPeriod = tasks.filter((t) => inRange(completionTime(t)));
  const completedWithDue = completedInPeriod.filter((t) => t.dueDate);
  const completedOnTime = completedWithDue.filter(
    (t) => completionTime(t)!.getTime() <= dueEnd(t.dueDate!)
  );
  const onTimeRate =
    completedWithDue.length > 0 ? Math.round((completedOnTime.length / completedWithDue.length) * 100) : null;
  const completedPoints = completedInPeriod.reduce((s, t) => s + (t.storyPoints ?? 0), 0);

  // ---- Ảnh chụp hiện tại (không phụ thuộc khoảng thời gian) ----
  const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW");
  const overdue = openTasks
    .filter((t) => t.dueDate && dueEnd(t.dueDate) < nowMs)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const upcoming = openTasks
    .filter((t) => {
      if (!t.dueDate) return false;
      const end = dueEnd(t.dueDate);
      return end >= nowMs && end <= nowMs + UPCOMING_DAYS * DAY_MS;
    })
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());

  // ---- Xu hướng theo ngày / tuần ----
  const rangeDays = Math.ceil((toMs - fromMs) / DAY_MS);
  const granularity: "day" | "week" = rangeDays <= DAILY_BUCKET_MAX_DAYS ? "day" : "week";

  // Khóa bucket: ngày địa phương, hoặc thứ Hai đầu tuần (địa phương) nếu gom theo tuần
  const bucketKey = (d: Date) => {
    const key = localDayKey(d);
    if (granularity === "day") return key;
    const local = new Date(`${key}T00:00:00Z`);
    const dow = (local.getUTCDay() + 6) % 7; // 0 = thứ Hai
    return new Date(local.getTime() - dow * DAY_MS).toISOString().slice(0, 10);
  };

  const trendMap = new Map<string, { bucket: string; completed: number; assigned: number; points: number }>();
  const stepMs = granularity === "day" ? DAY_MS : 7 * DAY_MS;
  for (let cursor = new Date(`${bucketKey(from)}T00:00:00Z`).getTime(); ; cursor += stepMs) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    if (key > localDayKey(to)) break;
    trendMap.set(key, { bucket: key, completed: 0, assigned: 0, points: 0 });
  }
  for (const t of completedInPeriod) {
    const row = trendMap.get(bucketKey(completionTime(t)!));
    if (row) {
      row.completed += 1;
      row.points += t.storyPoints ?? 0;
    }
  }
  for (const t of assignedInPeriod) {
    const row = trendMap.get(bucketKey(t.createdAt));
    if (row) row.assigned += 1;
  }

  // ---- Phân bố: các task "liên quan tới kỳ" = tạo trước cuối kỳ và chưa xong trước đầu kỳ ----
  const scoped = tasks.filter((t) => {
    if (t.createdAt.getTime() > toMs) return false;
    const done = completionTime(t);
    return !done || done.getTime() >= fromMs;
  });

  const statusDist = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((s) => ({
    status: s,
    count: scoped.filter((t) => t.status === s).length,
  }));
  const priorityDist = ["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => ({
    priority: p,
    count: scoped.filter((t) => t.priority === p).length,
  }));
  const projectDist = projects
    .map((p) => {
      const mine = scoped.filter((t) => t.project.id === p.id);
      return {
        projectId: p.id,
        name: p.name,
        key: p.key,
        total: mine.length,
        done: mine.filter((t) => t.status === "DONE").length,
        open: mine.filter((t) => t.status !== "DONE").length,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);

  // ---- So sánh theo thành viên (chỉ khi xem theo nhóm) ----
  const memberDist = team
    ? team.members
        .filter((m) => assigneeIds.includes(m.id))
        .map((m) => {
          const own = tasks.filter((t) => t.assigneeId === m.id);
          const done = own.filter((t) => inRange(completionTime(t)));
          const doneWithDue = done.filter((t) => t.dueDate);
          const onTime = doneWithDue.filter((t) => completionTime(t)!.getTime() <= dueEnd(t.dueDate!));
          return {
            userId: m.id,
            name: m.name,
            avatarColor: m.avatarColor,
            title: m.title,
            assigned: own.filter((t) => inRange(t.createdAt)).length,
            completed: done.length,
            completedPoints: done.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
            inProgress: own.filter((t) => t.status === "IN_PROGRESS" || t.status === "IN_REVIEW").length,
            open: own.filter((t) => OPEN_STATUSES.includes(t.status)).length,
            overdue: overdue.filter((t) => t.assigneeId === m.id).length,
            onTimeRate: doneWithDue.length > 0 ? Math.round((onTime.length / doneWithDue.length) * 100) : null,
          };
        })
        .sort((a, b) => b.completed - a.completed || b.open - a.open)
    : [];

  const toItem = (t: (typeof tasks)[number]) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    priority: t.priority,
    storyPoints: t.storyPoints,
    dueDate: t.dueDate,
    project: t.project,
    assignee: t.assignee,
  });

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString(), granularity },
    scope,
    team: team ? { id: team.id, name: team.name, code: team.code, color: team.color } : null,
    teams: manageableTeams,
    memberDist,
    projects,
    summary: {
      assigned: assignedInPeriod.length,
      completed: completedInPeriod.length,
      completedPoints,
      completedWithDue: completedWithDue.length,
      completedOnTime: completedOnTime.length,
      onTimeRate,
      inProgress: inProgress.length,
      open: openTasks.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      scopedTotal: scoped.length,
    },
    trend: [...trendMap.values()],
    statusDist,
    priorityDist,
    projectDist,
    overdueTasks: overdue.slice(0, 50).map(toItem),
    upcomingTasks: upcoming.slice(0, 50).map(toItem),
  });
}
