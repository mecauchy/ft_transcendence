#  Dockerfile optimized for the front-end application
#==========================
# Builder stage (BUILDER)
#==========================
FROM node:20-alpine AS builder

# Enable pnpm via Corepack (bundled with Node)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy dependency files
COPY pnpm-lock.yaml ./

# Install dependencies using pnpm
# Use --no-frozen-lockfile to avoid build failures when lockfile is out-of-sync; update the repo lockfile
# to reinstate --frozen-lockfile for deterministic builds.
RUN pnpm install --no-frozen-lockfile

# Copy source files
COPY packages/front/ .

# Build the front-end application for development (this create the dist/ folder)
RUN pnpm run build

#==========================
# Runner stage (PRODUCTION)
#==========================

# Production stage (RUNNER)
FROM node:20-alpine AS runner
# Enable pnpm via Corepack (bundled with Node)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
# Create a non-root user for rootless execution
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs
# Install openssl so the container can generate TLS certs at startup
RUN apk add --no-cache openssl
# Copy package.json to run scripts
COPY --from=builder /app/package.json ./package.json
# Copy lockfile to ensure exact dependency versions
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
# Install all dependencies (including dev dependencies needed for preview)
# Using --no-frozen-lockfile for robustness during CI/build; keep lockfile in the repo up-to-date
RUN pnpm install --no-frozen-lockfile
# Copy dist/ folder from the builder stage
COPY --from=builder /app/dist ./dist
# Copy bundled HTTPS server script from the builder context
COPY --from=builder /app/https-server.js ./https-server.js
# Keep dev dependencies in the image so `pnpm preview` (vite) is available.
# Removing `pnpm install --prod` prevents pruning devDependencies (which would remove vite).
# Create a certs directory and make it writable by the non-root user so the entrypoint can generate certs.
RUN mkdir -p /app/certs && chown -R nodejs:nodejs /app /app/certs

# Copy entrypoint that will generate TLS certs if missing and start the server.
COPY packages/front/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nodejs
# Expose the application port (will be overridden by PORT env var)
EXPOSE 3005
# Start the application with the entrypoint which will run the preview server.
ENTRYPOINT ["sh", "/entrypoint.sh"]
# Default command (can be overridden by docker-compose). Entrypoint will exec this.
CMD ["sh", "-c", "pnpm preview --host 0.0.0.0 --port ${PORT:-3005}"]

