FROM node:18-alpine AS builder

RUN corepack enable

WORKDIR /app

COPY packages/backend/api-gateway/package.json ./
COPY packages/backend/api-gateway/tsconfig.json ./
COPY tsconfig.base.json ../

COPY packages/shared/types ../shared/types

RUN pnpm install

COPY packages/backend/api-gateway/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)


FROM node:18-alpine

RUN corepack enable
RUN apk add --no-cache su-exec

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY packages/backend/api-gateway/package.json ./
COPY packages/shared/types ../shared/types

RUN pnpm install --prod

COPY --from=builder /app/dist ./dist
COPY packages/backend/api-gateway/entrypoint.sh ./

RUN chmod +x ./entrypoint.sh && chown -R nodejs:nodejs /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
