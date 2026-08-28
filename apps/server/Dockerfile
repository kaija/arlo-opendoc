# ── Stage 1: install dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests for pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/core/package.json   ./packages/core/
COPY packages/client/package.json ./packages/client/
COPY apps/server/package.json     ./apps/server/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY packages/ ./packages/
COPY apps/server/ ./apps/server/
COPY tsconfig.base.json ./

RUN pnpm --filter @kb/shared build && \
    pnpm --filter @kb/core build && \
    pnpm --filter @kb/client build && \
    pnpm --filter @kb/server build

# ── Stage 3: production image ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/core/dist   ./packages/core/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist
COPY --from=builder /app/apps/server/dist     ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# git must be installed for child_process.spawn("git", ...) to work
RUN apk add --no-cache git

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
