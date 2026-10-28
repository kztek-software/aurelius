import { existsSync } from "node:fs";

// Nạp .env khi chạy seed trực tiếp bằng tsx (giống prisma.config.ts). Phải là
// module riêng và được import TRƯỚC src/lib/prisma — module đó đọc DATABASE_URL
// ngay khi import. Biến đã đặt sẵn trong môi trường không bị ghi đè.
if (existsSync(".env")) process.loadEnvFile(".env");
