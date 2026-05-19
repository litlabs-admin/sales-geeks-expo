# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable pnpm

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/worker/package.json ./apps/worker/
COPY packages/domain/package.json ./packages/domain/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable pnpm

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy workspace manifests (needed for pnpm workspace resolution)
COPY pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/

# Copy source — domain package exports .ts source directly, tsx handles it
COPY packages ./packages
COPY apps/backend/src ./apps/backend/src

EXPOSE 8081

ENV NODE_ENV=production

# Drop root — node:20-alpine ships an unprivileged "node" user (uid 1000).
# The app only reads /app; tsx caches to /tmp. No write to /app needed.
USER node

CMD ["node", "--import", "tsx/esm", "apps/backend/src/server.ts"]
