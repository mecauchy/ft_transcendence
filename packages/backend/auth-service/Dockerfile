FROM node:18-alpine AS builder

# Create a non-root user inside builder for deterministic file ownership
RUN addgroup -S node_user && adduser -S node_user -G node_user

WORKDIR /app

# Copy package files first to leverage Docker layer caching for dependencies
COPY packages/backend/auth-service/package*.json ./

# Copy shared types used by the build (keeps imports resolvable during tsc)
COPY packages/shared/types ../shared/types

# Copy tsconfig and source files for building
COPY packages/backend/auth-service/tsconfig.json ./
COPY packages/backend/auth-service/src ./src

# Install dev + prod dependencies required to build
RUN npm install --no-audit --no-fund

# Build TypeScript into dist/
RUN npm run build

### Runtime image
FROM node:18-alpine AS runner

WORKDIR /app

# Install small runtime tools used by healthchecks
RUN apk add --no-cache wget

# Ensure PATH is set for non-interactive shells
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Create runtime user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package.json (and lock if present) from builder to install prod deps deterministically
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --production --no-audit --no-fund

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy shared types into the runtime image so compiled code can require them
COPY --from=builder /shared/types ../shared/types

# Ensure non-root user owns app files
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Start the service
CMD ["node", "dist/index.js"]
