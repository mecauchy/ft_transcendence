# Development vs Production Configuration

## Secret Management

### Development (`docker-compose.override.yml`)

**Automatic Secret Generation:**
- Missing secrets are **automatically generated** when running `make up`
- The `generate_dev_secrets.sh` script creates secure random passwords using `openssl rand -base64 32`
- Secrets are stored as plain text files in `infra/secret/`
- All secret files are in `.gitignore` and never committed

**Secret Files Generated:**
```
infra/secret/
├── postgres_db_pass.txt    # PostgreSQL root password
├── auth_db_pass.txt         # Auth service database password
├── chat_db_pass.txt         # Chat service database password
├── game_db_pass.txt         # Game service database password
├── user_db_pass.txt         # User service database password
└── redis_password.txt       # Redis password
```

**Vault Configuration:**
- Runs in **dev mode** with auto-unseal
- Uses in-memory storage (data is lost on restart)
- Root token: <REDACTED> (hardcoded for convenience)
- Reads secrets from mounted `infra/secret/` directory
- Automatically initializes on startup via `entrypoint.sh`

**Workflow:**
```bash
# First time or after git pull
make up          # Automatically generates missing secrets and starts services
make secrets     # Or manually generate secrets only
```

### Production (`docker-compose.prod.yml`)

**Manual Secret Management:**
- Secrets are **NOT automatically generated**
- Must be manually provided through secure channels
- Uses external secret management systems

**Recommended Approaches:**

1. **HashiCorp Vault (Recommended)**
   - Use Vault's dynamic secret generation
   - Secrets are never stored in files
   - Automatic rotation and lease management
   - Services authenticate via AppRole

2. **Cloud Secret Managers**
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Cloud Secret Manager
   - Integrate via environment variables or SDKs

3. **Kubernetes Secrets**
   - If deploying to K8s
   - Use sealed secrets or external-secrets operator
   - Mount as volumes or environment variables

4. **CI/CD Secret Management**
   - GitHub Secrets
   - GitLab CI/CD Variables
   - Jenkins Credentials
   - Injected at deployment time

**Vault Configuration:**
- Runs in **production mode** (sealed by default)
- Uses **file-based storage** persisted in Docker volumes
- Requires manual initialization and unsealing
- TLS enabled (HTTPS)
- No default root token
- No exposed ports (accessed via internal network)

**Production Deployment:**
```bash
# Use production compose file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Vault requires manual initialization
docker compose exec vault vault operator init
docker compose exec vault vault operator unseal
```

## Key Differences Summary

| Aspect | Development | Production |
|--------|-------------|------------|
| **Secret Generation** | Automatic via script | Manual/External systems |
| **Vault Mode** | Dev (auto-unseal) | Production (sealed) |
| **Storage** | In-memory | File-based persistent |
| **Root Token** | Hardcoded <REDACTED> | Generated during init |
| **TLS** | Disabled (HTTP) | Enabled (HTTPS) |
| **Ports Exposed** | Yes (for debugging) | No (internal only) |
| **Secret Files** | Auto-generated, local files | Never used, external sources |
| **Data Persistence** | Lost on restart | Persisted in volumes |
| **Security** | Convenience over security | Security over convenience |

## Security Considerations

### Development
⚠️ **DO NOT** use development secrets in production
- Secrets are auto-generated and not rotated
- Files are stored unencrypted on disk
- Vault dev mode has no security guarantees
- Root token is publicly known

### Production
✅ **MUST** follow security best practices
- Use strong, manually-generated secrets
- Rotate secrets regularly
- Use Vault's dynamic secret generation
- Enable TLS/mTLS for all communications
- Use least-privilege access controls
- Monitor and audit secret access
- Never commit secrets to version control
- Use sealed secrets or encryption at rest

## Transitioning from Dev to Prod

When moving to production:

1. **Remove all dev secret files** - they should never reach production
2. **Set up proper secret management** - Vault, cloud providers, or K8s
3. **Configure TLS certificates** - for Vault and other services
4. **Initialize Vault in production mode** - manual unsealing required
5. **Set up monitoring and alerting** - for secret leaks and access
6. **Document secret rotation procedures** - who has access, how to rotate
7. **Review and update policies** - Vault ACLs, AppRole permissions

## Environment Variables

The application detects the environment and behaves accordingly:

```bash
# Development (default when using docker-compose.override.yml)
docker compose up

# Production (explicit)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

No additional environment variables needed - the compose file selection determines the behavior.
