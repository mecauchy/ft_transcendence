#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

get_secret_content() {
	local file_path=$1
	if [ -f "${file_path}" ]; then 
		cat "${file_path}"
	else 
		echo "Error: Secret file not found at ${file_path}." >&2
		exit 1
	fi
}

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Initializing Vault for Development               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Wait for Vault to be ready using curl instead of vault CLI
echo -e "${YELLOW} Waiting for Vault to be ready...${NC}"
i=1
while [ $i -le 30 ]; do
    if curl -s -k http://127.0.0.1:8200/v1/sys/health >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Vault is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Vault failed to start after 30 attempts!${NC}"
        echo "Continuing anyway with initialization..." >&2
    fi
    sleep 1
    i=$((i+1))
done

echo ""
echo -e "${YELLOW} Reading secrets from files...${NC}"

# Retrieve database passwords from infra/secrets/
POSTGRES_PASS=$(get_secret_content "/tmp/vault-secrets/postgres_db_pass.txt")
AUTH_PASS=$(get_secret_content "/tmp/vault-secrets/auth_db_pass.txt")
CHAT_PASS=$(get_secret_content "/tmp/vault-secrets/chat_db_pass.txt")
GAME_PASS=$(get_secret_content "/tmp/vault-secrets/game_db_pass.txt")
USER_PASS=$(get_secret_content "/tmp/vault-secrets/user_db_pass.txt")
GRAFANA_PASS=$(get_secret_content "/tmp/vault-secrets/grafana_pass.txt")
KUMA_PASS=$(get_secret_content "/tmp/vault-secrets/kuma_pass.txt")
ELASTICSEARCH_PASS=$(get_secret_content "/tmp/vault-secrets/elasticsearch_pass.txt")

echo -e "${GREEN}✓ All secrets loaded${NC}"

# Check if engines are already enabled
echo ""
echo -e "${YELLOW}🔧 Configuring Vault engines...${NC}"

vault secrets list 2>/dev/null | grep -q "^secret/" || \
	(vault secrets enable -version=2 -path=secret kv && echo -e "${GREEN}✓ KV engine enabled${NC}") || \
	echo -e "${YELLOW}⚠ KV engine already enabled${NC}"

vault secrets list 2>/dev/null | grep -q "^database/" || \
	(vault secrets enable database && echo -e "${GREEN}✓ Database engine enabled${NC}") || \
	echo -e "${YELLOW}⚠ Database engine already enabled${NC}"

# --------------------------------------------------------------------------
# LOAD POLICIES (GRANULAR LEAST-PRIVILEGE)
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}📋 Loading granular security policies...${NC}"

# Load policies in order of specificity (most specific first)
# Using a simple list approach compatible with sh
for policy_name in api-gateway-policy auth-service-policy chat-policy game-policy user-policy postgres-policy grafana-policy kuma-policy; do
	policy_file="/policies/${policy_name}.hcl"
	if [ -f "$policy_file" ]; then
		vault policy write "$policy_name" "$policy_file" 2>/dev/null && \
			echo -e "${GREEN}✓ Policy '$policy_name' loaded${NC}" || \
			echo -e "${YELLOW}⚠ Policy '$policy_name' already exists${NC}"
	else
		echo -e "${YELLOW}⚠ Policy file not found: $policy_file${NC}"
	fi
done

# Fallback: Load any remaining .hcl files not in the explicit list
echo -e "${YELLOW}  Loading additional policies...${NC}"
for policy_file in /policies/*.hcl; do
	if [ -f "$policy_file" ]; then
		policy_name=$(basename "$policy_file" .hcl)
		# Check if already loaded (simple string matching)
		case "$policy_name" in
			api-gateway-policy|auth-service-policy|chat-policy|game-policy|user-policy|postgres-policy|grafana-policy|kuma-policy)
				# Skip already loaded
				;;
			*)
				vault policy write "$policy_name" "$policy_file" 2>/dev/null && \
					echo -e "${GREEN}✓ Policy '$policy_name' loaded${NC}" || \
					echo -e "${YELLOW}⚠ Policy '$policy_name' already exists${NC}"
				;;
		esac
	fi
done

# --------------------------------------------------------------------------
# STATIC SECRETS (KV STORE) - Database Credentials
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW} Storing database credentials in Vault...${NC}"

# Grafana credentials
vault kv put secret/grafana \
	username="grafana_admin" \
	password="${GRAFANA_PASS}" 2>/dev/null && \
	echo -e "${GREEN}✓ Grafana credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Grafana credentials already exist${NC}"

# Uptime-Kuma credentials
vault kv put secret/kuma \
	username="kuma_admin" \
	password="${KUMA_PASS}" 2>/dev/null && \
	echo -e "${GREEN}✓ Uptime-Kuma credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Uptime-Kuma credentials already exist${NC}"

# Alertmanager webhook
if [ -f "/tmp/vault-secrets/alertmanager_webhook.txt" ]; then
	ALERTMANAGER_WEBHOOK=$(cat /tmp/vault-secrets/alertmanager_webhook.txt)
	vault kv put secret/alertmanager \
		discord_webhook_url="${ALERTMANAGER_WEBHOOK}" 2>/dev/null && \
		echo -e "${GREEN}✓ Alertmanager webhook stored${NC}" || \
		echo -e "${YELLOW}⚠ Alertmanager webhook already exists${NC}"
else
	echo -e "${YELLOW}⚠ Alertmanager webhook file not found${NC}"
fi

# Elasticsearch credentials
vault kv put secret/elasticsearch \
	username="elastic_admin" \
	password="${ELASTICSEARCH_PASS}" 2>/dev/null && \
	echo -e "${GREEN}✓ Elasticsearch credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Elasticsearch credentials already exist${NC}"

# PostgreSQL root credentials
vault kv put secret/database/postgres \
	password="${POSTGRES_PASS}" \
	username="root_admin" \
	host="postgres" \
	port="5432" 2>/dev/null && \
	echo -e "${GREEN}✓ PostgreSQL root credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ PostgreSQL credentials already exist${NC}"

# Auth DB credentials
vault kv put secret/database/auth \
	password="${AUTH_PASS}" \
	username="auth_user" \
	host="postgres" \
	port="5432" \
	database="auth_db" 2>/dev/null && \
	echo -e "${GREEN}✓ Auth DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Auth DB credentials already exist${NC}"

# Chat DB credentials
vault kv put secret/database/chat \
	password="${CHAT_PASS}" \
	username="chat_user" \
	host="postgres" \
	port="5432" \
	database="chat_db" 2>/dev/null && \
	echo -e "${GREEN}✓ Chat DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Chat DB credentials already exist${NC}"

# Game DB credentials
vault kv put secret/database/game \
	password="${GAME_PASS}" \
	username="game_user" \
	host="postgres" \
	port="5432" \
	database="game_db" 2>/dev/null && \
	echo -e "${GREEN}✓ Game DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Game DB credentials already exist${NC}"

# User DB credentials
vault kv put secret/database/user \
	password="${USER_PASS}" \
	username="user_user" \
	host="postgres" \
	port="5432" \
	database="user_db" 2>/dev/null && \
	echo -e "${GREEN}✓ User DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ User DB credentials already exist${NC}"

# --------------------------------------------------------------------------
# POSTGRES DATABASE SECRETS ENGINE CONFIGURATION
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}🗄️  Configuring PostgreSQL Database Engine...${NC}"

# 1. Configure the Database Secret Engine
vault write database/config/postgres \
	plugin_name=postgresql-database-plugin \
	connection_url="postgresql://{{username}}:{{password}}@postgres:5432/postgres?sslmode=disable" \
	username="root_admin" \
	password="${POSTGRES_PASS}" 2>/dev/null && \
	echo -e "${GREEN}✓ PostgreSQL database engine configured${NC}" || \
	echo -e "${YELLOW}⚠ PostgreSQL database engine already configured${NC}"

# 2. Create Roles for Dynamic Credentials
echo -e "${YELLOW} Creating database roles...${NC}"

# Auth Role
vault write database/roles/auth-role \
	db_name=postgres \
	creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON DATABASE \"auth_db\" TO \"{{name}}\";" \
	default_ttl="1h" \
	max_ttl="24h" 2>/dev/null && \
	echo -e "${GREEN}✓ Auth role created${NC}" || \
	echo -e "${YELLOW}⚠ Auth role already exists${NC}"

# Create token with all policies attached (idempotent - check if token exists first)
vault token lookup -format=json "auth-token" >/dev/null 2>&1 || \
	(vault token create -policy="auth-policy" -id="auth-token" >/dev/null 2>&1 && echo -e "${GREEN}✓ auth-token created${NC}" || echo -e "${YELLOW}⚠ auth-token already exists${NC}")
vault token lookup -format=json "chat-token" >/dev/null 2>&1 || \
	(vault token create -policy="chat-policy" -id="chat-token" >/dev/null 2>&1 && echo -e "${GREEN}✓ chat-token created${NC}" || echo -e "${YELLOW}⚠ chat-token already exists${NC}")
vault token lookup -format=json "game-token" >/dev/null 2>&1 || \
	(vault token create -policy="game-policy" -id="game-token" >/dev/null 2>&1 && echo -e "${GREEN}✓ game-token created${NC}" || echo -e "${YELLOW}⚠ game-token already exists${NC}")
vault token lookup -format=json "user-token" >/dev/null 2>&1 || \
	(vault token create -policy="user-policy" -id="user-token" >/dev/null 2>&1 && echo -e "${GREEN}✓ user-token created${NC}" || echo -e "${YELLOW}⚠ user-token already exists${NC}")
vault token lookup -format=json "postgres-token" >/dev/null 2>&1 || \
	(vault token create -policy="postgres-policy" -id="postgres-token" >/dev/null 2>&1 && echo -e "${GREEN}✓ postgres-token created${NC}" || echo -e "${YELLOW}⚠ postgres-token already exists${NC}")
vault token lookup -format=json "grafana-token" >/dev/null 2>&1 || \
	(vault token create -policy="grafana-policy" -id="grafana-token" >/dev/null 2>&1 && echo -e "${GREEN}✓ grafana-token created${NC}" || echo -e "${YELLOW}⚠ grafana-token already exists${NC}")

# Enable APProle (idempotent)
vault auth enable approle 2>/dev/null || echo -e "${YELLOW}⚠ AppRole auth already enabled${NC}"

# --------------------------------------------------------------------------
# CREATE APPROLES WITH GRANULAR POLICIES (LEAST PRIVILEGE)
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}🔐 Creating AppRoles with granular policy assignments...${NC}"

# API-GATEWAY: Limited to gateway-specific secrets + JWT
vault write auth/approle/role/api-gateway-role \
	token_policies="api-gateway-policy" \
	token_ttl=1h \
	token_max_ttl=24h \
	token_no_default_policy=true 2>/dev/null && \
	echo -e "${GREEN}✓ API Gateway AppRole created (policy: api-gateway-policy)${NC}" || \
	echo -e "${YELLOW}⚠ API Gateway AppRole already exists${NC}"

# AUTH-SERVICE: JWT + Auth DB credentials ONLY
vault write auth/approle/role/auth-service-role \
	token_policies="auth-service-policy" \
	token_ttl=1h \
	token_max_ttl=24h \
	token_no_default_policy=true 2>/dev/null && \
	echo -e "${GREEN}✓ Auth Service AppRole created (policy: auth-service-policy)${NC}" || \
	echo -e "${YELLOW}⚠ Auth Service AppRole already exists${NC}"

# LEGACY: Keep old role names for backward compatibility (map to new policies)
# These will be deprecated in future versions
vault write auth/approle/role/auth-role \
	token_policies="auth-service-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ Auth service AppRole (legacy) created${NC}" || \
	echo -e "${YELLOW}⚠ Auth service AppRole (legacy) already exists${NC}"

# Chat Service AppRole
vault write auth/approle/role/chat-role \
	token_policies="chat-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ Chat service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ Chat service AppRole already exists${NC}"

# Game Service AppRole
vault write auth/approle/role/game-role \
	token_policies="game-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ Game service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ Game service AppRole already exists${NC}"

# User Service AppRole
vault write auth/approle/role/user-role \
	token_policies="user-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ User service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ User service AppRole already exists${NC}"

echo ""
echo -e "${YELLOW}📊 Policy Assignment Summary:${NC}"
echo -e "  ${GREEN}api-gateway-role${NC}     → api-gateway-policy  (JWT, session, redis)"
echo -e "  ${GREEN}auth-service-role${NC}    → auth-service-policy (JWT, auth DB only)"
echo -e "  ${GREEN}chat-role${NC}            → chat-policy         (Chat DB only)"
echo -e "  ${GREEN}game-role${NC}            → game-policy         (Game DB only)"
echo -e "  ${GREEN}user-role${NC}            → user-policy         (User DB only)"

# --------------------------------------------------------------------------
# EXTRACT AND SAVE APPROLE CREDENTIALS (WITH ROLE MIGRATION)
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}🔑 Extracting AppRole credentials for services...${NC}"

# Process api-gateway service (NEW: uses api-gateway-role with granular policy)
echo -e "${YELLOW}  Processing api-gateway (role: api-gateway-role)...${NC}" >&2
echo "[DEBUG] VAULT_ADDR=$VAULT_ADDR VAULT_TOKEN=$VAULT_TOKEN" >&2
vault read -field=role_id auth/approle/role/api-gateway-role/role-id 2>&1 | tee /tmp/role_id.log >&2
ROLE_ID=$(cat /tmp/role_id.log 2>/dev/null)
vault write -f -field=secret_id auth/approle/role/api-gateway-role/secret-id 2>&1 | tee /tmp/secret_id.log >&2
SECRET_ID=$(cat /tmp/secret_id.log 2>/dev/null)

echo "[DEBUG] ROLE_ID='$ROLE_ID' SECRET_ID='$SECRET_ID'" >&2

# Fallback to legacy auth-role if new role doesn't exist
if [ -z "$ROLE_ID" ] || [ -z "$SECRET_ID" ]; then
	echo -e "${YELLOW}  ⚠ api-gateway-role not found or empty, falling back to auth-role (legacy)${NC}" >&2
	vault read -field=role_id auth/approle/role/auth-role/role-id 2>&1 | tee /tmp/role_id_legacy.log >&2
	ROLE_ID=$(cat /tmp/role_id_legacy.log 2>/dev/null)
	vault write -f -field=secret_id auth/approle/role/auth-role/secret-id 2>&1 | tee /tmp/secret_id_legacy.log >&2
	SECRET_ID=$(cat /tmp/secret_id_legacy.log 2>/dev/null)
	echo "[DEBUG] After fallback - ROLE_ID='$ROLE_ID' | SECRET_ID='$SECRET_ID'" >&2
fi

if [ -n "$ROLE_ID" ] && [ -n "$SECRET_ID" ]; then
	echo -n "$ROLE_ID" > "/tmp/vault-secrets/api-gateway_role_id"
	echo -n "$SECRET_ID" > "/tmp/vault-secrets/api-gateway_secret_id"
	chmod 600 "/tmp/vault-secrets/api-gateway_role_id" "/tmp/vault-secrets/api-gateway_secret_id" 2>/dev/null || true
	echo -e "${GREEN}✓ api-gateway: RoleID and SecretID saved${NC}"
else
	echo -e "${RED}✗ Failed to extract credentials for api-gateway (ROLE_ID='$ROLE_ID' SECRET_ID='$SECRET_ID')${NC}"
fi

# Process auth-service (NEW: uses auth-service-role with granular policy)
echo -e "${YELLOW}  Processing auth-service (role: auth-service-role)...${NC}"
ROLE_ID=$(vault read -field=role_id auth/approle/role/auth-service-role/role-id 2>/dev/null)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/auth-service-role/secret-id 2>/dev/null)

# Fallback to legacy auth-role if new role doesn't exist
if [ -z "$ROLE_ID" ] || [ -z "$SECRET_ID" ]; then
	echo -e "${YELLOW}  ⚠ auth-service-role not found, falling back to auth-role (legacy)${NC}"
	ROLE_ID=$(vault read -field=role_id auth/approle/role/auth-role/role-id 2>/dev/null)
	SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/auth-role/secret-id 2>/dev/null)
fi

if [ -n "$ROLE_ID" ] && [ -n "$SECRET_ID" ]; then
	echo -n "$ROLE_ID" > "/tmp/vault-secrets/auth-service_role_id"
	echo -n "$SECRET_ID" > "/tmp/vault-secrets/auth-service_secret_id"
	chmod 600 "/tmp/vault-secrets/auth-service_role_id" "/tmp/vault-secrets/auth-service_secret_id" 2>/dev/null || true
	echo -e "${GREEN}✓ auth-service: RoleID and SecretID saved${NC}"
else
	echo -e "${RED}✗ Failed to extract credentials for auth-service${NC}"
fi
echo -e "${YELLOW}  Processing auth-service (role: auth-role)...${NC}"
ROLE_ID=$(vault read -field=role_id auth/approle/role/auth-role/role-id 2>/dev/null)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/auth-role/secret-id 2>/dev/null)

if [ -n "$ROLE_ID" ] && [ -n "$SECRET_ID" ]; then
	echo -n "$ROLE_ID" > "/tmp/vault-secrets/auth-service_role_id"
	echo -n "$SECRET_ID" > "/tmp/vault-secrets/auth-service_secret_id"
	chmod 600 "/tmp/vault-secrets/auth-service_role_id" "/tmp/vault-secrets/auth-service_secret_id" 2>/dev/null || true
	echo -e "${GREEN}✓ auth-service: RoleID and SecretID saved${NC}"
else
	echo -e "${RED}✗ Failed to extract credentials for auth-service${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Vault initialization complete!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}📦 Vault is ready with:${NC}"
echo "   • KV secret engine for static secrets"
echo "   • PostgreSQL database engine for dynamic credentials"
echo "   • AppRole authentication for services"
echo "   • AppRole credentials extracted and saved"
echo "   • Database credentials for all services"
echo ""
echo -e "${YELLOW}🚀 Services can now authenticate via AppRole${NC}"
