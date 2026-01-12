#==========================
# Builder stage (BUILDER)
#==========================
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY pnpm-lock.yaml ./pnpm-lock.yaml

RUN mkdir -p ./packages/front
COPY packages/front/package.json ./packages/front/package.json

RUN pnpm install --frozen-lockfile --shamefully-hoist

COPY packages/front/ ./packages/front/

RUN pnpm --filter front run build

#==========================
# Runner stage (PRODUCTION)
#==========================


FROM node:20-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs

RUN apk add --no-cache openssl

COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

COPY --from=builder /app/packages/front/dist ./dist

COPY --from=builder /app/packages/front/https-server.js ./https-server.js

RUN mkdir -p /app/certs && chown -R nodejs:nodejs /app /app/certs


COPY packages/front/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nodejs

EXPOSE 3005

ENTRYPOINT ["sh", "/entrypoint.sh"]

CMD ["sh", "-c", "pnpm preview --host 0.0.0.0 --port ${PORT:-3005}"]
