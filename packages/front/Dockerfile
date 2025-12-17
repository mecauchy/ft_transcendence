#  Dockerfile optimized for the front-end application
# Builder stage
FROM node:18-alpine AS builder

# Enable pnpm via Corepack (bundled with Node)
RUN corepack enable

WORKDIR /app

# Copy package files
COPY packages/front/package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN pnpm install

# Copy source files
COPY packages/front/. .

# Build the front-end application for development
RUN pnpm run build && test -d dist || (echo "Build failed: dist directory not found" && exit 1)

# Production stage
FROM node:18-alpine
# Enable pnpm via Corepack (bundled with Node)
RUN corepack enable
WORKDIR /app
# Create a non-root user for rootless execution
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs
# Copy package.json and lockfile for production dependencies
COPY packages/front/package.json packages/front/pnpm-lock.yaml ./
# Install all dependencies (including dev dependencies needed for preview)
RUN pnpm install
# Copy built files from the builder stage
COPY --from=builder /app/dist ./dist
# Change ownership of the application files to the non-root user
RUN chown -R nodejs:nodejs /app
# Switch to the non-root user
USER nodejs
# Expose the application port (will be overridden by PORT env var)
EXPOSE 3005
# Start the application with Vite preview server using PORT env var
CMD ["sh", "-c", "pnpm preview --host 0.0.0.0 --port ${PORT:-3005}"]

