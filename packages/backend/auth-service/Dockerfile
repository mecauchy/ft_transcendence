FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY packages/backend/auth-service/package.json ./
COPY packages/backend/auth-service/tsconfig.json ./
COPY packages/shared/types ../shared/types
COPY packages/shared/prisma ../shared/prisma

WORKDIR /shared/types
ENV CI=true
RUN pnpm install && pnpm run build

WORKDIR /app
RUN pnpm install

COPY packages/backend/auth-service/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)
RUN pnpm prune --prod


FROM node:18-alpine

RUN corepack enable
RUN apk add --no-cache su-exec

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY packages/backend/auth-service/package.json ./
COPY packages/backend/auth-service/entrypoint.sh ./

RUN chmod +x ./entrypoint.sh && chown -R nodejs:nodejs /app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
