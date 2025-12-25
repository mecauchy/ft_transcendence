FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY packages/backend/game-service/package.json ./
COPY packages/backend/game-service/tsconfig.json ./
COPY packages/shared/types ../shared/types

RUN pnpm install

COPY packages/backend/game-service/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)

FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
	adduser -S nodejs -u 1001

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY packages/backend/game-service/package.json ./
COPY packages/shared/types ../shared/types

RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

CMD ["node", "dist/index.js"]
