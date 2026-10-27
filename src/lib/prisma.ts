import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import type sql from "mssql";

// Ngưỡng (ms) coi 1 query là "chậm" và log cảnh báo — phục vụ theo dõi hiệu
// năng sau đợt tối ưu connection pool + dashboard groupBy. Chỉnh qua biến môi
// trường PRISMA_SLOW_QUERY_MS khi cần soi kỹ hơn (mặc định 150ms).
const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_QUERY_MS) || 150;

// Next.js tự nạp DATABASE_URL từ .env — KHÔNG ghi mật khẩu cứng ở đây.
// Lúc `next build` (Docker) có thể chưa có biến này: dùng chuỗi giả không chứa
// thông tin đăng nhập, vì client chỉ mở kết nối khi có query thật.
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NEXT_PHASE === "phase-production-build" ? "sqlserver://localhost:1433" : "");

if (!connectionString) {
  throw new Error("Thiếu biến môi trường DATABASE_URL — đặt trong file .env");
}

// ---------------------------------------------------------------------------
// Parse "sqlserver://host:port;key=value;..." thành sql.config object thay vì
// truyền thẳng string cho PrismaMssql.
//
// LÝ DO: khi PrismaMssql nhận string, nó tự parse nhưng KHÔNG có cách nào qua
// connection string để chỉnh pool.min / idleTimeoutMillis (chỉ hỗ trợ
// "connectionLimit" -> pool.max). Thư viện mssql mặc định dùng
// { min: 0, idleTimeoutMillis: 30000 } — nghĩa là sau 30 giây không có query
// nào, TOÀN BỘ connection trong pool bị đóng. Request tiếp theo phải bắt tay
// lại từ đầu (TCP + TLS + SQL auth) trước khi chạy được query — đo thực tế
// tốn ~90ms-1.3s tuỳ thời điểm, dù bản thân TCP round-trip tới server chỉ
// ~30ms. Đây là nguyên nhân chính gây cảm giác "load chậm" mỗi khi quay lại
// thao tác sau một khoảng nghỉ, dù network/kết nối server vẫn tốt.
//
// Fix: giữ tối thiểu 1 connection luôn "warm" (pool.min: 1) và tăng
// idleTimeoutMillis lên 5 phút để phù hợp hơn với nhịp thao tác thực tế.
//
// CẬP NHẬT: pool.min=1 vẫn không đủ. Mỗi lần tải 1 trang, client bắn 3-4
// request API song song, mỗi request đó lại tự chạy 2-4 query song song bên
// trong (Promise.all) — tức có thể cần 8-12 connection CÙNG LÚC. Với chỉ 1
// connection ấm sẵn, phần lớn query phải đợi mở connection mới (bắt tay lại
// từ đầu). Đã đo trực tiếp bằng burst 12 query đồng thời:
//   pool.min=1 → 684ms/215ms (lần 1/lần 2)
//   pool.min=8 → 328ms/77ms
// → tăng pool.min lên 8 (vẫn dưới max=10) để khớp với mức độ đồng thời thực
// tế của app, tránh phải mở connection mới giữa chừng khi tải trang.
// ---------------------------------------------------------------------------
function parseMssqlConnectionString(connStr: string): sql.config {
  const withoutProtocol = connStr.replace(/^sqlserver:\/\//, "");
  const parts = withoutProtocol
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const [hostPart, ...paramParts] = parts;
  const [host, portStr] = hostPart.split(":");

  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    params[key] = part.slice(eq + 1).trim();
  }

  return {
    server: host,
    port: portStr ? parseInt(portStr, 10) : undefined,
    database: params.database,
    user: params.user,
    password: params.password,
    options: {
      encrypt: (params.encrypt ?? "false").toLowerCase() === "true",
      trustServerCertificate:
        (params.trustServerCertificate ?? "false").toLowerCase() === "true",
    },
    pool: {
      min: 8,
      max: 10,
      idleTimeoutMillis: 5 * 60 * 1000, // 5 phút thay vì mặc định 30 giây
    },
  } as sql.config;
}

function createClient() {
  const adapter = new PrismaMssql(parseMssqlConnectionString(connectionString));
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
