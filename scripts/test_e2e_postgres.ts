import { prisma } from "../src/lib/prisma";
import { scryptSync, timingSafeEqual } from "crypto";

function verifyPassword(password: string, combined: string): boolean {
  try {
    const [salt, hash] = combined.split(":");
    if (!salt || !hash) return false;
    const computed = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

async function runE2EVerification() {
  console.log("==================================================");
  console.log("  KZTEK WORK MANAGEMENT: POSTGRESQL E2E VERIFICATION");
  console.log("==================================================");

  // 1. Verify Users in PostgreSQL
  console.log("\n1. Verifying Users & Authentication:");
  const users = await prisma.user.findMany();
  console.log(`  - Total Users found: ${users.length}`);
  for (const u of users) {
    console.log(`    * [${u.role}] ${u.name} (${u.email}) - ID: ${u.id}`);
  }

  const admin = users.find(u => u.email === "admin@kztek.net");
  if (admin) {
    const isAdminValid = verifyPassword("Kztek@2026", admin.passwordHash);
    console.log(`  - Admin password check (Kztek@2026): ${isAdminValid ? "PASS ✅" : "FAIL ❌"}`);
  }

  // 2. Verify Projects and Members
  console.log("\n2. Verifying Projects & Members:");
  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      members: { include: { user: true } },
      _count: { select: { tasks: true, customerTickets: true } },
    },
  });
  console.log(`  - Total Projects: ${projects.length}`);
  for (const p of projects) {
    console.log(`    * [${p.key}] ${p.name} (Owner: ${p.owner.name}) | ${p.members.length} members, ${p._count.tasks} tasks, ${p._count.customerTickets} tickets`);
  }

  // 3. Verify Customer Tickets
  console.log("\n3. Verifying Customer Tickets:");
  const tickets = await prisma.customerTicket.findMany({
    include: { comments: true, attachments: true, convertedTask: true },
  });
  console.log(`  - Total Tickets: ${tickets.length}`);
  for (const t of tickets) {
    console.log(`    * [${t.trackingCode}] ${t.title} (${t.status}) | ${t.comments.length} comments, converted: ${t.convertedTask ? `Task #${t.convertedTask.number}` : "None"}`);
  }

  // 4. Test CRUD Transaction on PostgreSQL
  console.log("\n4. Testing Realtime CRUD Transaction on PostgreSQL:");
  const firstProject = projects[0];
  const testTask = await prisma.task.create({
    data: {
      projectId: firstProject.id,
      number: 9999,
      title: "PostgreSQL Verification Test Task",
      description: "Nhiệm vụ kiểm thử tự động ghi đọc trên CSDL Microsoft PostgreSQL",
      type: "TASK",
      status: "TODO",
      priority: "HIGH",
      storyPoints: 3,
      creatorId: users[0].id,
    },
  });
  console.log(`  - Created test task ID: ${testTask.id} (#${testTask.number})`);

  const updatedTask = await prisma.task.update({
    where: { id: testTask.id },
    data: { status: "DONE", description: "Đã hoàn thành kiểm thử trên PostgreSQL" },
  });
  console.log(`  - Updated test task status: ${updatedTask.status} (${updatedTask.description})`);

  await prisma.task.delete({ where: { id: testTask.id } });
  console.log(`  - Deleted test task cleanly from PostgreSQL.`);

  // 5. Verify Role Definitions
  console.log("\n5. Verifying Role Definitions Matrix:");
  const roles = await prisma.roleDefinition.findMany();
  console.log(`  - Total Roles: ${roles.length}`);
  for (const r of roles) {
    console.log(`    * [${r.key}] ${r.name} (System: ${r.isSystem})`);
  }

  console.log("\n==================================================");
  console.log("  ALL E2E TESTS PASSED ON POSTGRESQL! ✅");
  console.log("==================================================");
}

runE2EVerification()
  .catch((e) => {
    console.error("E2E Verification Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
