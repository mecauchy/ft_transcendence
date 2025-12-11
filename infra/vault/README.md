# Vault Configuration & Bug Fixes

## Issues Identified

### 1. **In-Memory Storage (Critical for Persistence)**
- **Problem**: Vault runs in dev mode with `inmem` storage
- **Impact**: All secrets are lost on container restart
- **Status**: ⚠️ Works for development, not for production

### 2. **No Configuration File**
- **Problem**: Vault uses hardcoded dev mode flags
- **Impact**: Cannot customize behavior easily
- **Solution**: Use `vault.hcl` configuration file

### 3. **TLS Disabled**
- **Problem**: No encryption for API communication
- **Impact**: Secrets transmitted in plain text
- **Solution**: Enable TLS in production only

### 4. **No Persistence Between Restarts**
- **Problem**: Data stored in-memory only
- **Impact**: Secrets disappear when container stops
- **Solution**: Use file-based or persistent backend storage

## Solutions Implemented

### For Development (Current)

✅ **Added volume mounting** for file-based storage:
```yaml
volumes:
  - vault_data:/vault/file
```

✅ **Created configuration file** at `infra/vault/vault.hcl`
- Uses file storage backend
- Disables TLS (OK for dev)
- Enables UI for easy management
- Proper logging

✅ **Created initialization script** at `infra/vault/init.sh`
- Automatically creates database credentials
- Sets up auth methods (AppRole, Userpass)
- Verifies Vault is running
- Populates secrets from `infra/secrets/` directory

### For Production (Future)

To move to production:

1. **Use a proper storage backend**:
   - PostgreSQL (already available)
   - Consul (recommended for HA)
   - S3/Cloud storage

2. **Enable TLS**:
   - Generate or use proper certificates
   - Update `vault.hcl` to enable TLS
   - Use proper certificate management (Let's Encrypt, etc.)

3. **Implement proper auth**:
   - AppRole for services
   - OIDC for users
   - JWT tokens
   - Disable root token usage

4. **Enable audit logging**:
   - Log all API calls
   - Store audit logs securely
   - Monitor access patterns

5. **Set up HA replication**:
   - Multiple Vault instances
   - Shared storage backend
   - Load balancer

## Configuration Files

### vault.hcl
- Main Vault configuration
- Defines storage, listeners, logging
- Location: `infra/vault/vault.hcl`

### init.sh
- Initialization script
- Creates database credentials
- Sets up auth methods
- Populates secrets
- Location: `infra/vault/init.sh`

## Docker Compose Changes

Updated Vault service to:

```yaml
vault:
  image: hashicorp/vault:1.13.3
  container_name: vault
  command: ["vault", "server", "-config=/vault/config/vault.hcl"]
  volumes:
    - vault_data:/vault/file          # Persistent storage
    - ./infra/vault/vault.hcl:/vault/config/vault.hcl:ro
    - ./infra/vault/init.sh:/vault/init.sh:ro
    - ./infra/secrets:/run/secrets:ro # Read database passwords
  environment:
    - VAULT_SKIP_VERIFY=true          # Dev only
  cap_add:
    - IPC_LOCK                        # Memory locking
  ports:
    - "8200:8200"
  networks:
    - service_mesh
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8200/v1/sys/health"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Testing the Setup

### Check Vault Status
```bash
make vault-status
curl http://localhost:8200/v1/sys/health | jq
```

### View Stored Secrets
```bash
docker compose exec vault sh -c 'export VAULT_ADDR=http://localhost:8200 && vault kv list secret/'
docker compose exec vault sh -c 'export VAULT_ADDR=http://localhost:8200 && vault kv get secret/database/postgres'
```

### Access Vault UI
```
http://localhost:8200/ui
Token: root_token_dev_only (dev only!)
```

### Initialize Vault (if needed)
```bash
docker compose exec vault /vault/init.sh
```

## Security Warnings

⚠️ **Development Mode**
- Root token visible in logs
- TLS disabled
- In-memory storage (no persistence)
- No audit logging

✅ **Safe for development**
✗ **NOT safe for production**

## Next Steps

1. ✅ Move to file-based storage (DONE)
2. ⏳ Add PostgreSQL as storage backend
3. ⏳ Implement AppRole authentication
4. ⏳ Set up proper TLS certificates
5. ⏳ Configure audit logging
6. ⏳ Implement high availability
