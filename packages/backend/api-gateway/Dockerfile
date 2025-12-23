FROM node:18-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 1. Copy Lockfile & Manifests first (Optimizes Docker Cache)
COPY packages/backend/api-gateway/pnpm-lock.yaml ./pnpm-lock.yaml
COPY packages/backend/api-gateway/package.json ./
# Copy tsconfig base to parent directory (standard monorepo structure)
COPY tsconfig.base.json ./tsconfig.base.json

# 2. Copy Shared Dependencies (REQUIRED for your build)
COPY packages/shared/types ../shared/types

# 3. Install Dependencies
# Use --no-frozen-lockfile here to allow the container to resolve transient devDependency
# mismatches (lockfile should be updated in repo for fully deterministic builds).
RUN pnpm install --no-frozen-lockfile

# 4. Copy Source Code
COPY packages/backend/api-gateway/tsconfig.json ./
COPY packages/backend/api-gateway/src ./src

# 5. Build
# We force a clean of 'dist' just in case, though in Docker it should be empty
RUN rm -rf dist && pnpm run build

# --- Production Stage ---
FROM node:18-alpine

RUN corepack enable

WORKDIR /app

# 1. Install Runtime Dependencies
# We keep 'su-exec' because your entrypoint needs it to drop privileges after reading secrets
RUN apk add --no-cache wget su-exec

# 2. Create User
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 3. Install Production Dependencies Only
COPY packages/backend/api-gateway/package.json ./
COPY packages/backend/api-gateway/pnpm-lock.yaml ./pnpm-lock.yaml
COPY packages/shared/types ../shared/types
# Use --no-frozen-lockfile for now; update pnpm-lock.yaml in repo to restore --frozen-lockfile
RUN pnpm install --prod --no-frozen-lockfile

# 4. Copy Built Artifacts from Builder
COPY --from=builder /app/dist ./dist

# 5. Permissions
RUN chown -R nodejs:nodejs /app

# 6. Setup Entrypoint for Secrets
COPY packages/backend/api-gateway/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 755 /usr/local/bin/entrypoint.sh

# Run as root initially so entrypoint.sh can read /run/secrets, 
# then it drops privileges to 'nodejs' using su-exec.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Fixed Typo: "dist// cindex.js" -> "dist/index.js"
CMD ["node", "dist/index.js"]
