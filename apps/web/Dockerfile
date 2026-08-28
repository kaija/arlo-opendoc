# ── Stage 1: install dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/config/package.json  ./packages/config/
COPY packages/client/package.json  ./packages/client/
COPY packages/ui/package.json      ./packages/ui/
COPY apps/web/package.json         ./apps/web/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @kb/shared build && \
    pnpm --filter @kb/client build && \
    pnpm --filter @kb/ui build && \
    pnpm --filter @kb/web build

# ── Stage 3: production image ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
