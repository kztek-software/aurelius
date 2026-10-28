// Tạo dữ liệu demo cho trang "Thống Kê" (/projects/[id]/my-stats) — cả chế độ Cá nhân và Nhóm.
// Dữ liệu nằm trong 2 dự án riêng [DEMO] (key DMSA, DMSB) và 1 nhóm riêng (code DEMO_STATS)
// — không đụng dữ liệu thật.
//
//   npx tsx scripts/seed-my-stats-demo.ts                      -> liệt kê tài khoản
//   npx tsx scripts/seed-my-stats-demo.ts --email=a@kztek.net  -> tạo (tạo lại) dữ liệu demo, tài khoản này làm trưởng nhóm
//   npx tsx scripts/seed-my-stats-demo.ts --clean              -> xoá toàn bộ dữ liệu demo
import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";

const DEMO_PROJECTS = [
  { key: "DMSA", name: "[DEMO] Nền tảng iParking", description: "Dự án demo cho trang Thống kê" },
  { key: "DMSB", name: "[DEMO] Ứng dụng iLocker", description: "Dự án demo cho trang Thống kê" },
];

const DEMO_TEAM = { code: "DEMO_STATS", name: "[DEMO] Nhóm Phát triển Phần mềm", color: "#4A3F8C" };
// Thành viên nhóm demo (tài khoản demo do prisma/seed.ts --demo tạo); thiếu tài khoản nào thì bỏ qua
const DEMO_MEMBER_EMAILS = ["alice@demo.dev", "binh@demo.dev", "chi@demo.dev"];

const TITLES = [
  "Thiết kế API danh sách xe vào/ra",
  "Sửa lỗi nhận diện biển số ban đêm",
  "Bổ sung báo cáo doanh thu theo ca",
  "Tối ưu truy vấn lịch sử giao dịch",
  "Viết unit test cho module thanh toán",
  "Cập nhật giao diện màn hình đặt tủ",
  "Tích hợp Face ID cho mở tủ",
  "Refactor service đồng bộ thẻ RFID",
  "Xử lý timeout khi gọi barrier",
  "Thêm phân quyền theo phòng ban",
  "Review code module thông báo",
  "Viết tài liệu triển khai on-premise",
  "Fix lỗi hiển thị trên Safari",
  "Xuất Excel danh sách vé tháng",
  "Cấu hình CI build bản Linux",
  "Kiểm thử tải 500 làn đồng thời",
];

// PRNG cố định để mỗi lần chạy cho cùng một bộ dữ liệu
let seed = 20261028;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const atDaysAgo = (d: number) => new Date(now - d * DAY);
// dueDate lưu kiểu "chỉ ngày" (00:00 UTC) giống dữ liệu thật
const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}`));
  if (!hit) return undefined;
  const [, value] = hit.split("=");
  return value ?? "true";
}

type TaskSeed = {
  projectId: string;
  number: number;
  title: string;
  type: string;
  status: string;
  priority: string;
  storyPoints: number;
  position: number;
  assigneeId: string;
  creatorId: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Sinh `count` task cho 1 người. `skill` (0..1) điều chỉnh tỷ lệ hoàn thành & đúng hạn
 * để các thành viên trong nhóm có số liệu khác nhau khi so sánh.
 */
function buildTasks(projectId: string, assigneeId: string, creatorId: string, count: number, skill: number) {
  const tasks: Omit<TaskSeed, "number" | "position">[] = [];
  for (let i = 0; i < count; i++) {
    // Nhiều task gần đây hơn task cũ
    const createdDaysAgo = Math.floor(Math.pow(rand(), 1.6) * 120);
    const createdAt = atDaysAgo(createdDaysAgo + between(0, 0.9));
    const hasDue = rand() < 0.85;
    const dueDate = hasDue ? dateOnly(new Date(createdAt.getTime() + Math.round(between(2, 14)) * DAY)) : null;

    let status: string;
    if (createdDaysAgo > 20) status = rand() < 0.6 + skill * 0.3 ? "DONE" : pick(["IN_PROGRESS", "TODO", "BACKLOG"]);
    else if (createdDaysAgo > 5) status = pick(["DONE", "DONE", "IN_REVIEW", "IN_PROGRESS", "TODO"]);
    else status = pick(["TODO", "TODO", "IN_PROGRESS", "BACKLOG", "DONE"]);

    let completedAt: Date | null = null;
    if (status === "DONE") {
      // Tỷ lệ đúng hạn phụ thuộc skill, task trễ thì trễ 1-6 ngày
      const target = dueDate && rand() < 0.55 + skill * 0.4
        ? dueDate.getTime() - between(0, 2) * DAY
        : (dueDate?.getTime() ?? createdAt.getTime() + between(1, 8) * DAY) + between(1, 6) * DAY;
      completedAt = new Date(Math.min(now - 60 * 60 * 1000, Math.max(createdAt.getTime() + 2 * 60 * 60 * 1000, target)));
    }

    tasks.push({
      projectId,
      title: pick(TITLES),
      type: pick(["TASK", "TASK", "TASK", "BUG", "BUG", "STORY"]),
      status,
      priority: pick(["LOW", "MEDIUM", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "URGENT"]),
      storyPoints: pick([1, 2, 3, 3, 5, 5, 8]),
      assigneeId,
      creatorId,
      dueDate,
      completedAt,
      createdAt,
      updatedAt: completedAt ?? createdAt,
    });
  }

  // Luôn có vài task quá hạn và sắp đến hạn để danh sách không trống
  const today = dateOnly(new Date());
  for (const offset of [-5, -2, 2, 4]) {
    tasks.push({
      projectId,
      title: offset < 0 ? `Hoàn thiện ${pick(TITLES).toLowerCase()}` : `Chuẩn bị ${pick(TITLES).toLowerCase()}`,
      type: "TASK",
      status: pick(["TODO", "IN_PROGRESS", "IN_REVIEW"]),
      priority: offset < 0 ? "HIGH" : "MEDIUM",
      storyPoints: pick([2, 3, 5]),
      assigneeId,
      creatorId,
      dueDate: new Date(today.getTime() + offset * DAY),
      completedAt: null,
      createdAt: atDaysAgo(10 - offset),
      updatedAt: atDaysAgo(1),
    });
  }
  return tasks;
}

async function clean() {
  const projects = await prisma.project.findMany({
    where: { key: { in: DEMO_PROJECTS.map((p) => p.key) } },
    select: { id: true, key: true },
  });
  for (const p of projects) {
    // Ticket/Attachment dùng onDelete: NoAction với Project -> xoá trước nếu ai đó đã tạo qua giao diện
    await prisma.attachment.deleteMany({
      where: { OR: [{ projectId: p.id }, { ticket: { projectId: p.id } }, { task: { projectId: p.id } }] },
    });
    await prisma.customerTicket.deleteMany({ where: { projectId: p.id } });
    await prisma.task.deleteMany({ where: { projectId: p.id } });
    await prisma.project.delete({ where: { id: p.id } });
  }
  // Xoá nhóm demo: thành viên tự về "không thuộc nhóm" (onDelete: SetNull)
  const team = await prisma.team.deleteMany({ where: { code: DEMO_TEAM.code } });
  console.log(
    `🧹 Đã xoá ${projects.length} dự án demo (${projects.map((p) => p.key).join(", ") || "không có"})` +
      ` và ${team.count} nhóm demo.`
  );
}

async function main() {
  if (arg("clean")) {
    await clean();
    return;
  }

  const email = arg("email");
  if (!email) {
    const users = await prisma.user.findMany({ select: { name: true, email: true, role: true }, orderBy: { createdAt: "asc" } });
    console.log("Chọn tài khoản để tạo dữ liệu demo: --email=<email>\n");
    for (const u of users) console.log(`  ${u.email.padEnd(32)} ${u.name} (${u.role})`);
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Không tìm thấy tài khoản ${email}`);

  // Chạy lại thì tạo mới từ đầu
  await clean();

  // Nhóm demo do tài khoản được chọn làm trưởng nhóm. Chỉ đưa vào nhóm những tài khoản demo
  // chưa thuộc nhóm nào, để không làm thay đổi phòng ban thật.
  const candidates = await prisma.user.findMany({
    where: { email: { in: DEMO_MEMBER_EMAILS.filter((e) => e !== email) }, teamId: null },
    orderBy: { email: "asc" },
  });
  const team = await prisma.team.create({
    data: {
      ...DEMO_TEAM,
      description: "Nhóm demo cho trang Thống kê",
      leaderId: user.id,
      members: { connect: candidates.map((m) => ({ id: m.id })) },
    },
  });

  // Người được giao task: chính tài khoản (thống kê cá nhân) + các thành viên nhóm demo
  const assignees = [
    { id: user.id, name: user.name, skill: 0.6, weight: 1 },
    ...candidates.map((m, i) => ({ id: m.id, name: m.name, skill: [0.9, 0.4, 0.7][i % 3], weight: [0.8, 0.6, 0.7][i % 3] })),
  ];

  let total = 0;
  for (const [projectIndex, def] of DEMO_PROJECTS.entries()) {
    const project = await prisma.project.create({
      data: {
        name: def.name,
        key: def.key,
        description: def.description,
        status: "IN_PROGRESS",
        ownerId: user.id,
        members: {
          create: assignees.map((a) => ({ userId: a.id, role: a.id === user.id ? "OWNER" : "MEMBER" })),
        },
      },
    });

    const baseCount = projectIndex === 0 ? 50 : 26;
    const tasks = assignees
      .flatMap((a) => buildTasks(project.id, a.id, user.id, Math.round(baseCount * a.weight), a.skill))
      .map((t, i) => ({ ...t, number: i + 1, position: i }));

    await prisma.task.createMany({ data: tasks });
    total += tasks.length;
    console.log(`✅ ${def.key} — ${def.name}: ${tasks.length} task`);
  }

  console.log(`✅ Nhóm "${team.name}" — trưởng nhóm ${user.name}, ${candidates.length} thành viên: ${candidates.map((c) => c.name).join(", ") || "(không có tài khoản demo)"}`);
  console.log(`\n🎉 Đã tạo ${total} task demo cho ${assignees.length} người.`);
  console.log('   Mở menu "Công việc → Thống Kê Công Việc" → chọn "Cá nhân" hoặc nhóm demo. Xoá dữ liệu demo: --clean');
}

main()
  .catch((err) => {
    console.error("❌", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
