FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY packages/backend/auth-service/package.json ./
COPY packages/backend/auth-service/tsconfig.json ./
COPY packages/shared/types ../shared/types

RUN pnpm install

# Copy prisma schema and generate client AFTER pnpm install so it generates into the correct node_modules
COPY packages/shared/prisma/schema.prisma ./node_modules/.prisma/schema.prisma
RUN pnpm exec prisma generate --schema=./node_modules/.prisma/schema.prisma

COPY packages/backend/auth-service/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)

# prune deps
RUN pnpm prune --prod


FROM node:18-alpine

RUN corepack enable

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# copy from modules the generated prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY packages/backend/auth-service/package.json ./

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
