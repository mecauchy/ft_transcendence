FROM node:18-alpine AS builder

RUN corepack enable

WORKDIR /app

COPY packages/backend/user-service/package.json ./
COPY packages/backend/user-service/tsconfig.json ./
COPY packages/shared/types ../shared/types
COPY packages/shared/prisma ./prisma

RUN pnpm install

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

COPY packages/backend/user-service/src ./src

RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)

# Prune devDependencies, keep generated Prisma client
RUN pnpm prune --prod

FROM node:18-alpine

RUN corepack enable

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p /app/uploads/avatars && chown -R nodejs:nodejs /app/uploads

# Copy pruned node_modules with generated Prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY packages/backend/user-service/package.json ./

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
