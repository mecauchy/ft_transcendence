# ╔══════════════════════════════════════════════════════════════╗
# ║        SERVICE ACCESS & TESTING COMMAND REFERENCE            ║
# ╚══════════════════════════════════════════════════════════════╝

echo "
📌 VAULT - Access Secrets & Manage Auth
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Enter Vault shell
docker compose exec vault sh

# Check Vault status
docker compose exec -T vault vault status

# List all stored secrets
docker compose exec -T vault sh -c 'export VAULT_TOKEN=root_token_dev_only && vault kv list secret/database/'

# Read specific database credentials
docker compose exec -T vault sh -c 'export VAULT_TOKEN=root_token_dev_only && vault kv get secret/database/postgres'

# List AppRole authentication roles
docker compose exec -T vault sh -c 'export VAULT_TOKEN=root_token_dev_only && vault list auth/approle/role/'

# Get AppRole RoleID for a service
docker compose exec -T vault sh -c 'export VAULT_TOKEN=root_token_dev_only && vault read auth/approle/role/auth-role/role-id'


📌 POSTGRESQL - Database Access & Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Open PostgreSQL shell (psql)
docker compose exec postgres psql -U root_admin

# Connect to specific database
docker compose exec postgres psql -U root_admin -d auth_db

# List all databases
docker compose exec postgres psql -U root_admin -c \"\\l\"

# List all tables in a database
docker compose exec postgres psql -U root_admin -d auth_db -c \"\\dt\"

# Execute SQL query
docker compose exec postgres psql -U root_admin -c \"SELECT version();\"

# Create a new table
docker compose exec postgres psql -U root_admin -d auth_db -c \"
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
  );\"

# Backup database
docker compose exec postgres pg_dump -U root_admin auth_db > backup_auth_db.sql


📌 REDIS - Cache & Session Store
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Enter Redis CLI
docker compose exec redis redis-cli

# From outside container
docker compose exec -T redis redis-cli

# Check Redis info
docker compose exec -T redis redis-cli INFO server

# Set a key
docker compose exec -T redis redis-cli SET mykey \"myvalue\"

# Get a key
docker compose exec -T redis redis-cli GET mykey

# List all keys
docker compose exec -T redis redis-cli KEYS \"*\"

# Check memory usage
docker compose exec -T redis redis-cli INFO memory

# Flush all data (WARNING: irreversible!)
docker compose exec -T redis redis-cli FLUSHALL


📌 WAF (NGINX) - Test & Monitor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Check Nginx configuration
docker compose exec -T waf nginx -t

# Reload Nginx (after config changes)
docker compose exec -T waf nginx -s reload

# Check Nginx process status
docker compose exec -T waf ps aux | grep nginx

# Test HTTP endpoint (localhost)
curl -v http://localhost:8080/

# Test HTTPS endpoint (with self-signed cert ignore)
curl -v -k https://localhost:8443/

# Check ModSecurity rules loaded
docker compose exec -T waf grep -c \"^Rule\" /etc/nginx/modsecurity.d/owasp-crs/rules/*.conf

# View Nginx access logs (JSON format)
docker compose logs waf | grep '\"remote_addr\"' | head -10

# View ModSecurity audit logs
docker compose exec -T waf tail -f /var/log/modsec_audit.log 2>/dev/null || echo \"Audit log not yet available\"


📌 OVERALL SYSTEM STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# View all running services
docker compose ps

# View all logs (follow mode)
docker compose logs -f

# View logs for specific service
docker compose logs -f [service-name]  # vault, postgres, redis, waf

# Health check status
make health

# Full system restart
docker compose down && sleep 2 && docker compose up -d
