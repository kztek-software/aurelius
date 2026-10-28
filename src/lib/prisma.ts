import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Ngưỡng (ms) coi 1 query là "chậm" và log cảnh báo — phục vụ theo dõi hiệu
// năng sau đợt tối ưu connection pool + dashboard groupBy. Chỉnh qua biến môi
// trường PRISMA_SLOW_QUERY_MS khi cần soi kỹ hơn (mặc định 150ms).
const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_QUERY_MS) || 150;

// Next.js tự nạp DATABASE_URL từ .env — KHÔNG ghi mật khẩu cứng ở đây.
// Lúc `next build` (Docker) có thể chưa có biến này: dùng chuỗi giả không chứa
// thông tin đăng nhập, vì client chỉ mở kết nối khi có query thật.
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NEXT_PHASE === "phase-production-build" ? "postgresql://localhost:5432/postgres" : "");

if (!connectionString) {
  throw new Error("Thiếu biến môi trường DATABASE_URL — đặt trong file .env");
}

// ---------------------------------------------------------------------------
// Cấu hình pool cho node-postgres (pg.Pool).
//
// Mỗi lần tải 1 trang, client bắn 3-4 request API song song, mỗi request lại
// tự chạy 2-4 query song song (Promise.all) — có thể cần 8-12 connection CÙNG
// LÚC. pg.Pool mặc định max=10, idleTimeoutMillis=10s: sau 10 giây nghỉ các
// connection bị đóng và request tiếp theo phải bắt tay lại (TCP + TLS + auth).
// → tăng idleTimeoutMillis lên 5 phút để giữ connection "ấm" theo nhịp thao
// tác thực tế (pg.Pool không có pool.min như mssql).
// ---------------------------------------------------------------------------
const poolConfig = {
  connectionString,
  max: 10,
  idleTimeoutMillis: 5 * 60 * 1000, // 5 phút thay vì mặc định 10 giây
  connectionTimeoutMillis: 10_000,
};

function createClient() {
  const adapter = new PrismaPg(poolConfig);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Log thời gian xử lý từng query. Query nào vượt SLOW_QUERY_MS được cảnh
  // báo rõ (kèm model + operation + số ms) để phát hiện sớm vấn đề hiệu năng
  // (N+1, thiếu index, reconnect...) thay vì phải đoán mò như lần trước.
  // Đặt PRISMA_LOG_ALL_QUERIES=true để log cả query nhanh (dùng khi debug sâu).
  return client.$extends({
    name: "query-timing-logger",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = performance.now();
          const result = await query(args);
          const durationMs = Math.round((performance.now() - start) * 10) / 10;
          if (durationMs >= SLOW_QUERY_MS) {
            console.warn(`[prisma:slow] ${model}.${operation} took ${durationMs}ms`);
          } else if (process.env.PRISMA_LOG_ALL_QUERIES === "true") {
            console.log(`[prisma:query] ${model}.${operation} took ${durationMs}ms`);
          }
          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

function getPrismaClient() {
  if (globalForPrisma.prisma && (globalForPrisma.prisma as unknown as { systemSetting?: unknown }).systemSetting) {
    return globalForPrisma.prisma;
  }
  const client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
