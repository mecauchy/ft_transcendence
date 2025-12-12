FROM node:18-alpine AS builder

# Enable pnpm via Corepack (bundled with Node)
RUN corepack enable

WORKDIR /app

# Copy package files
COPY packages/backend/api-gateway/package.json ./
COPY packages/backend/api-gateway/tsconfig.json ./
COPY tsconfig.base.json ../

# Copy local file: dependencies used by package.json
COPY packages/shared/types /shared/types

# Install dependencies
RUN pnpm install

# Copy source files
COPY packages/backend/api-gateway/src ./src

# Build TypeScript files
RUN pnpm run build

# Production stage
FROM node:18-alpine

# Enable pnpm via Corepack (bundled with Node)
RUN corepack enable

WORKDIR /app

# Create a non-root user for rootless execution
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package.json for production dependencies
COPY packages/backend/api-gateway/package.json ./

# Copy local file: dependencies used by package.json
COPY packages/shared/types /shared/types
RUN pnpm install --prod

# Copy built files from the builder stage
COPY --from=builder /app/dist ./dist

# Change ownership of the application files to the non-root user
RUN chown -R nodejs:nodejs /app

# Switch to the non-root user
USER nodejs

# Expose the application port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
