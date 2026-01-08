FROM node:20-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 1. Copy Lockfile & Manifests first (Optimizes Docker Cache)
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY packages/backend/api-gateway/package.json ./packages/backend/api-gateway/package.json
# Copy tsconfig base to parent directory (standard monorepo structure)
COPY tsconfig.base.json ./tsconfig.base.json

# 2. Copy Shared Dependencies (REQUIRED for your build)
COPY packages/shared/types ./packages/shared/types

# 3. Install Dependencies
# Use the frozen lockfile for deterministic installs and hoist to a flat node_modules
RUN pnpm install --frozen-lockfile --shamefully-hoist

# 4. Copy Source Code
# Copy package tsconfig and source
COPY packages/backend/api-gateway/tsconfig.json ./packages/backend/api-gateway/tsconfig.json
COPY packages/backend/api-gateway/src ./packages/backend/api-gateway/src

# Build TypeScript files
WORKDIR /app/packages/backend/api-gateway
RUN pnpm run build && test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)

# Production stage
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
COPY packages/backend/api-gateway/package.json ./packages/backend/api-gateway/package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY packages/shared/types ./packages/shared/types
# Install production dependencies deterministically from the lockfile (hoisted layout)
RUN pnpm install --prod --frozen-lockfile --shamefully-hoist

# 4. Copy Built Artifacts from Builder (package build output path)
COPY --from=builder /app/packages/backend/api-gateway/dist ./dist

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
    CMD node -e "require('http').get('http://127.0.0.1:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Fixed Typo: "dist// cindex.js" -> "dist/index.js"
CMD ["node", "dist/index.js"]
