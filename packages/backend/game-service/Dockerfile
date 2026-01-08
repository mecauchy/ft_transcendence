FROM node:18-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

# Build shared types first
WORKDIR /shared/types
COPY packages/shared/types ./
ENV CI=true
RUN pnpm install && pnpm run build

WORKDIR /app

COPY packages/backend/game-service/package.json ./
COPY packages/backend/game-service/tsconfig.json ./
COPY packages/shared/types ../shared/types
COPY packages/shared/prisma ../shared/prisma

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN pnpm install
# Create root package.json for Prisma to find, then generate client
RUN echo '{"name":"root","private":true}' > /package.json && \
    pnpm exec prisma generate --schema=../shared/prisma/schema.prisma && \
    rm /package.json

COPY packages/backend/game-service/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)

RUN pnpm prune --prod

FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

RUN corepack enable
RUN apk add --no-cache su-exec

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY packages/backend/game-service/package.json ./
COPY packages/backend/game-service/entrypoint.sh ./

RUN chmod +x ./entrypoint.sh && chown -R nodejs:nodejs /app

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
