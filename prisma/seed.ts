import "./load-env";
import { prisma } from "../src/lib/prisma";
import { scryptSync, randomBytes } from "crypto";
import { createInterface } from "node:readline/promises";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const ADMIN_EMAIL = "admin@kztek.net";

// Có seed dữ liệu mẫu (users demo, dự án, sprint, tasks) hay không — thứ tự ưu tiên:
//   1. Cờ dòng lệnh --demo / --no-demo   (VD: npx prisma db seed -- --demo)
//   2. Biến môi trường SEED_DEMO_DATA=true|false
//   3. Hỏi trực tiếp nếu đang chạy trong terminal (mặc định: Không)
//   4. Còn lại (CI, Docker, không có terminal): Không
async function shouldSeedDemo(): Promise<boolean> {
  const args = process.argv.slice(2);
  if (args.includes("--demo")) return true;
  if (args.includes("--no-demo")) return false;

  const env = process.env.SEED_DEMO_DATA?.trim().toLowerCase();
  if (env) return ["true", "1", "yes", "y"].includes(env);

  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      "❓ Tạo dữ liệu mẫu (người dùng demo, dự án, sprint, tasks)? [y/N]: "
    );
    return ["y", "yes", "c", "co", "có"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

// Luôn đảm bảo có tài khoản admin để đăng nhập lần đầu. Nếu đã tồn tại thì
// giữ nguyên (không reset mật khẩu admin đã đổi).
async function seedAdmin(): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) return false;

  await prisma.user.create({
    data: {
      name: "Quản trị viên KZTEK",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword("Kztek@2026"),
      avatarColor: "#f05922",
      title: "System Administrator",
      role: "ADMIN",
    },
  });
  return true;
}

async function main() {
  const created = await seedAdmin();
  console.log(
    created
      ? `✅ Đã tạo tài khoản admin: ${ADMIN_EMAIL} / Kztek@2026 (đổi mật khẩu sau khi đăng nhập)`
      : `ℹ️  Tài khoản admin ${ADMIN_EMAIL} đã tồn tại — giữ nguyên`
  );

  // Dữ liệu mẫu chỉ tạo trên DB trống (ngoài admin) để không bao giờ ghi đè/xoá dữ liệu thật.
  const [projectCount, otherUserCount] = await Promise.all([
    prisma.project.count(),
    prisma.user.count({ where: { email: { not: ADMIN_EMAIL } } }),
  ]);
  if (projectCount > 0 || otherUserCount > 0) {
    console.log("ℹ️  CSDL đã có dữ liệu — bỏ qua dữ liệu mẫu.");
    return;
  }

  if (!(await shouldSeedDemo())) {
    console.log("ℹ️  Bỏ qua dữ liệu mẫu.");
    return;
  }

  await seedDemoData();
}

async function seedDemoData() {
  const passwordHash = hashPassword("demo123");

  const [alice, binh, chi] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Alice Nguyen",
        email: "alice@demo.dev",
        passwordHash,
        avatarColor: "#6366f1",
        title: "Product Manager",
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        name: "Binh Tran",
        email: "binh@demo.dev",
        passwordHash,
        avatarColor: "#10b981",
        title: "Backend Engineer",
        role: "MEMBER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Chi Le",
        email: "chi@demo.dev",
        passwordHash,
        avatarColor: "#f59e0b",
        title: "Frontend Engineer",
        role: "MEMBER",
      },
    }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: "FlowBoard Core",
      key: "FB",
      description: "Xây dựng nền tảng quản lý công việc thế hệ mới",
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: "OWNER" },
          { userId: binh.id, role: "MEMBER" },
          { userId: chi.id, role: "MEMBER" },
        ],
      },
      labels: {
        create: [
          { name: "frontend", color: "#3b82f6" },
          { name: "backend", color: "#10b981" },
          { name: "bug", color: "#ef4444" },
          { name: "design", color: "#a855f7" },
          { name: "infra", color: "#64748b" },
          { name: "ai", color: "#f59e0b" },
        ],
      },
    },
  });

  const labels = await prisma.label.findMany({ where: { projectId: project.id } });
  const labelByName = Object.fromEntries(labels.map((l) => [l.name, l]));

  const sprint1 = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 1 — Nền tảng",
      goal: "Hoàn thành auth, board và realtime",
      status: "COMPLETED",
      startDate: daysAgo(28),
      endDate: daysAgo(14),
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 2 — Báo cáo & AI",
      goal: "Dashboard báo cáo, AI assistant, hoàn thiện UX",
      status: "ACTIVE",
      startDate: daysAgo(10),
      endDate: daysFromNow(4),
    },
  });

  type SeedTask = {
    title: string;
    description?: string;
    type?: string;
    status: string;
    priority?: string;
    points?: number;
    assignee?: string;
    sprint?: string;
    labels?: string[];
    due?: Date;
    completedDaysAgo?: number;
    subtasks?: { title: string; done: boolean }[];
  };

  const tasks: SeedTask[] = [
    // Sprint 1 (completed)
    { title: "Thiết kế schema database", description: "Mô hình hoá User, Project, Sprint, Task, Comment, Activity.", type: "STORY", status: "DONE", priority: "HIGH", points: 5, assignee: binh.id, sprint: sprint1.id, labels: ["backend"], completedDaysAgo: 24 },
    { title: "Xây dựng hệ thống đăng nhập/đăng ký", description: "JWT + httpOnly cookie, scrypt hashing, validation bằng zod.", type: "STORY", status: "DONE", priority: "URGENT", points: 8, assignee: binh.id, sprint: sprint1.id, labels: ["backend"], completedDaysAgo: 22 },
    { title: "Thiết kế design system", description: "Bảng màu, typography, component tokens theo hướng Linear-style.", type: "TASK", status: "DONE", priority: "HIGH", points: 3, assignee: chi.id, sprint: sprint1.id, labels: ["design"], completedDaysAgo: 23 },
    { title: "Kanban board kéo thả", description: "5 cột trạng thái, drag & drop mượt với dnd-kit, optimistic updates.", type: "STORY", status: "DONE", priority: "URGENT", points: 8, assignee: chi.id, sprint: sprint1.id, labels: ["frontend"], completedDaysAgo: 19 },
    { title: "Task detail dialog", description: "Modal chỉnh sửa đầy đủ: mô tả, assignee, priority, labels, comments.", type: "STORY", status: "HIGH", points: 5, assignee: chi.id, sprint: sprint1.id, labels: ["frontend"], completedDaysAgo: 17 },
    { title: "Realtime qua SSE", description: "Server-Sent Events broadcast thay đổi task tới mọi client đang mở board.", type: "STORY", status: "DONE", priority: "HIGH", points: 5, assignee: binh.id, sprint: sprint1.id, labels: ["backend"], completedDaysAgo: 16 },
    { title: "Lỗi drag thả mất thứ tự khi reload", description: "Position không được persist đúng khi thả vào cột khác.", type: "BUG", status: "DONE", priority: "URGENT", points: 2, assignee: chi.id, sprint: sprint1.id, labels: ["bug", "frontend"], completedDaysAgo: 15 },
    { title: "Seed dữ liệu demo", description: "3 users, 1 project, 2 sprints, ~20 tasks để demo báo cáo.", type: "TASK", status: "DONE", priority: "LOW", points: 1, assignee: alice.id, sprint: sprint1.id, labels: ["backend"], completedDaysAgo: 14 },

    // Sprint 2 (active)
    { title: "Burndown chart", description: "Biểu đồ burndown theo sprint: ideal line vs actual remaining points, cập nhật theo ngày.", type: "STORY", status: "DONE", priority: "HIGH", points: 5, assignee: binh.id, sprint: sprint2.id, labels: ["frontend", "backend"], completedDaysAgo: 6 },
    { title: "Velocity chart qua các sprint", description: "So sánh committed vs completed points giữa các sprint.", type: "STORY", status: "IN_REVIEW", priority: "MEDIUM", points: 3, assignee: binh.id, sprint: sprint2.id, labels: ["frontend"], due: daysFromNow(1) },
    { title: "Workload theo thành viên", description: "Phân bố points/tasks đang mở theo assignee, cảnh báo quá tải.", type: "STORY", status: "IN_PROGRESS", priority: "MEDIUM", points: 5, assignee: chi.id, sprint: sprint2.id, labels: ["frontend"], due: daysFromNow(2) },
    { title: "AI sinh mô tả task", description: "Từ tiêu đề, AI tự viết mô tả chi tiết kèm acceptance criteria.", type: "STORY", status: "IN_PROGRESS", priority: "HIGH", points: 8, assignee: binh.id, sprint: sprint2.id, labels: ["ai", "backend"], due: daysFromNow(3), subtasks: [
      { title: "Local heuristic engine", done: true },
      { title: "Tích hợp OpenAI API (tuỳ chọn)", done: false },
      { title: "Nút 'AI suggest' trong task dialog", done: false },
    ] },
    { title: "AI ước lượng story points", description: "Gợi ý story points dựa trên độ phức tạp tiêu đề + lịch sử task tương tự.", type: "STORY", status: "TODO", priority: "MEDIUM", points: 5, assignee: binh.id, sprint: sprint2.id, labels: ["ai"], due: daysFromNow(3) },
    { title: "AI gợi ý labels & subtasks", description: "Phân tích tiêu đề để gợi ý labels phù hợp và chia nhỏ công việc.", type: "STORY", status: "TODO", priority: "LOW", points: 3, assignee: chi.id, sprint: sprint2.id, labels: ["ai", "frontend"], due: daysFromNow(4) },
    { title: "Lỗi SSE không reconnect khi mạng chập chờn", description: "Client không tự kết nối lại sau khi mất mạng, phải reload trang.", type: "BUG", status: "TODO", priority: "HIGH", points: 2, assignee: binh.id, sprint: sprint2.id, labels: ["bug", "backend"], due: daysFromNow(1) },
    { title: "Phím tắt toàn cục", description: "C tạo task mới, / focus search, 1-5 đổi priority task đang chọn.", type: "TASK", status: "BACKLOG", priority: "LOW", points: 3, assignee: chi.id, sprint: sprint2.id, labels: ["frontend"] },
    { title: "Dark mode", description: "Theme tối mặc định, toggle trong topbar, lưu preference.", type: "TASK", status: "BACKLOG", priority: "MEDIUM", points: 2, assignee: chi.id, labels: ["frontend", "design"] },
    { title: "Thông báo trong app", description: "Chuông thông báo khi được assign, mention trong comment.", type: "STORY", status: "BACKLOG", priority: "MEDIUM", points: 5, labels: ["frontend", "backend"] },
    { title: "Export báo cáo PDF", description: "Xuất báo cáo sprint ra PDF để chia sẻ với stakeholders.", type: "TASK", status: "BACKLOG", priority: "LOW", points: 3, labels: ["frontend"] },
    { title: "Tối ưu query board khi >500 tasks", description: "Đánh index, phân trang theo cột, virtual scroll.", type: "TASK", status: "BACKLOG", priority: "MEDIUM", points: 5, assignee: binh.id, labels: ["backend", "infra"] },
  ];

  let number = 0;
  for (const t of tasks) {
    number += 1;
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        number,
        title: t.title,
        description: t.description,
        type: t.type ?? "TASK",
        status: t.status,
        priority: t.priority ?? "MEDIUM",
        storyPoints: t.points,
        position: number * 1000,
        assigneeId: t.assignee,
        creatorId: alice.id,
        sprintId: t.sprint,
        dueDate: t.due,
        completedAt: t.completedDaysAgo ? daysAgo(t.completedDaysAgo) : undefined,
        labels: t.labels?.length
          ? { create: t.labels.map((name) => ({ labelId: labelByName[name].id })) }
          : undefined,
        subtasks: t.subtasks?.length ? { create: t.subtasks } : undefined,
        activity: {
          create: {
            actorId: alice.id,
            action: "CREATED",
            detail: "đã tạo task này",
          },
        },
      },
    });

    if (t.status === "DONE" && t.assignee) {
      await prisma.comment.create({
        data: {
          taskId: task.id,
          authorId: t.assignee,
          body: "Đã hoàn thành, nhờ mọi người review giúp 🙌",
        },
      });
    }
  }

  console.log("✅ Đã tạo dữ liệu mẫu:");
  console.log("   Users: alice@demo.dev / binh@demo.dev / chi@demo.dev (mật khẩu: demo123)");
  console.log(`   Project: ${project.name} (${project.key}) — 2 sprints, ${number} tasks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
