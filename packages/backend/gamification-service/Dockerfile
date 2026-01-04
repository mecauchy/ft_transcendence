FROM node:18-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY packages/backend/gamification-service/package.json ./
COPY packages/backend/gamification-service/tsconfig.json ./
COPY packages/shared/types ../shared/types

WORKDIR /shared/types
ENV CI=true
RUN pnpm install && pnpm run build

WORKDIR /app
RUN pnpm install

COPY packages/shared/prisma/schema.prisma ./node_modules/.prisma/schema.prisma
RUN pnpm exec prisma generate --schema=./node_modules/.prisma/schema.prisma

COPY packages/backend/gamification-service/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)
RUN pnpm prune --prod

FROM node:18-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
	adduser -S nodejs -u 1001

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache su-exec

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY packages/backend/gamification-service/package.json ./
COPY packages/backend/gamification-service/entrypoint.sh ./

RUN chmod +x ./entrypoint.sh && chown -R nodejs:nodejs /app

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
	CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
