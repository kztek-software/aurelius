# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# KZTEK Work Management (flowboard) — Next.js 16 App Router
# Kết nối PostgreSQL (service `db` trong docker-compose.yml hoặc server ngoài)
# qua biến môi trường DATABASE_URL (xem prisma/schema.prisma + src/lib/prisma.ts).
# ---------------------------------------------------------------------------

ARG NODE_VERSION=20

# --- Stage 1: deps — cài dependencies + generate Prisma Client -------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# --- Stage 2: builder — build Next.js (standalone output) ------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# DATABASE_URL không bắt buộc lúc build (không có trang static nào query DB),
# nhưng cho phép truyền vào nếu cần trong tương lai.
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

RUN npm run build

# --- Stage 3: runner — image production tối giản ---------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# public/uploads chứa file người dùng upload (src/app/api/upload/route.ts) —
# mount volume ra ngoài container để không mất dữ liệu khi redeploy.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
