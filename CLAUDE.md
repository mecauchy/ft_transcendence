# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ft_transcendence** is a microservices-based web application built with a security-first architecture. The project implements a multi-tier network segmentation model with WAF protection, HashiCorp Vault for secret management, and comprehensive monitoring via Prometheus/Grafana and ELK stack.

## Build and Development Commands

### Essential Commands

```bash
# Start all services in production mode
make up

# Start in development mode (exposes backend ports)
make dev

# Start with monitoring stack (Prometheus, Grafana, ELK, Uptime-Kuma)
make monitoring

# Stop all containers
make down

# View logs
make logs                    # All services
make logs-[service-name]    # Specific service (vault, postgres, redis, waf, api-gateway, elk)
```

### Building Services

```bash
# Build TypeScript locally (for development with volume mounts)
make build                  # or make build-local

# Build Docker images
make build-docker

# Force rebuild without cache
make rebuild
```

### Secret Management

```bash
# Generate development secrets (first-time setup)
make secrets
# or: ./scripts/generate_dev_secrets.sh

# View credentials (safe for screen sharing)
./scripts/show_creds.sh

# Reveal actual passwords (private use only)
./scripts/show_creds.sh --reveal

# Manage Discord webhook for alerts
./scripts/webhook-manager.sh save '<url>'
./scripts/webhook-manager.sh load
./scripts/webhook-manager.sh show

# Uptime-Kuma admin credentials
./scripts/kuma-password.sh

# Set Uptime-Kuma admin password from Vault
make kuma-init-password
```

### Database and Service Access

```bash
make vault    # Open Vault shell
make db       # Connect to PostgreSQL (user: root_admin)
make redis    # Open Redis CLI
```

### Monitoring

```bash
# Initialize Kibana dashboard (run after monitoring starts)
make kibana-init

# Check service health
make health
```

### Cleanup

```bash
make clean              # Stop containers, prune unused resources (keeps volumes)
make clean-hard         # Remove containers, volumes, rebuild images (data loss!)
make clean-volumes      # Remove all volumes only (data loss warning)
make clean-all          # Nuclear option: remove everything
```

### Frontend Development

```bash
cd packages/front
pnpm dev          # Start Vite dev server
pnpm build        # Build for production
pnpm lint         # Run ESLint
```

### Backend Development

```bash
# API Gateway
cd packages/backend/api-gateway
pnpm dev          # Start with tsx watch mode
pnpm build        # Compile TypeScript to dist/
pnpm start        # Run compiled code
pnpm lint         # Run ESLint

# Auth Service
cd packages/backend/auth-service
pnpm dev          # Start with tsx watch mode
pnpm build        # Compile TypeScript to dist/
pnpm start        # Run compiled code
pnpm lint         # Run ESLint
```

## Architecture

### Network Segmentation

The application uses four isolated Docker networks for defense-in-depth:

- **public_net**: External-facing services (WAF, Frontend)
- **dmz_net**: DMZ layer (API Gateway, Auth Service behind WAF)
- **service_mesh**: Internal backend services (Vault, Postgres, Redis, Auth)
- **logging_net**: Monitoring and logging infrastructure (Prometheus, Grafana, ELK)

### Service Topology

```
Internet → WAF (ModSecurity) → API Gateway → Backend Services
                                    ↓
                             Service Mesh (Vault, Postgres, Redis)
                                    ↓
                          Monitoring (Prometheus, Grafana, ELK)
```

### Core Services

**WAF (Web Application Firewall)**
- OpenResty with ModSecurity
- SSL/TLS termination
- Reverse proxy to API Gateway and Frontend
- Ports: 8080 (HTTP), 8443 (HTTPS)

**API Gateway** (`packages/backend/api-gateway`)
- Built with Fastify
- Unified entry point for all backend services
- Features: Rate limiting (Redis-backed), session management, JWT verification, WebSocket support, HTTP proxying
- Routes traffic to: auth-service, user-service (planned), game-service (planned)
- Port: 3000 (dev mode only)

**Auth Service** (`packages/backend/auth-service`)
- OAuth 2.0 and JWT authentication
- PostgreSQL for user data
- Vault integration for secret management
- Port: 3001 (internal)

**Vault (HashiCorp)**
- Centralized secret management
- AppRole authentication for services
- Secrets stored: JWT secrets, database passwords, Redis passwords, monitoring credentials, Discord webhooks
- Port: 8200 (dev: HTTP, prod: HTTPS)

**Frontend** (`packages/front`)
- React + TypeScript
- Vite build system
- Phaser.js for game rendering
- TailwindCSS for styling
- HTTPS server in production (Node.js https module)
- Port: 3005-3006

**PostgreSQL**
- User: root_admin
- Password managed by Vault
- Init script: `infra/db/init.sql`

**Redis**
- Session storage and rate limiting
- Password managed by Vault

### Monitoring Stack (Profile: monitoring)

All monitoring services are optional and run with `make monitoring` or `docker compose --profile monitoring up`:

**Prometheus** (http://localhost:9090)
- Metrics collection from cAdvisor, node-exporter, services
- Alert rules defined in `infra/monitoring/prometheus/alert.rules.yml`

**Grafana** (http://localhost:3009)
- Dashboards: "Docker Containers", "Infrastructure Overview"
- Credentials: admin / [stored in Vault]
- Auto-provisioned datasources and dashboards

**Alertmanager** (http://localhost:9093)
- Alert routing to Discord webhooks
- Configuration: `infra/monitoring/alertmanager/alertmanager.yml`

**ELK Stack**
- Elasticsearch: Log storage (Port: 9200)
- Logstash: Log processing pipeline
- Kibana: Log visualization (http://localhost:5601)
- Filebeat: Log shipper (collects from Docker containers)

**Uptime-Kuma** (http://localhost:3010)
- Uptime monitoring and status pages
- Credentials: kuma_admin / [stored in Vault]

**cAdvisor** (http://localhost:8081)
- Container resource metrics

### Secret Management Flow

1. **Generate**: `./scripts/generate_dev_secrets.sh` creates random values
2. **Store**: Values written to `infra/secret/*.txt` (git-ignored)
3. **Mount**: Docker Compose mounts `infra/secret/` to `/run/secrets` in containers
4. **Seed**: Vault entrypoint (`infra/vault/init_vault.sh`) reads files and stores in Vault
5. **Consume**: Services authenticate to Vault (AppRole) and fetch secrets at runtime

### Shared Types

The `packages/shared/types` package provides TypeScript interfaces shared between frontend and backend:

- `auth.d.ts`: Authentication types (IAuthResponse, ILoginRequest, etc.)
- `user.ts` / `user.d.ts`: User profile types
- `session.ts`: Session management types
- `event.ts`: Event/WebSocket message types
- `state.ts`: Application state types

All services reference this package via workspace alias: `@speak-up/shared`

## Configuration Files

### Docker Compose Variants

- `docker-compose.yml`: Base configuration (all services)
- `docker-compose.dev.yml`: Development overrides (exposes ports)
- `docker-compose.prod.yml`: Production overrides (no exposed ports, TLS)
- `docker-compose.rootless.yml`: Rootless Docker compatibility
- `docker-compose.dev-test.yml`: Testing configuration

The system auto-detects rootless Docker via `scripts/init-docker-env.sh` and applies the appropriate compose file.

### Environment Management

- `.env`: Auto-generated, contains DOCKER_MODE
- `.env.example`: Template (currently empty)
- Services load secrets from `/run/secrets/*` (Docker secrets)

### Vault Policies

AppRole policies are defined in `infra/vault/policies/`:
- `api-gateway-policy.hcl`
- `auth-service-policy.hcl`

These define which secrets each service can access.

## Development Modes

### Development Mode (`make dev`)
- Backend ports exposed: 3000 (api-gateway), 3011 (auth-service), 5432 (postgres), 6378 (redis)
- Vault runs in HTTP mode at `http://vault:8200`
- AppRole credentials auto-generated to `infra/secret/*_role_id` and `infra/secret/*_secret_id`

### Production Mode (`make prod` or `make up`)
- No backend ports exposed (WAF only: 8080, 8443)
- Vault uses TLS
- Access via WAF reverse proxy only

## Key Implementation Details

### Vault Authentication in Services

Services use AppRole authentication:

1. Read `/run/secrets/vault_role_id` and `/run/secrets/vault_secret_id`
2. Authenticate to Vault at `http://vault:8200/v1/auth/approle/login`
3. Receive client token
4. Use token to fetch secrets from KV store

See `packages/backend/api-gateway/src/vault/client.ts` for reference implementation.

### Config Pattern

Both backend services use a similar config pattern:

```typescript
// packages/backend/api-gateway/src/config.ts
function getSecret(envVar: string, fileEnvVar: string, required: boolean = true): string | undefined {
  // 1. Check environment variable
  if (process.env[envVar]) return process.env[envVar];

  // 2. Check file path from environment
  const filePath = process.env[fileEnvVar];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8').trim();
  }

  // 3. Fail in production if required
  if (required && process.env.NODE_ENV === 'production') {
    throw new Error(`Required secret ${envVar} not found`);
  }

  return undefined;
}
```

This allows secrets to be provided via environment variables OR files (Docker secrets).

### Rate Limiting

API Gateway implements Redis-backed rate limiting with `@fastify/rate-limit`:
- Default: 100 requests per minute
- Ban after 10 violations
- Configurable via environment variables

### CORS Configuration

In development, CORS is set to `*`. In production, `CORS_ORIGIN` must be explicitly set or the service will refuse to start.

### JWT Security

Both services enforce JWT secret validation:
- Development: Falls back to default dev secret
- Production: Fails fast if JWT_SECRET is not set or uses default value

## Monitoring Access URLs

When running `make monitoring`:

- **Grafana**: http://localhost:3009 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Kibana**: http://localhost:5601 (run `make kibana-init` after startup)
- **Uptime-Kuma**: http://localhost:3010 (kuma_admin/[vault password])
- **cAdvisor**: http://localhost:8081

## Important Notes

### Docker Rootless Mode

The system detects rootless Docker automatically. If detected, it applies `docker-compose.rootless.yml` which:
- Adjusts cAdvisor volume mounts
- Modifies Filebeat configuration for unprivileged execution

### Volume Mounts in Development

When using `make dev`, backend services mount local `dist/` directories for hot-reload:
- API Gateway: `./packages/backend/api-gateway/dist`
- Auth Service: `./packages/backend/auth-service/dist`

Build TypeScript locally first with `make build` before running `make dev`.

### Filebeat JS Processor Removal

The ELK stack configuration has been updated to remove JavaScript processors from Filebeat due to rootless Docker compatibility issues. Log processing is handled by Logstash pipeline instead.

### Security Considerations

- Never commit files in `infra/secret/*.txt` (git-ignored)
- Development secrets are auto-generated but insecure (fixed root_token, etc.)
- Production requires proper secret provisioning (see `infra/secret/README.md`)
- Gitleaks is configured (`.gitleaks.toml`) to prevent secret leaks

## Package Manager

This is a pnpm workspace monorepo. Always use `pnpm` (not npm/yarn) for package management:

```bash
pnpm install              # Install all workspace dependencies
pnpm add <package> -w     # Add to root workspace
pnpm add <package> --filter @speak-up/api-gateway  # Add to specific package
```

## Testing

Currently, no automated tests are configured. Test scripts should be added to individual package.json files.

## Branch Strategy

- Main branch: `master`
- Current working branch: `elk` (ELK stack implementation)
