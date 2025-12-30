Here is a unified, professional **Infrastructure Operations Manual**.

I have restructured the content into a standard **Markdown** format suitable for your repository (e.g., `infra/OPERATIONS.md`). This layout separates "Day-to-Day CLI Commands" from "Critical Security Procedures" while maintaining a clean, navigable hierarchy.

---

# 📖 Infrastructure Operations Manual

**Project:** ft_transcendence

**Context:** DevOps & Security Operations

**Version:** 1.0

---

## 📋 1. Service CLI Reference (Cheat Sheet)

Use these commands for daily debugging, status checks, and manual verification.
*All commands assume you are at the project root.*

### 🔐 HashiCorp Vault

*Access secrets and manage authentication.*

| Action | Command |
| --- | --- |
| **Enter Shell** | `docker compose exec vault sh` |
| **Check Status** | `docker compose exec -T vault vault status` |
| **List Secrets** | `docker compose exec -T vault sh -c 'export VAULT_TOKEN=$(cat infra/secret/vault_token.txt) && vault kv list secret/database/'` |
| **Read Secret** | `docker compose exec -T vault sh -c 'export VAULT_TOKEN=$(cat infra/secret/vault_token.txt) && vault kv get secret/database/postgres'` |
| **List AppRoles** | `docker compose exec -T vault sh -c 'export VAULT_TOKEN=$(cat infra/secret/vault_token.txt) && vault list auth/approle/role/'` |

### 🐘 PostgreSQL

*Database management and SQL execution.*

| Action | Command |
| --- | --- |
| **SQL Shell** | `docker compose exec postgres psql -U root_admin` |
| **List DBs** | `docker compose exec postgres psql -U root_admin -c "\l"` |
| **Backup DB** | `docker compose exec postgres pg_dump -U root_admin auth_db > backup_auth_db.sql` |
| **Manual Query** | `docker compose exec postgres psql -U root_admin -c "SELECT version();"` |

### 🧠 Redis

*Cache and session store inspection.*

| Action | Command |
| --- | --- |
| **Enter CLI** | `docker compose exec redis redis-cli` |
| **Monitor Keys** | `docker compose exec -T redis redis-cli KEYS "*"` |
| **Check Memory** | `docker compose exec -T redis redis-cli INFO memory` |
| **Flush Data** | `docker compose exec -T redis redis-cli FLUSHALL` (⚠️ Irreversible) |

### 🛡️ WAF (Nginx + ModSecurity)

*Traffic filtering and firewall monitoring.*

| Action | Command |
| --- | --- |
| **Test Config** | `docker compose exec -T waf nginx -t` |
| **Reload Nginx** | `docker compose exec -T waf nginx -s reload` |
| **Audit Logs** | `docker compose exec -T waf tail -f /var/log/modsec_audit.log` |
| **Verify Rules** | `docker compose exec -T waf grep -c "^Rule" /etc/nginx/modsecurity.d/owasp-crs/rules/*.conf` |

---

## 🚨 2. Security Standard Operating Procedures (SOP)

Follow these procedures strictly to maintain compliance with **Subject Version 19** (Section IV.5 Cybersecurity).

### 2.1. Adding a New API Key

**Scenario:** You need to add a third-party API key (e.g., OAuth Client Secret) without leaking it in Git.

1. **Create Local Secret File (Development only):**
```bash
echo -n "your-secret-key-here" > infra/secret/oauth_client_secret.txt
chmod 600 infra/secret/oauth_client_secret.txt

```


2. **Update `docker-compose.yml`:**
```yaml
secrets:
  oauth_client_secret:
    file: ./infra/secret/oauth_client_secret.txt

```


3. **Mount in Target Service:**
```yaml
# In the service definition (e.g., api-gateway)
secrets:
  - source: oauth_client_secret
    target: /run/secrets/oauth_client_secret

```


4. **Update Entrypoint Logic:**
*Modify `packages/backend/api-gateway/entrypoint.sh` to export the variable:*
```bash
if [ -f "$SECRETS_DIR/oauth_client_secret" ]; then
  export OAUTH_CLIENT_SECRET="$(cat "$SECRETS_DIR/oauth_client_secret")"
fi

```


5. **Deploy & Verify:**
```bash
docker compose up -d --build api-gateway
docker logs api-gateway | grep -i oauth  # Ensure no errors

```



---

### 2.2. Rotating a Database Password (Zero Downtime)

**Scenario:** Rotate the `auth_db` password without shutting down the service.

1. **Generate New Password:**
```bash
NEW_PASS=$(openssl rand -base64 32 | tr -d '\n')

```


2. **Update Vault (Create new version):**
```bash
docker exec vault sh -c "
  export VAULT_ADDR=http://0.0.0.0:8200
  export VAULT_TOKEN=\$(cat /run/secrets/vault_token.txt)
  vault kv put secret/database/auth password='$NEW_PASS' username='auth_user' host='postgres' port='5432' database='auth_db'
"

```


3. **Update PostgreSQL User:**
```bash
docker exec postgres psql -U root_admin -c "ALTER USER auth_user WITH PASSWORD '$NEW_PASS';"

```


4. **Update Local Secret File (For future dev restarts):**
```bash
echo -n "$NEW_PASS" > infra/secret/auth_db_pass.txt
chmod 600 infra/secret/auth_db_pass.txt

```


5. **Rolling Restart:**
```bash
docker compose restart auth-service

```



---

### 2.3. Regenerating AppRole Credentials (Production)

**Scenario:** Rotate the credentials used by services to authenticate with Vault.

1. **Generate & Save Credentials:**
```bash
docker exec vault sh -c '
  export VAULT_ADDR=http://0.0.0.0:8200
  export VAULT_TOKEN=$(cat /run/secrets/vault_token.txt)

  # 1. Get Static RoleID
  ROLE_ID=$(vault read -field=role_id auth/approle/role/auth-role/role-id)

  # 2. Generate New SecretID
  SECRET_ID=$(vault write -field=secret_id -f auth/approle/role/auth-role/secret-id)

  # 3. Save to secret directory
  echo -n "$ROLE_ID" > /run/secrets/vault_role_id
  echo -n "$SECRET_ID" > /run/secrets/vault_secret_id
  chmod 600 /run/secrets/vault_role_id /run/secrets/vault_secret_id
'

```


2. **Mount Secrets in Compose:**
Ensure `docker-compose.yml` mounts `vault_role_id` and `vault_secret_id`.
3. **Restart Service:**
```bash
docker compose up -d auth-service

```



---

### 2.4. Emergency Incident Response

**Scenario:** A secret was accidentally committed to Git or exposed in logs.

1. **Revoke Compromised Token:**
```bash
docker exec vault sh -c '
  export VAULT_ADDR=http://0.0.0.0:8200
  export VAULT_TOKEN=$(cat /run/secrets/vault_token.txt)
  vault token revoke -mode=path auth/approle/role/auth-role
'

```


2. **Generate & Store New Secret:**
```bash
NEW_SECRET=$(openssl rand -base64 48)
# Update Vault immediately
docker exec vault sh -c "
  export VAULT_ADDR=http://0.0.0.0:8200
  export VAULT_TOKEN=\$(cat /run/secrets/vault_token.txt)
  vault kv put secret/jwt secret='$NEW_SECRET'
"

```


3. **Sanitize Git History:**
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch infra/secret/jwt_secret.txt' \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all

```



---

## 🖥️ 3. System Status & Maintenance

| Command             | Description          |
| ------------------- | -------------------- |
| `docker compose ps` | View all running services and ports. |
| `docker compose logs -f [service]` | Stream logs for a specific service. |
| `make health` | Run the project health check script. |
| `docker compose down && docker compose up -d` | Full system restart (downtime involved). |
