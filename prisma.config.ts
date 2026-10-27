import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 KHÔNG tự đọc file .env khi chạy CLI (db push, generate, seed...) —
// nạp thủ công bằng API có sẵn của Node (>= 20.12), không cần thêm dotenv.
// Bỏ qua nếu không có .env (VD: trong Docker build, biến được truyền qua env).
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Không ghi mật khẩu ở đây — đặt DATABASE_URL trong .env
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
